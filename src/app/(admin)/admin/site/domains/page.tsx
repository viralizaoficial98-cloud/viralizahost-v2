import { redirect } from 'next/navigation'

// A gestão das extensões e dos cartões de domínio está em Catálogo e Preços → Domínios
// (preços em domain_prices, apresentação em domain_extensions). A antiga tabela site_domains já não é usada.
export default function DomainsRedirect() {
  redirect('/admin/site/catalog?cat=dominios')
}
