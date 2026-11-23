import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { decryptSecret } from '@/lib/crypto'
import { PROVIDERS, adapterForDomain } from './settings'
import { RegistrarTimeout, type OperationResult, type RegistrarOperation } from './types'

// Execução de registo/renovação/transferência de domínio depois do pagamento confirmado.
//   * Uma operação por (serviço, tipo) — chave única em registrar_operations.
//   * A referência enviada ao fornecedor (client_ref) é fixa: repetir nunca cria um segundo registo.
//   * Timeout ou resposta inconclusiva → estado «unknown»; a tentativa seguinte CONSULTA o
//     fornecedor antes de voltar a pedir. Se a consulta também for inconclusiva, fica manual.
//   * Só «succeeded» (confirmado pelo registrador) activa o domínio.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DomainRunResult =
  | { handled: false }
  | { handled: true; outcome: 'succeeded'; providerRef: string | null; message: string }
  | { handled: true; outcome: 'pending' | 'failed' | 'manual'; message: string }

const clean = (s: unknown) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/(token|password|secret|auth\w*)=\S+/gi, '$1=[oculto]').slice(0, 300)

export async function runDomainOperation(serviceId: string, operation: RegistrarOperation, domain: string, opts: { years?: number; eppEnc?: string | null; nameservers?: string[] } = {}): Promise<DomainRunResult> {
  const target = await adapterForDomain(domain)
  if (!target) return { handled: false }
  const { adapter, provider, mode } = target
  // Fornecedores com autorização por encomenda (Hostinger) nunca são accionados automaticamente
  if (PROVIDERS.find(p => p.id === provider)?.authorizePerOrder) return { handled: false }
  const db = getPool()
  const clientRef = `vh-${operation}-${serviceId}`.slice(0, 64)
  await db.query(
    `INSERT IGNORE INTO registrar_operations (id, service_id, operation, domain, provider, mode, client_ref, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [randomUUID(), serviceId, operation, domain, provider, mode, clientRef],
  )
  const [[op]] = await db.query('SELECT * FROM registrar_operations WHERE service_id = ? AND operation = ?', [serviceId, operation]) as any
  const save = (status: string, r: Partial<OperationResult> & { message: string }) => db.query(
    'UPDATE registrar_operations SET status = ?, provider_ref = COALESCE(?, provider_ref), provider_status = COALESCE(?, provider_status), message = ? WHERE id = ?',
    [status, r.providerRef || null, r.providerStatus || null, clean(r.message), op.id])

  if (op.status === 'succeeded') return { handled: true, outcome: 'succeeded', providerRef: op.provider_ref, message: 'Já confirmado pelo registrador.' }

  // Pedido já enviado (ou resposta perdida): consultar antes de repetir
  if (['submitted', 'unknown'].includes(op.status)) {
    try {
      const look = await adapter.lookup({ domain, clientRef: op.client_ref, operation })
      if (look.found) {
        if (look.outcome === 'succeeded') { await save('succeeded', look); return { handled: true, outcome: 'succeeded', providerRef: look.providerRef ?? null, message: look.message } }
        if (look.outcome === 'pending') { await save('submitted', look); return { handled: true, outcome: 'pending', message: 'Pedido aceite pelo registrador; a aguardar confirmação. Repita mais tarde para consultar o estado.' } }
        if (look.outcome === 'unknown') { await save('unknown', look); return { handled: true, outcome: 'manual', message: 'Estado inconclusivo no registrador: confirme no painel do fornecedor e marque manualmente com a referência.' } }
        // failed → pode voltar a pedir abaixo
      }
    } catch (e) {
      await save('unknown', { message: e instanceof RegistrarTimeout ? 'Consulta de estado sem resposta.' : (e as Error).message })
      return { handled: true, outcome: 'manual', message: 'Não foi possível consultar o estado no registrador: não foi feito novo pedido. Verifique no painel do fornecedor.' }
    }
  }

  // Disponibilidade confirmada no fornecedor imediatamente antes de registar
  if (operation === 'register') {
    let chk
    try { chk = await adapter.check(domain) } catch { chk = { status: 'unknown' as const } }
    if (chk.status === 'unavailable') { await save('failed', { message: 'Domínio indisponível no registrador.' }); return { handled: true, outcome: 'failed', message: 'O domínio deixou de estar disponível: contactar o cliente (nenhum registo feito).' } }
    if (chk.status !== 'available') { await save('unknown', { message: 'Disponibilidade inconclusiva.' }); return { handled: true, outcome: 'manual', message: 'Disponibilidade inconclusiva no registrador: nenhum registo feito. Confirmar manualmente.' } }
  }

  await db.query("UPDATE registrar_operations SET status = 'submitted', attempts = attempts + 1 WHERE id = ?", [op.id])
  let r: OperationResult
  try {
    if (operation === 'register') r = await adapter.register({ domain, years: Math.max(1, opts.years ?? 1), clientRef: op.client_ref, nameservers: opts.nameservers ?? [] })
    else if (operation === 'renew') r = await adapter.renew({ domain, years: Math.max(1, opts.years ?? 1), clientRef: op.client_ref })
    else {
      const authCode = opts.eppEnc ? decryptSecret(opts.eppEnc) : ''
      if (!authCode) { await save('failed', { message: 'Sem código EPP.' }); return { handled: true, outcome: 'manual', message: 'Transferência sem código EPP legível: pedir o código ao cliente.' } }
      r = await adapter.transfer({ domain, authCode, clientRef: op.client_ref })
    }
  } catch (e) {
    const timeout = e instanceof RegistrarTimeout
    await save('unknown', { message: timeout ? 'Pedido sem resposta (timeout).' : (e as Error).message })
    return { handled: true, outcome: 'manual', message: timeout
      ? 'O registrador não respondeu a tempo. Use «Repetir»: o estado é consultado antes de qualquer novo pedido.'
      : 'Falha de ligação ao registrador. Use «Repetir»: o estado é consultado antes de qualquer novo pedido.' }
  }
  if (r.outcome === 'succeeded') { await save('succeeded', r); return { handled: true, outcome: 'succeeded', providerRef: r.providerRef ?? null, message: r.message } }
  if (r.outcome === 'pending') { await save('submitted', r); return { handled: true, outcome: 'pending', message: 'Pedido aceite pelo registrador; a aguardar confirmação. Repita mais tarde para consultar o estado.' } }
  if (r.outcome === 'unknown') { await save('unknown', r); return { handled: true, outcome: 'manual', message: 'Resposta inconclusiva do registrador: o estado é consultado na próxima tentativa.' } }
  await save('failed', r)
  return { handled: true, outcome: 'failed', message: `Recusado pelo registrador: ${clean(r.message)}` }
}

/** Consulta de disponibilidade pelo registrador (se automatizado para a extensão). */
export async function registrarAvailability(domain: string): Promise<'available' | 'unavailable' | 'confirm' | null> {
  const target = await adapterForDomain(domain).catch(() => null)
  if (!target) return null
  try {
    const r = await target.adapter.check(domain)
    return r.status === 'available' ? 'available' : r.status === 'unavailable' ? 'unavailable' : 'confirm'
  } catch { return 'confirm' }
}
