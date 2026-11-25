import { RequestsSection } from '@/components/admin/cloud-vps/OpsSections'
export const metadata = { title: 'Solicitações — Cloud VPS' }
export default async function Page({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) { const { pedido } = await searchParams; return <RequestsSection initialRef={pedido ?? null} /> }
