import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireAdminRole } from '@/lib/api/require-admin'

const BUCKET = 'site-banners'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp']

function storageClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function ensureBucket(supabase: ReturnType<typeof storageClient>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(b => b.id === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!ALLOWED_MIME.includes(file.type))
      return NextResponse.json({ error: 'Formato não suportado. Use PNG, JPG ou WEBP.' }, { status: 400 })
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: `Ficheiro muito grande. Máximo: 10 MB.` }, { status: 400 })

    const supabase = storageClient()
    await ensureBucket(supabase)

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace('jpg', 'jpeg')
    const storagePath = `banner-pages/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, cacheControl: '31536000', upsert: false })

    if (error) return NextResponse.json({ error: `Erro no upload: ${error.message}` }, { status: 500 })

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return NextResponse.json({ ok: true, publicUrl: urlData?.publicUrl ?? '', storagePath })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: err.status ?? 500 })
  }
}
