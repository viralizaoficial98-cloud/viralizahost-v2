import type { Metadata } from 'next'
import Link from 'next/link'
import { ShopPage } from '@/components/purchase/ShopPage'
import { listExtensions } from '@/lib/commerce/domain-catalog'

export const metadata: Metadata = { title: 'Preços de Domínios', description: 'Preços de registo, renovação e transferência de domínios na ViralizaHost.' }
export const dynamic = 'force-dynamic'

const kz = (n: number | null) => (n == null ? '—' : n === 0 ? 'Sem custo' : `Kz ${Math.round(n).toLocaleString('pt-PT').replace(/\s/g, '.')}`)

// Tabela pública a partir de domain_prices (mesma fonte do carrinho e do painel).
export default async function PrecosDominiosPage() {
  let exts: Awaited<ReturnType<typeof listExtensions>> | null = null
  try { exts = await listExtensions() } catch { exts = null }
  return (
    <ShopPage title="Preços de domínios" subtitle="Valores por 1 ano, em kwanzas. Registos de 2 ou 3 anos = 1.º ano + renovações.">
      {!exts ? (
        <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert">Não foi possível carregar os preços. Recarregue a página dentro de instantes.</p>
      ) : !exts.length ? (
        <p className="p-4 rounded-xl bg-white border border-[#E8E8E8] text-sm">Ainda não há extensões publicadas.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-xs uppercase text-[#888] border-b border-[#EEE]"><th className="p-3">Extensão</th><th className="p-3">Registo</th><th className="p-3">Renovação</th><th className="p-3">Transferência</th><th className="p-3" /></tr></thead>
            <tbody>
              {exts.map(e => (
                <tr key={e.extension} className="border-b border-[#F3F3F3]">
                  <td className="p-3 font-bold">{e.extension}</td>
                  {e.status === 'active' ? <><td className="p-3">{kz(e.register)}</td><td className="p-3">{kz(e.renew)}</td><td className="p-3">{kz(e.transfer)}</td></> : <td className="p-3 text-[#888]" colSpan={3}>Sob consulta</td>}
                  <td className="p-3 text-right">{e.status === 'active' && <Link href={`/dominios/pesquisar?ext=${encodeURIComponent(e.extension)}`} className="font-bold underline">Pesquisar</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[#888] mt-3">Fontes e cálculo dos preços: referência pública do fornecedor × 2 (ver Termos de Serviço).</p>
    </ShopPage>
  )
}
