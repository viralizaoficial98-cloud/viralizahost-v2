import { verifyToken } from '@/lib/storage/server'
import { serveObject } from '@/lib/storage/serve'

export const dynamic = 'force-dynamic'

// URLs assinados (createSignedUrl) para buckets privados, ex.: comprovativos de pagamento.
async function handle(req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params
  const objectPath = path.map(decodeURIComponent).join('/')
  if (!verifyToken(new URL(req.url).searchParams.get('token'), 'read', bucket, objectPath)) {
    return Response.json({ statusCode: '400', error: 'InvalidJWT', message: 'invalid signature or expired' }, { status: 400 })
  }
  return serveObject(req, bucket, objectPath, 'private, max-age=0, no-store')
}
export const GET = handle
export const HEAD = handle
