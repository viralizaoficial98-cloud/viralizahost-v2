import { Metadata } from 'next'
import TicketManager from '@/components/tickets/TicketManager'

export const metadata: Metadata = { title: 'Suporte' }

export default function TicketsPage() {
  return <TicketManager />
}
