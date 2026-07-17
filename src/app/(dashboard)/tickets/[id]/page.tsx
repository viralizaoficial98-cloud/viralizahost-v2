import { Metadata } from 'next'
import TicketThread from '@/components/tickets/TicketThread'

export const metadata: Metadata = { title: 'Ticket — ViralizaHost' }

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TicketThread ticketId={id} />
}
