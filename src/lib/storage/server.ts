import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Substituto do Supabase Storage: ficheiros no disco do servidor (STORAGE_ROOT)
// e metadados na tabela storage_objects. URLs compatíveis com o formato antigo:
//   público:  {SITE}/storage/v1/object/public/<bucket>/<caminho>
//   assinado: {SITE}/storage/v1/object/sign/<bucket>/<caminho>?token=...
//   envio:    {SITE}/storage/v1/object/upload/sign/<bucket>/<caminho>?token=...
import { promises as fs, createReadStream, type Stats } from 'node:fs'
import { dirname, join, normalize, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { sql } from '@/lib/db/pool'
import { signToken, verifyToken } from '@/lib/auth/token'
import type { AuthCtx } from '@/lib/db/policies'

export interface BucketConfig { public: boolean; maxBytes: number; mime?: string[] }

/** Buckets usados pela aplicação (mesmas regras dos buckets do Supabase). */
export const BUCKETS: Record<string, BucketConfig> = {
  'site-banners': { public: true, maxBytes: 10 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'] },
  'site-team': { public: true, maxBytes: 10 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] },
  'site-videos': { public: true, maxBytes: 100 * 1024 * 1024, mime: ['video/mp4'] },
  'payment-proofs': { public: false, maxBytes: 20 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'] },
  'invoices': { public: false, maxBytes: 20 * 1024 * 1024, mime: ['application/pdf'] },
}

export const storageRoot = () => process.env.STORAGE_ROOT || '/var/www/viralizahost-storage'
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://viralizahost.com').replace(/\/$/, '')

export class StorageFailure extends Error { constructor(message: string, public statusCode = 400) { super(message) } }

/** Valida bucket + caminho e devolve o caminho absoluto no disco (impede "../"). */
export function resolveObject(bucket: string, path: string): string {
  if (!BUCKETS[bucket]) throw new StorageFailure('Bucket not found', 404)
  const clean = String(path ?? '').replace(/^\/+/, '')
  if (!clean || clean.includes('\0') || clean.split('/').some((s) => s === '..' || s === '.')) throw new StorageFailure('Invalid key', 400)
  const root = join(/*turbopackIgnore: true*/ storageRoot(), bucket)
  const abs = normalize(join(/*turbopackIgnore: true*/ root, clean))
  if (!abs.startsWith(root + sep)) throw new StorageFailure('Invalid key', 400)
  return abs
}

export const publicUrl = (bucket: string, path: string) =>
  `${siteUrl()}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`

export function signedUrl(bucket: string, path: string, expiresIn: number, download?: string | boolean) {
  const token = signToken({ typ: 'storage', sub: `${bucket}/${path}`, v: download ? String(download) : '' }, Math.max(1, Math.floor(expiresIn)))
  return `${siteUrl()}/storage/v1/object/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}`
}

export function verifySigned(kind: 'storage' | 'upload', bucket: string, path: string, token: string | null) {
  const p = verifyToken(token, kind)
  return !!p && p.sub === `${bucket}/${path}` ? p : null
}

type Body = Buffer | Uint8Array | ArrayBuffer | Blob | string

async function toBuffer(body: Body): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (typeof body === 'string') return Buffer.from(body)
  return Buffer.from(await (body as Blob).arrayBuffer())
}

export async function putObject(bucket: string, path: string, body: Body, opts: { contentType?: string; upsert?: boolean; owner?: string | null } = {}) {
  const cfg = BUCKETS[bucket]
  const abs = resolveObject(bucket, path)
  const buf = await toBuffer(body)
  const contentType = opts.contentType || (body as Blob)?.type || 'application/octet-stream'
  if (buf.length > cfg.maxBytes) throw new StorageFailure('The object exceeded the maximum allowed size', 413)
  if (cfg.mime && !cfg.mime.includes(contentType)) throw new StorageFailure(`mime type ${contentType} is not supported`, 415)
  const exists = await fs.stat(abs).then(() => true, () => false)
  if (exists && !opts.upsert) throw new StorageFailure('The resource already exists', 409)
  await fs.mkdir(dirname(abs), { recursive: true })
  const tmp = `${abs}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, buf)
  await fs.rename(tmp, abs)
  await sql(
    `INSERT INTO storage_objects (id, bucket_id, name, owner, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE owner = COALESCE(VALUES(owner), owner), mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), updated_at = UTC_TIMESTAMP(6)`,
    [randomUUID(), bucket, path, opts.owner ?? null, contentType, buf.length],
  )
  return { path, id: path, fullPath: `${bucket}/${path}` }
}

export async function statObject(bucket: string, path: string): Promise<{ abs: string; stat: Stats; mime: string; owner: string | null } | null> {
  const abs = resolveObject(bucket, path)
  const stat = await fs.stat(abs).catch(() => null)
  if (!stat || !stat.isFile()) return null
  const meta = (await sql<{ mime_type: string | null; owner: string | null }>('SELECT mime_type, owner FROM storage_objects WHERE bucket_id = ? AND name = ? LIMIT 1', [bucket, path]))[0]
  return { abs, stat, mime: meta?.mime_type || guessMime(path), owner: meta?.owner ?? null }
}

export function streamObject(abs: string, range?: { start: number; end: number }) {
  return createReadStream(abs, range)
}

function guessMime(p: string) {
  const ext = p.split('.').pop()?.toLowerCase()
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}

/** Leitura de ficheiros privados por utilizadores (equivalente às políticas de storage.objects). */
export async function canRead(ctx: AuthCtx, bucket: string, owner: string | null, path: string): Promise<boolean> {
  if (BUCKETS[bucket]?.public || ctx.role === 'service') return true
  if (ctx.role !== 'authenticated') return false
  if (ctx.profileRole === 'admin') return true
  if (owner && owner === ctx.uid) return true
  if (bucket === 'payment-proofs') {
    const rows = await sql('SELECT 1 FROM payments WHERE profile_id = ? AND proof_url = ? UNION SELECT 1 FROM invoices WHERE profile_id = ? AND proof_file = ? UNION SELECT 1 FROM orders WHERE user_id = ? AND proof_file = ? LIMIT 1', [ctx.uid, path, ctx.uid, path, ctx.uid, path])
    return rows.length > 0
  }
  if (bucket === 'invoices') {
    const rows = await sql('SELECT 1 FROM invoices WHERE profile_id = ? AND pdf_storage_path = ? LIMIT 1', [ctx.uid, path])
    return rows.length > 0
  }
  return false
}

/** Escrita a partir do browser: só payment-proofs (checkout, também anónimo) ou admin. */
export function canWrite(ctx: AuthCtx, bucket: string): boolean {
  if (ctx.role === 'service') return true
  if (ctx.role === 'authenticated' && ctx.profileRole === 'admin') return true
  return bucket === 'payment-proofs'
}

type R<T> = Promise<{ data: T | null; error: { message: string; statusCode: string } | null }>
const err = (e: unknown) => ({ data: null, error: { message: (e as Error).message, statusCode: String((e as StorageFailure).statusCode ?? 500) } })

/** API no formato supabase.storage.from(bucket) (papel service). */
export function storageFrom(bucket: string, owner: string | null = null) {
  return {
    async upload(path: string, body: Body, opts: { contentType?: string; upsert?: boolean; cacheControl?: string } = {}): R<{ path: string; id: string; fullPath: string }> {
      try { return { data: await putObject(bucket, path, body, { ...opts, owner }), error: null } } catch (e) { return err(e) }
    },
    async update(path: string, body: Body, opts: { contentType?: string } = {}) { return this.upload(path, body, { ...opts, upsert: true }) },
    async download(path: string): R<Blob> {
      try {
        const st = await statObject(bucket, path)
        if (!st) throw new StorageFailure('Object not found', 404)
        return { data: new Blob([await fs.readFile(st.abs)], { type: st.mime }), error: null }
      } catch (e) { return err(e) }
    },
    async remove(paths: string[]): R<{ name: string }[]> {
      try {
        const out: { name: string }[] = []
        for (const p of paths) {
          const abs = resolveObject(bucket, p)
          await fs.rm(abs, { force: true })
          await sql('DELETE FROM storage_objects WHERE bucket_id = ? AND name = ?', [bucket, p])
          out.push({ name: p })
        }
        return { data: out, error: null }
      } catch (e) { return err(e) }
    },
    getPublicUrl(path: string) { return { data: { publicUrl: publicUrl(bucket, path) } } },
    async exists(path: string): R<boolean> {
      try { return { data: !!(await statObject(bucket, path)), error: null } } catch (e) { return err(e) }
    },
    async createSignedUrl(path: string, expiresIn: number, opts: { download?: string | boolean } = {}): R<{ signedUrl: string }> {
      try { resolveObject(bucket, path); return { data: { signedUrl: signedUrl(bucket, path, expiresIn, opts.download) }, error: null } } catch (e) { return err(e) }
    },
    async createSignedUrls(paths: string[], expiresIn: number): R<{ path: string; signedUrl: string; error: null }[]> {
      try { return { data: paths.map((p) => ({ path: p, signedUrl: signedUrl(bucket, p, expiresIn), error: null })), error: null } } catch (e) { return err(e) }
    },
    async createSignedUploadUrl(path: string): R<{ signedUrl: string; token: string; path: string }> {
      try {
        resolveObject(bucket, path)
        const token = signToken({ typ: 'upload', sub: `${bucket}/${path}`, v: owner ?? '' }, 2 * 60 * 60)
        const signed = `${siteUrl()}/storage/v1/object/upload/sign/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}`
        return { data: { signedUrl: signed, token, path }, error: null }
      } catch (e) { return err(e) }
    },
    async list(prefix = '', opts: { limit?: number; offset?: number } = {}): R<{ name: string; id: string; metadata: { size: number; mimetype: string } }[]> {
      try {
        const rows = await sql<{ name: string; id: string; size_bytes: number; mime_type: string }>(
          'SELECT id, name, size_bytes, mime_type FROM storage_objects WHERE bucket_id = ? AND name LIKE ? ORDER BY name LIMIT ? OFFSET ?',
          [bucket, `${prefix ? prefix.replace(/\/$/, '') + '/' : ''}%`, opts.limit ?? 100, opts.offset ?? 0])
        return { data: rows.map((r) => ({ name: prefix ? r.name.slice(prefix.replace(/\/$/, '').length + 1) : r.name, id: r.id, metadata: { size: Number(r.size_bytes), mimetype: r.mime_type } })), error: null }
      } catch (e) { return err(e) }
    },
  }
}

type StorageErr = { message: string; statusCode: string } | null

export const storageApi = {
  from: (bucket: string) => storageFrom(bucket),
  async listBuckets(): Promise<{ data: { id: string; name: string; public: boolean; file_size_limit: number; allowed_mime_types: string[] | null }[] | null; error: StorageErr }> { return { data: Object.entries(BUCKETS).map(([id, b]) => ({ id, name: id, public: b.public, file_size_limit: b.maxBytes, allowed_mime_types: b.mime ?? null })), error: null } },
  async getBucket(id: string) { const b = BUCKETS[id]; return b ? { data: { id, name: id, public: b.public }, error: null } : { data: null, error: { message: 'Bucket not found', statusCode: '404' } } },
  async createBucket(id: string, _opts?: Record<string, unknown>): Promise<{ data: { name: string } | null; error: StorageErr }> { return BUCKETS[id] ? { data: { name: id }, error: null } : { data: null, error: { message: `Bucket ${id} não está configurado em src/lib/storage/server.ts`, statusCode: '400' } } },
}
