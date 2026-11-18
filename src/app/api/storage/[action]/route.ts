import { NextRequest, NextResponse } from 'next/server'
import { ctxFromJar } from '@/lib/db/server-client'
import { BUCKETS, canRead, canWrite, signedUrl, statObject, storageFrom } from '@/lib/storage/server'

/** POST /api/storage/sign | /api/storage/remove — operações de storage pedidas pelo browser. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const body = await req.json().catch(() => ({}))
  const bucket = String(body.bucket ?? '')
  if (!BUCKETS[bucket]) return NextResponse.json({ error: { message: 'Bucket not found', statusCode: '404' } }, { status: 404 })
  const ctx = await ctxFromJar({ get: (n) => req.cookies.get(n) })

  if (action === 'sign') {
    const path = String(body.path ?? '')
    const st = await statObject(bucket, path).catch(() => null)
    if (!st || !(await canRead(ctx, bucket, st.owner, path))) return NextResponse.json({ error: { message: 'Object not found', statusCode: '404' } }, { status: 404 })
    return NextResponse.json({ signedUrl: signedUrl(bucket, path, Number(body.expiresIn) || 3600) })
  }
  if (action === 'remove') {
    if (!canWrite(ctx, bucket) || (ctx.role !== 'authenticated' || ctx.profileRole !== 'admin')) return NextResponse.json({ error: { message: 'Unauthorized', statusCode: '403' } }, { status: 403 })
    const paths = Array.isArray(body.paths) ? body.paths.map(String) : []
    const r = await storageFrom(bucket).remove(paths)
    return NextResponse.json(r.error ? { error: r.error } : { data: r.data })
  }
  return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
}
