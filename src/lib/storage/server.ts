import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { getPool } from '@/lib/db/pool'
import { siteUrl } from '@/lib/auth/server'

// Armazenamento de ficheiros em disco (substitui o Supabase Storage).
//   STORAGE_DIR                pasta FORA de public/ (ex.: /home/<user>/viralizahost-storage)
//   STORAGE_SIGNING_SECRET     segredo HMAC para URLs assinados (privados e upload)
//   STORAGE_PUBLIC_BASE_URL    (opcional) origem dos URLs públicos; por omissão NEXT_PUBLIC_SITE_URL
//
// Os URLs mantêm o formato do Supabase:
//   público:  <base>/storage/v1/object/public/<bucket>/<path>
//   assinado: <base>/storage/v1/object/sign/<bucket>/<path>?token=...
//   upload:   <base>/storage/v1/object/upload/sign/<bucket>/<path>?token=...

export interface StorageError { message: string; statusCode?: string; name: 'StorageError' }
const se = (message: string, statusCode = '400'): StorageError => ({ message, statusCode, name: 'StorageError' })

export function storageRoot() {
  return resolve(process.env.STORAGE_DIR || join(process.cwd(), 'storage-data'))
}

function signingSecret() {
  const s = process.env.STORAGE_SIGNING_SECRET
  if (!s || s.length < 16) throw new Error('STORAGE_SIGNING_SECRET em falta ou demasiado curto (mín. 16 caracteres)')
  return s
}

export function publicBase() {
  return (process.env.STORAGE_PUBLIC_BASE_URL || siteUrl()).replace(/\/$/, '')
}

/** Valida bucket/caminho e devolve o caminho absoluto no disco. */
export function resolveObjectPath(bucket: string, path: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(bucket)) throw new Error('bucket inválido')
  const clean = String(path ?? '').replace(/^\/+/, '')
  if (!clean || clean.length > 512 || clean.includes('\0') || clean.split('/').some(seg => seg === '..' || seg === '.' || seg === '')) {
    throw new Error('caminho inválido')
  }
  const root = join(storageRoot(), bucket)
  const full = resolve(root, clean)
  if (!full.startsWith(root + sep)) throw new Error('caminho inválido')
  return full
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

// ── Tokens assinados ─────────────────────────────────────────────────────────
type TokenPurpose = 'read' | 'upload'
export function signToken(purpose: TokenPurpose, bucket: string, path: string, expiresInSec: number) {
  const exp = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresInSec))
  const payload = Buffer.from(JSON.stringify({ p: purpose, b: bucket, o: path, e: exp })).toString('base64url')
  const sig = createHmac('sha256', signingSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token: string | null, purpose: TokenPurpose, bucket: string, path: string): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', signingSecret()).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return d.p === purpose && d.b === bucket && d.o === path && d.e >= Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

// ── Buckets ──────────────────────────────────────────────────────────────────
export interface Bucket { id: string; name: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null; created_at: string }

/** O mysql2 já devolve colunas JSON do MariaDB como objecto; aceitar ambos. */
function parseJsonList(v: unknown): string[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as string[]
  try { const p = JSON.parse(String(v)); return Array.isArray(p) ? p : null } catch { return null }
}

export async function getBucket(id: string): Promise<Bucket | null> {
  const [rows] = await getPool().query('SELECT * FROM storage_buckets WHERE id = ?', [id])
  const r = (rows as any[])[0]
  if (!r) return null
  return {
    id: r.id, name: r.id, public: !!r.public, file_size_limit: r.file_size_limit ?? null,
    allowed_mime_types: parseJsonList(r.allowed_mime_types), created_at: r.created_at,
  }
}

async function listBuckets() {
  const [rows] = await getPool().query('SELECT id FROM storage_buckets ORDER BY id')
  const out: Bucket[] = []
  for (const r of rows as { id: string }[]) out.push((await getBucket(r.id))!)
  return out
}

async function createBucket(id: string, opts: { public?: boolean; fileSizeLimit?: number | string; allowedMimeTypes?: string[] } = {}) {
  const limit = typeof opts.fileSizeLimit === 'string' ? parseSize(opts.fileSizeLimit) : opts.fileSizeLimit ?? null
  await getPool().query(
    'INSERT INTO storage_buckets (id, public, file_size_limit, allowed_mime_types) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
    [id, opts.public ? 1 : 0, limit, opts.allowedMimeTypes ? JSON.stringify(opts.allowedMimeTypes) : null],
  )
}

function parseSize(s: string): number | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i)
  if (!m) return null
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] ?? 'b').toLowerCase() as 'b']
  return Math.round(Number(m[1]) * mult)
}

// ── Objectos ─────────────────────────────────────────────────────────────────
type Body = Buffer | Uint8Array | ArrayBuffer | Blob | string

async function toBuffer(body: Body): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (typeof body === 'string') return Buffer.from(body)
  return Buffer.from(await (body as Blob).arrayBuffer())
}

export async function putObject(bucket: string, path: string, body: Body, opts: { contentType?: string; upsert?: boolean; owner?: string | null } = {}) {
  const b = await getBucket(bucket)
  if (!b) return { data: null, error: se('Bucket not found', '404') }
  let full: string
  try { full = resolveObjectPath(bucket, path) } catch (e) { return { data: null, error: se((e as Error).message) } }
  const buf = await toBuffer(body)
  const contentType = opts.contentType || (typeof Blob !== 'undefined' && body instanceof Blob && body.type) || 'application/octet-stream'
  if (b.file_size_limit && buf.length > b.file_size_limit) return { data: null, error: se('The object exceeded the maximum allowed size', '413') }
  if (b.allowed_mime_types?.length && !b.allowed_mime_types.some(m => m === contentType || (m.endsWith('/*') && contentType.startsWith(m.slice(0, -1))))) {
    return { data: null, error: se(`mime type ${contentType} is not supported`, '415') }
  }
  const [existing] = await getPool().query('SELECT id FROM storage_objects WHERE bucket_id = ? AND name = ?', [bucket, path])
  const prev = (existing as { id: string }[])[0]
  if (prev && !opts.upsert) return { data: null, error: se('The resource already exists', '409') }
  await mkdir(dirname(full), { recursive: true })
  const tmp = `${full}.${randomUUID()}.tmp`
  await writeFile(tmp, buf)
  await rename(tmp, full)
  const id = prev?.id ?? randomUUID()
  await getPool().query(
    `INSERT INTO storage_objects (id, bucket_id, name, owner, mime_type, size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size = VALUES(size), sha256 = VALUES(sha256), updated_at = CURRENT_TIMESTAMP(6)`,
    [id, bucket, path, opts.owner ?? null, contentType, buf.length, createHash('sha256').update(buf).digest('hex')],
  )
  return { data: { id, path, fullPath: `${bucket}/${path}` }, error: null }
}

export async function getObjectMeta(bucket: string, path: string) {
  const [rows] = await getPool().query('SELECT * FROM storage_objects WHERE bucket_id = ? AND name = ?', [bucket, path])
  return (rows as { id: string; mime_type: string | null; size: number; updated_at: string; sha256: string | null }[])[0] ?? null
}

async function removeObjects(bucket: string, paths: string[]) {
  const removed: { name: string; bucket_id: string }[] = []
  for (const p of paths) {
    let full: string
    try { full = resolveObjectPath(bucket, p) } catch { continue }
    const [res] = await getPool().query('DELETE FROM storage_objects WHERE bucket_id = ? AND name = ?', [bucket, p])
    await rm(full, { force: true })
    if ((res as { affectedRows: number }).affectedRows) removed.push({ name: p, bucket_id: bucket })
  }
  return { data: removed, error: null as StorageError | null }
}

/** API equivalente a supabase.storage (subconjunto usado pela aplicação). */
export function createStorageApi() {
  return {
    async listBuckets() {
      try { return { data: await listBuckets(), error: null } } catch (e) { return { data: null, error: se((e as Error).message, '500') } }
    },
    async getBucket(id: string) {
      const b = await getBucket(id)
      return b ? { data: b, error: null } : { data: null, error: se('Bucket not found', '404') }
    },
    async createBucket(id: string, opts?: Parameters<typeof createBucket>[1]) {
      try { await createBucket(id, opts); return { data: { name: id }, error: null } } catch (e) { return { data: null, error: se((e as Error).message, '500') } }
    },
    from(bucket: string) {
      return {
        upload: (path: string, body: Body, opts: { contentType?: string; upsert?: boolean; cacheControl?: string } = {}) =>
          putObject(bucket, path, body, opts),
        update: (path: string, body: Body, opts: { contentType?: string } = {}) =>
          putObject(bucket, path, body, { ...opts, upsert: true }),
        remove: (paths: string[]) => removeObjects(bucket, paths),
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${publicBase()}/storage/v1/object/public/${bucket}/${encodePath(path)}` } }
        },
        async createSignedUrl(path: string, expiresIn: number) {
          try {
            resolveObjectPath(bucket, path)
            if (!(await getObjectMeta(bucket, path))) return { data: null, error: se('Object not found', '404') }
            const token = signToken('read', bucket, path, expiresIn)
            return { data: { signedUrl: `${publicBase()}/storage/v1/object/sign/${bucket}/${encodePath(path)}?token=${token}` }, error: null }
          } catch (e) {
            return { data: null, error: se((e as Error).message) }
          }
        },
        async createSignedUploadUrl(path: string) {
          try {
            resolveObjectPath(bucket, path)
            const token = signToken('upload', bucket, path, 2 * 3600)
            return { data: { signedUrl: `${publicBase()}/storage/v1/object/upload/sign/${bucket}/${encodePath(path)}?token=${token}`, token, path }, error: null }
          } catch (e) {
            return { data: null, error: se((e as Error).message) }
          }
        },
        async exists(path: string) {
          try { resolveObjectPath(bucket, path) } catch { return { data: false, error: null } }
          return { data: !!(await getObjectMeta(bucket, path)), error: null }
        },
        async download(path: string) {
          try {
            const meta = await getObjectMeta(bucket, path)
            if (!meta) return { data: null, error: se('Object not found', '404') }
            const buf = await readFile(resolveObjectPath(bucket, path))
            return { data: new Blob([new Uint8Array(buf)], { type: meta.mime_type ?? 'application/octet-stream' }), error: null }
          } catch (e) {
            return { data: null, error: se((e as Error).message, '404') }
          }
        },
        async list(prefix = '', opts: { limit?: number } = {}) {
          const [rows] = await getPool().query(
            'SELECT id, name, size, mime_type, created_at, updated_at FROM storage_objects WHERE bucket_id = ? AND name LIKE ? ORDER BY name LIMIT ?',
            [bucket, `${prefix ? prefix.replace(/\/$/, '') + '/' : ''}%`, opts.limit ?? 100],
          )
          return { data: (rows as any[]).map(r => ({ ...r, name: prefix ? r.name.slice(prefix.replace(/\/$/, '').length + 1) : r.name, metadata: { size: r.size, mimetype: r.mime_type } })), error: null }
        },
      }
    },
  }
}

export async function objectFileStat(bucket: string, path: string) {
  return stat(resolveObjectPath(bucket, path))
}
