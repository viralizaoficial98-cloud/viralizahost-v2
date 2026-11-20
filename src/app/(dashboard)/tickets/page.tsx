import { Metadata } from 'next'
import TicketManager from '@/components/tickets/TicketManager'

export const metadata: Metadata = { title: 'Suporte' }

// ?assunto=… abre o formulário pré-preenchido (ex.: pedido de operação manual num serviço)
export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ assunto?: string }> }) {
  const { assunto } = await searchParams
  return <TicketManager initialSubject={typeof assunto === 'string' ? assunto : ''} />
}
