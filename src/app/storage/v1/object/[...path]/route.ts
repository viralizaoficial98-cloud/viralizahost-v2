import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { ctxFromJar } from '@/lib/db/server-client'
import { BUCKETS, StorageFailure, canRead, canWrite, putObject, statObject, streamObject, verifySigned } from '@/lib/storage/server'

/*
 * Servidor de ficheiros compatível com os URLs do Supabase Storage:
 *   GET  /storage/v1/object/public/<bucket>/<caminho>            (buckets públicos)
 *   GET  /storage/v1/object/sign/<bucket>/<caminho>?token=        (URL assinado)
 *   GET  /storage/v1/object/authenticated/<bucket>/<caminho>      (sessão + permissão)
 *   POST /storage/v1/object/<bucket>/<caminho>                    (envio pelo browser)
 *   PUT  /storage/v1/object/upload/sign/<bucket>/<caminho>?token= (envio com URL assinado)
 * Suporta pedidos Range (necessário para o vídeo da página inicial).
 */
export const dynamic = 'force-dynamic'

type P = { params: Promise<{ path: string[] }> }
const j = (message: string, status: number) => NextResponse.json({ statusCode: String(status), error: message, message }, { status })

async function serve(req: NextRequest, bucket: string, path: string, cache: string) {
  const st = await statObject(bucket, path)
  if (!st) return j('Object not found', 404)
  const size = st.stat.size
  const headers: Record<string, string> = {
    'Content-Type': st.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': cache,
    'Last-Modified': st.stat.mtime.toUTCString(), 'X-Content-Type-Options': 'nosniff',
  }
  if (st.mime === 'application/pdf' || st.mime.startsWith('image/svg')) headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'"
  const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  if (range) {
    let start = range[1] ? Number(range[1]) : NaN
    let end = range[2] ? Number(range[2]) : size - 1
    if (isNaN(start)) { start = Math.max(0, size - end); end = size - 1 }
    if (start >= size || end < start) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    end = Math.min(end, size - 1)
    const stream = Readable.toWeb(streamObject(st.abs, { start, end })) as ReadableStream
    return new NextResponse(stream, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } })
  }
  if (req.method === 'HEAD') return new NextResponse(null, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
  return new NextResponse(Readable.toWeb(streamObject(st.abs)) as ReadableStream, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
}

export async function GET(req: NextRequest, { params }: P) {
  const [kind, bucket, ...rest] = (await params).path
  const path = rest.map(decodeURIComponent).join('/')
  try {
    if (!BUCKETS[bucket]) return j('Bucket not found', 404)
    if (kind === 'public') {
      if (!BUCKETS[bucket].public) return j('Object not found', 404)
      return await serve(req, bucket, path, 'public, max-age=31536000, immutable')
    }
    if (kind === 'sign') {
      if (!verifySigned('storage', bucket, path, req.nextUrl.searchParams.get('token'))) return j('Invalid or expired signature', 400)
      return await serve(req, bucket, path, 'private, max-age=300')
    }
    if (kind === 'authenticated') {
      const ctx = await ctxFromJar({ get: (n) => req.cookies.get(n) })
      const st = await statObject(bucket, path)
      if (!st || !(await canRead(ctx, bucket, st.owner, path))) return j('Object not found', 404)
      return await serve(req, bucket, path, 'private, no-store')
    }
    return j('Not found', 404)
  } catch (e) {
    return j((e as Error).message, e instanceof StorageFailure ? e.statusCode : 500)
  }
}
export const HEAD = GET

async function readUpload(req: NextRequest): Promise<{ body: Blob; type: string }> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    const file = [...fd.values()].find((v): v is File => typeof v !== 'string')
    if (!file) throw new StorageFailure('Ficheiro em falta no envio', 400)
    return { body: file, type: file.type || 'application/octet-stream' }
  }
  const blob = await req.blob()
  return { body: blob, type: ct.split(';')[0] || 'application/octet-stream' }
}

async function upload(req: NextRequest, { params }: P) {
  const segs = (await params).path
  try {
    // envio com URL assinado (painel admin → vídeo da página inicial)
    if (segs[0] === 'upload' && segs[1] === 'sign') {
      const [, , bucket, ...rest] = segs
      const path = rest.map(decodeURIComponent).join('/')
      if (!verifySigned('upload', bucket, path, req.nextUrl.searchParams.get('token'))) return j('Invalid or expired signature', 400)
      const { body, type } = await readUpload(req)
      const r = await putObject(bucket, path, body, { contentType: type, upsert: req.headers.get('x-upsert') === 'true' })
      return NextResponse.json({ Key: r.fullPath, Id: r.id, path: r.path })
    }
    // envio direto pelo browser com a sessão (checkout → comprovativo de pagamento)
    const [bucket, ...rest] = segs
    const path = rest.map(decodeURIComponent).join('/')
    const ctx = await ctxFromJar({ get: (n) => req.cookies.get(n) })
    if (!canWrite(ctx, bucket)) return j('new row violates row-level security policy', 403)
    const uid = ctx.role === 'authenticated' ? ctx.uid : null
    const existing = await statObject(bucket, path)
    if (existing && !(ctx.role === 'authenticated' && (ctx.profileRole === 'admin' || existing.owner === uid))) return j('The resource already exists', 409)
    const { body, type } = await readUpload(req)
    const r = await putObject(bucket, path, body, { contentType: type, upsert: req.headers.get('x-upsert') === 'true', owner: uid })
    return NextResponse.json({ Key: r.fullPath, Id: r.id, path: r.path })
  } catch (e) {
    return j((e as Error).message, e instanceof StorageFailure ? e.statusCode : 500)
  }
}
export const POST = upload
export const PUT = upload
