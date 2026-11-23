// Textos de estado partilhados (Área do Cliente e painel). Isomórfico.
export const PAYMENT_STATUS: Record<string, { label: string; tone: 'gray' | 'amber' | 'green' | 'red' }> = {
  unpaid: { label: 'Por pagar', tone: 'amber' },
  proof_submitted: { label: 'Comprovativo por validar', tone: 'amber' },
  paid: { label: 'Paga', tone: 'green' },
  failed: { label: 'Pagamento recusado', tone: 'red' },
  refunded: { label: 'Reembolsado', tone: 'gray' },
}
export const ACTIVATION_STATUS: Record<string, { label: string; tone: 'gray' | 'amber' | 'green' | 'red' }> = {
  pending: { label: 'A aguardar pagamento', tone: 'gray' },
  in_progress: { label: 'Em activação', tone: 'amber' },
  active: { label: 'Activo', tone: 'green' },
  partial: { label: 'Parcialmente activo', tone: 'amber' },
  manual_required: { label: 'Activação manual pela equipa', tone: 'amber' },
  failed: { label: 'Falha na activação — a equipa foi notificada', tone: 'red' },
  cancelled: { label: 'Cancelado', tone: 'gray' },
}
export const TONE_CLASS = {
  gray: 'bg-gray-100 text-gray-700', amber: 'bg-amber-50 text-amber-800', green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700',
} as const
export const kz = (n: number | string | null | undefined) =>
  `Kz ${Number(n ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, ' ')}`

/**
 * Estado do DOMÍNIO de um item (independente do estado do pagamento): uma encomenda pode estar «Paga»
 * enquanto o domínio continua «A confirmar pela equipa». Só passa a «Registado» com o registo confirmado.
 */
export function domainState(it: { availability?: string | null; domain_case?: string | null }, svc?: { provisioning_status?: string | null } | null): { key: string; label: string; tone: 'gray' | 'amber' | 'green' | 'red' } {
  if (svc?.provisioning_status === 'active') return { key: 'registered', label: 'Registado', tone: 'green' }
  if (it.domain_case === 'alternative') return { key: 'alternative', label: 'Indisponível — outro domínio proposto', tone: 'amber' }
  if (it.domain_case === 'refund_manual') return { key: 'refund', label: 'Indisponível — reembolso em tratamento', tone: 'red' }
  if (it.domain_case === 'manual_review') return { key: 'review', label: 'Indisponível — em tratamento pela equipa', tone: 'red' }
  if (it.availability === 'unavailable') return { key: 'unavailable', label: it.domain_case === 'resolved' ? 'Indisponível — caso encerrado' : 'Indisponível', tone: it.domain_case === 'resolved' ? 'gray' : 'red' }
  if (it.availability === 'confirm') return { key: 'confirm', label: 'A confirmar pela equipa', tone: 'amber' }
  if (it.availability === 'confirmed') return { key: 'confirmed', label: 'Confirmado — por registar', tone: 'amber' }
  return { key: 'to_register', label: 'Por registar', tone: 'gray' }
}

/** Estado da activação: encomenda paga com domínio por confirmar/em tratamento espera pela equipa, não pelo pagamento. */
export function activationState(o: { payment_status: string; activation_status: string }, items: { availability?: string | null; domain_case?: string | null }[]) {
  const review = items.some(i => ['manual_review', 'alternative', 'refund_manual'].includes(i.domain_case ?? ''))
  const pending = items.some(i => i.availability === 'confirm')
  if (o.payment_status === 'paid' && o.activation_status === 'pending' && (review || pending))
    return { label: review ? 'Domínio em tratamento pela equipa' : 'A aguardar confirmação do domínio', tone: 'amber' as const }
  if (o.payment_status === 'paid' && o.activation_status === 'pending' && items.some(i => i.availability === 'unavailable'))
    return { label: 'Domínio indisponível', tone: 'gray' as const }
  return ACTIVATION_STATUS[o.activation_status] ?? ACTIVATION_STATUS.pending
}
