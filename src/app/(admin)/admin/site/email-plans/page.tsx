import { redirect } from 'next/navigation'

// Os planos de e-mail gerem-se em Catálogo e Preços → E-mail (ficha, preço base e descontos por período,
// em products/product_prices). A antiga tabela site_email_plans só é mantida em sincronia para compatibilidade.
export default function EmailPlansRedirect() {
  redirect('/admin/site/catalog?cat=email')
}
