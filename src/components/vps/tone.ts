import type { VpsClientState } from '@/lib/vps/install-shared'

export const VPS_TONE: Record<VpsClientState, string> = {
  awaiting_payment: 'bg-gray-100 text-gray-700', payment_review: 'bg-amber-50 text-amber-800', preparing: 'bg-blue-50 text-blue-700',
  ready: 'bg-green-50 text-green-700', intervention: 'bg-red-50 text-red-700',
}
