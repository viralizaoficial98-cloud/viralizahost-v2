// Textos de estado partilhados (Área do Cliente e painel). Isomórfico.
export const PAYMENT_STATUS: Record<string, { label: string; tone: 'gray' | 'amber' | 'green' | 'red' }> = {
  unpaid: { label: 'Por pagar', tone: 'amber' },
  proof_submitted: { label: 'Comprovativo em análise', tone: 'amber' },
  paid: { label: 'Pago', tone: 'green' },
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
