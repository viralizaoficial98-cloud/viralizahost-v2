import { getBucket } from '@/lib/storage/server'
import { serveObject } from '@/lib/storage/serve'

export const dynamic = 'force-dynamic'

// Ficheiros de buckets públicos — mesmo caminho que o Supabase Storage usava.
async function handle(req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params
  const b = await getBucket(bucket)
  if (!b?.public) return new Response('Not found', { status: 404 })
  return serveObject(req, bucket, path.map(decodeURIComponent).join('/'), 'public, max-age=31536000, immutable')
}
export const GET = handle
export const HEAD = handle
