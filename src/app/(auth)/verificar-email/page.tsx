import { VerifyEmailForm } from './VerifyEmailForm'

// Parâmetros lidos no servidor: a mensagem (link expirado, usado, inválido) aparece logo no HTML.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ estado?: string; email?: string }> }) {
  const sp = await searchParams
  return <VerifyEmailForm estado={String(sp.estado ?? '')} initialEmail={String(sp.email ?? '').slice(0, 255)} />
}
