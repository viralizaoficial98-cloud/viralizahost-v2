import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPool } from '@/lib/db/pool'

// «A partir de …» das páginas de serviço, calculado do catálogo (product_prices),
// nunca de texto fixo: menor equivalente mensal entre os planos à venda.
const load = unstable_cache(async (category: string, subcategory: string | null) => {
  try {
    const [r] = await getPool().query(
      `SELECT MIN(pp.price / pp.months) AS m, SUM(p.sale_status = 'on_request') AS onreq, SUM(p.sale_status = 'active') AS act
         FROM products p LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.active = 1 AND p.sale_status = 'active'
           AND (p.category NOT IN ('reseller', 'website-builder') AND NOT (p.category = 'wordpress' AND p.subcategory = 'builder')
                OR pp.cycle IN ('monthly', '1year', '2years', '3years')) -- famílias de planos: só os 4 períodos à venda
        WHERE p.active = 1 AND p.category = ? AND ${subcategory ? 'p.subcategory = ?' : 'p.subcategory IS NULL'}`,
      subcategory ? [category, subcategory] : [category],
    ) as unknown as [{ m: number | null; onreq: number | null; act: number | null }[]]
    const row = r[0]
    if (row?.m != null) return `A partir de Kz ${Math.round(Number(row.m)).toLocaleString('pt-PT').replace(/\s/g, '.')}/mês`
    if (Number(row?.onreq ?? 0) > 0) return 'Preço sob consulta'
    return null
  } catch { return null }
}, ['catalog-from-price'], { revalidate: 300, tags: ['catalog'] })

export const fromPriceText = (category: string, subcategory: string | null = null) => load(category, subcategory)
