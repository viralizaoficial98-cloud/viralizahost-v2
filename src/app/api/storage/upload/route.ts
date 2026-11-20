import { NextResponse } from 'next/server'
import { putObject } from '@/lib/storage/server'
import { resolveContext } from '@/lib/db/server-client'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Upload feito no navegador (supabase.storage.from(b).upload()).
// Regras herdadas das políticas storage.objects do Supabase:
//   payment-proofs → INSERT permitido a anon e authenticated
//   restantes buckets → só administradores
const MAX_PUBLIC_UPLOAD = 20 * 1024 * 1024

export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ error: { message: 'Pedido inválido' } }, { status: 400 })
  const bucket = String(fd.get('bucket') ?? '')
  const path = String(fd.get('path') ?? '')
  const file = fd.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: { message: 'Ficheiro em falta' } }, { status: 400 })
  const ctx = await resolveContext('session')
  const isAdmin = ctx.kind === 'user' && ctx.role === 'admin'
  if (bucket !== 'payment-proofs' && !isAdmin) {
    return NextResponse.json({ error: { message: 'new row violates row-level security policy', statusCode: '403' } }, { status: 403 })
  }
  if (!isAdmin) {
    if (!rateLimit(`upload:${clientIp(req)}`, 30, 60 * 60_000)) return NextResponse.json({ error: { message: 'Demasiados envios' } }, { status: 429 })
    if (file.size > MAX_PUBLIC_UPLOAD) return NextResponse.json({ error: { message: 'The object exceeded the maximum allowed size', statusCode: '413' } }, { status: 413 })
  }
  const r = await putObject(bucket, path, file, {
    contentType: String(fd.get('contentType') ?? '') || file.type || undefined,
    // anon não pode substituir ficheiros de outros (no Supabase, upsert exigia UPDATE, que anon não tinha)
    upsert: isAdmin && fd.get('upsert') === 'true',
    owner: ctx.kind === 'user' ? ctx.userId : null,
  })
  if (r.error) return NextResponse.json({ error: r.error }, { status: Number(r.error.statusCode) || 400 })
  return NextResponse.json({ data: r.data })
}
