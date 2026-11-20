import 'server-only'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { getObjectMeta, objectFileStat, resolveObjectPath } from './server'

/** Serve um objecto com suporte a Range (necessário para <video> em Safari/iOS). */
export async function serveObject(req: Request, bucket: string, path: string, cache: string): Promise<Response> {
  let full: string
  try { full = resolveObjectPath(bucket, path) } catch { return new Response('Not found', { status: 404 }) }
  const meta = await getObjectMeta(bucket, path)
  if (!meta) return new Response('Not found', { status: 404 })
  let size: number
  try { size = (await objectFileStat(bucket, path)).size } catch { return new Response('Not found', { status: 404 }) }
  const headers: Record<string, string> = {
    'Content-Type': meta.mime_type || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  }
  if (meta.sha256) headers.ETag = `"${meta.sha256.slice(0, 32)}"`
  if (headers.ETag && req.headers.get('if-none-match') === headers.ETag) return new Response(null, { status: 304, headers })
  const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    start = Math.max(0, start); end = Math.min(end, size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`
    headers['Content-Length'] = String(end - start + 1)
    if (req.method === 'HEAD') return new Response(null, { status: 206, headers })
    return new Response(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, { status: 206, headers })
  }
  headers['Content-Length'] = String(size)
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, { status: 200, headers })
}
