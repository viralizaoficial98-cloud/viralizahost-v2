import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { getPool } from '@/lib/db/pool'
import { requireAdminRole } from '@/lib/api/require-admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Integrações' }

// Estado das integrações de venda. Mostra apenas se cada requisito existe e o
// NOME da variável/configuração em falta — nunca valores, tokens ou chaves.

type State = 'ok' | 'warn' | 'missing'
interface Check { area: string; state: State; text: string; need?: string; href?: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
async function checks(): Promise<Check[]> {
  const db = getPool()
  const one = async (sql: string, p: unknown[] = []) => ((await db.query(sql, p))[0] as any[])[0] ?? null
  const env = (k: string, min = 1) => (process.env[k]?.length ?? 0) >= min
  const [billing, whm, whmNoPkg, onReq, domainsNoApi, failed, manual, registrar] = await Promise.all([
    one('SELECT iban, account_number, bank_name, tax_rate FROM company_billing_settings WHERE active = 1 LIMIT 1').catch(() => null),
    one("SELECT whm_url IS NOT NULL AND whm_api_token IS NOT NULL AS ok, whm_api_token LIKE 'enc:%' AS enc FROM servers WHERE name = '__whm_config__'").catch(() => null),
    one("SELECT COUNT(*) n, GROUP_CONCAT(slug ORDER BY slug SEPARATOR ', ') s FROM products WHERE provisioning = 'whm' AND sale_status = 'active' AND (whm_package IS NULL OR whm_package = '')"),
    one("SELECT COUNT(*) n FROM products WHERE sale_status = 'on_request' AND active = 1"),
    one("SELECT COUNT(DISTINCT extension) n FROM domain_prices WHERE status = 'active'"),
    one("SELECT COUNT(*) n FROM services WHERE provisioning_status = 'failed'"),
    one("SELECT COUNT(*) n FROM services WHERE provisioning_status = 'manual_required'"),
    one('SELECT provider, mode, enabled, extensions, last_test_ok FROM registrar_settings WHERE id = 1').catch(() => null),
  ])
  const list: Check[] = []
  list.push(billing?.iban || billing?.account_number
    ? { area: 'Transferência bancária', state: 'ok', text: `Dados bancários configurados (${billing.bank_name ?? 'banco'}). Comprovativos validados no painel de Pedidos.` }
    : { area: 'Transferência bancária', state: 'warn', text: 'Sem dados bancários na facturação: o checkout usa os dados por omissão.', need: 'Configurações → Facturação (IBAN/conta)', href: '/admin/settings/billing' })
  list.push({ area: 'Gateway de pagamento (Multicaixa Express / cartão)', state: 'missing', text: 'Nenhum gateway contratado: estes métodos aparecem como indisponíveis no checkout. A rota de notificação assinada já existe.', need: 'Contrato com o gateway + PAYMENT_WEBHOOK_SECRET' })
  list.push(env('PAYMENT_WEBHOOK_SECRET', 32)
    ? { area: 'Notificações de pagamento', state: 'ok', text: 'Segredo de assinatura configurado (≥ 32 caracteres).' }
    : { area: 'Notificações de pagamento', state: 'warn', text: 'A rota /api/payments/webhook recusa pedidos (503) até haver segredo.', need: 'PAYMENT_WEBHOOK_SECRET' })
  list.push(whm?.ok
    ? { area: 'WHM / cPanel', state: Number(whm.enc) ? 'ok' : 'warn', text: Number(whm.enc) ? 'Ligação WHM configurada (token cifrado na base).' : 'Token WHM guardado sem cifra: volte a guardá-lo com WHM_ENCRYPTION_KEY definida.', href: '/admin/settings/integrations/whm' }
    : { area: 'WHM / cPanel', state: 'missing', text: 'Sem WHM: alojamento e e-mail ficam em activação manual.', need: 'Servidor, utilizador e token de API do WHM', href: '/admin/settings/integrations/whm' })
  list.push(Number(whmNoPkg?.n ?? 0) === 0
    ? { area: 'Pacotes WHM por plano', state: 'ok', text: 'Todos os planos com activação WHM têm pacote.' }
    : { area: 'Pacotes WHM por plano', state: 'warn', text: `${whmNoPkg.n} plano(s) à venda sem pacote WHM — são activados manualmente: ${whmNoPkg.s}.`, need: 'Integrações → WHM/cPanel → Plano → pacote', href: '/admin/settings/integrations/whm' })
  list.push(env('WHM_ENCRYPTION_KEY', 64)
    ? { area: 'Cifra de segredos', state: 'ok', text: 'Chave de cifra configurada (token WHM e códigos EPP).' }
    : { area: 'Cifra de segredos', state: 'missing', text: 'Sem chave: transferências de domínio recusadas e token WHM não pode ser lido.', need: 'WHM_ENCRYPTION_KEY (64 hex)' })
  const regExts: string[] = (() => { try { const v = registrar?.extensions; const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : [] } catch { return [] } })()
  list.push(registrar?.enabled
    ? { area: 'Registrador de domínios', state: registrar.mode === 'live' ? 'ok' : 'warn', text: `${registrar.mode === 'live' ? 'Activo em produção' : 'Activo só em modo de ensaio'} (${registrar.provider}): ${regExts.length ? regExts.join(', ') : 'nenhuma extensão'} com registo automático; as restantes ${Math.max(0, Number(domainsNoApi?.n ?? 0) - regExts.length)} ficam manuais.`, href: '/admin/settings/integrations/registrar' }
    : { area: 'Registrador de domínios', state: 'missing', text: `Sem integração activa: ${domainsNoApi?.n ?? 0} extensões à venda com registo/renovação/transferência feitos manualmente pela equipa. Disponibilidade .ao/.co.ao confirmada manualmente.`, need: 'Contrato com registrador/revendedor com API + credenciais', href: '/admin/settings/integrations/registrar' })
  list.push(env('RESEND_API_KEY') && env('RESEND_FROM_EMAIL')
    ? { area: 'E-mail transaccional', state: 'ok', text: 'Chave e remetente configurados. Confirme o domínio no Resend e o estado de entrega na página de diagnóstico.', href: '/admin/settings/integrations/email' }
    : { area: 'E-mail transaccional', state: 'missing', text: 'Sem envio de e-mails: a verificação de conta e a recuperação de senha não chegam aos clientes; facturas ficam só na Área do Cliente.', need: 'RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME', href: '/admin/settings/integrations/email' })
  list.push(Number(billing?.tax_rate ?? 0) > 0
    ? { area: 'Imposto (IVA)', state: 'ok', text: `Taxa aplicada: ${billing.tax_rate}%.` }
    : { area: 'Imposto (IVA)', state: 'warn', text: 'Taxa 0%: os preços não somam IVA. Confirmar com o contabilista o regime aplicável.', need: 'Configurações → Facturação (taxa)', href: '/admin/settings/billing' })
  list.push({ area: 'Planos sob consulta', state: Number(onReq?.n ?? 0) ? 'warn' : 'ok', text: `${onReq?.n ?? 0} plano(s) sem referência pública de preço: mostram «Sob consulta» e não entram no carrinho.`, href: '/admin/site/catalog' })
  list.push({ area: 'Activações pendentes', state: Number(failed?.n ?? 0) ? 'missing' : Number(manual?.n ?? 0) ? 'warn' : 'ok', text: `${failed?.n ?? 0} falhada(s), ${manual?.n ?? 0} manual(is) por concluir.`, href: '/admin/orders?filtro=activacao' })
  return list
}

const ICON = { ok: <CheckCircle2 size={18} className="text-green-600" aria-label="OK" />, warn: <AlertTriangle size={18} className="text-amber-600" aria-label="Atenção" />, missing: <XCircle size={18} className="text-red-600" aria-label="Em falta" /> }

export default async function IntegrationsPage() {
  try { await requireAdminRole() } catch { redirect('/login') }
  const list = await checks()
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">Integrações de venda</h1>
        <p className="text-sm text-[#64748B]">O que está operacional e o que falta para cada serviço ser vendido e activado. Valores secretos nunca são mostrados.</p>
      </div>
      <ul className="space-y-2">
        {list.map(c => (
          <li key={c.area} className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex gap-3" data-testid="integration">
            <span className="mt-0.5">{ICON[c.state]}</span>
            <div className="flex-1">
              <p className="font-bold text-[#0B0B0D]">{c.area}</p>
              <p className="text-sm text-[#334155]">{c.text}</p>
              {c.need && <p className="text-xs text-[#64748B] mt-1">Necessário: <code className="font-mono">{c.need}</code></p>}
            </div>
            {c.href && <Link href={c.href} className="text-xs font-bold underline self-center">Abrir</Link>}
          </li>
        ))}
      </ul>
    </div>
  )
}
