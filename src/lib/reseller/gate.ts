import 'server-only'
import type { Queryable } from '@/lib/db/pool'
import { getResellerSettings } from './settings'
import { eligibility, listServers, planNeed } from './infra'
import { getProfile } from './profiles'

// Bloqueio da contratação de Revenda na cotação/checkout (quote.ts chama isto para cada linha de revenda).
// Aplicado no SERVIDOR: o carrinho, a página e o navegador nunca decidem.
//   disabled      → recusa
//   test          → só administradores, e só com capacidade num servidor de teste
//   request_only  → recusa (a contratação passa pelo pedido; só a encomenda criada pelo painel, a partir de um
//                    pedido tecnicamente aprovado, é aceite — resellerRequestId)
//   automatic     → só com autorização expressa + aprovação técnica + capacidade num servidor autorizado
// As renovações de serviços já activos não passam por aqui (continuam permitidas).

/* eslint-disable @typescript-eslint/no-explicit-any */
export const GATE_MSG: Record<string, string> = {
  reseller_disabled: 'A contratação de revenda está temporariamente indisponível.',
  reseller_request_only: 'A revenda é contratada mediante pedido e aprovação técnica: use «Solicitar contratação» na página da Revenda.',
  reseller_test_admin_only: 'Revenda em modo de teste: contratação reservada a administradores.',
  reseller_no_capacity: 'Sem capacidade técnica disponível para novos revendedores neste momento: envie um pedido de contratação.',
  reseller_profile_incomplete: 'Plano de revenda sem perfil técnico completo: contratação indisponível.',
  reseller_request_mismatch: 'Pedido de revenda inválido para esta encomenda.',
}

export async function resellerGate(db: Queryable, p: { productId: string; cycle: string; userId?: string | null; requestId?: string | null }): Promise<string | null> {
  const s = await getResellerSettings(db)
  if (s.mode === 'disabled') return 'reseller_disabled'
  if (p.requestId) {
    const [[r]] = await db.query('SELECT product_id, cycle, profile_id, status FROM reseller_requests WHERE id = ?', [p.requestId]) as any
    const ok = r && r.product_id === p.productId && r.cycle === p.cycle && r.profile_id && r.profile_id === p.userId && ['technically_approved', 'awaiting_payment'].includes(r.status)
    return ok ? null : 'reseller_request_mismatch'
  }
  const [[u]] = p.userId ? await db.query('SELECT role FROM profiles WHERE id = ?', [p.userId]) as any : [[null]]
  const isAdmin = u?.role === 'admin'
  if (s.mode === 'test' && !isAdmin) return 'reseller_test_admin_only'
  if (s.mode === 'request_only') return 'reseller_request_only'
  if (s.mode === 'automatic' && !s.automaticReady) return 'reseller_request_only'
  const prof = await getProfile(p.productId, db)
  if (!prof?.complete) return 'reseller_profile_incomplete'
  const need = planNeed({ storage_mb: prof.storageMb, main_quota_mb: prof.mainQuotaMb, max_accounts: prof.maxAccounts })
  const servers = await listServers(db)
  const fit = servers.some(sv => eligibility(sv, need, { mode: s.mode, planServerIds: prof.serverIds }).length === 0)
  return fit ? null : 'reseller_no_capacity'
}
