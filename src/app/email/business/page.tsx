import { redirect } from 'next/navigation'

// Página antiga com recursos que não correspondiam ao catálogo: leva ao plano real (email-standard).
export default function Page() {
  redirect('/comprar/email-standard')
}
