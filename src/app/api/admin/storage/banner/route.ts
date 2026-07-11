import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'site-banners'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp']

// Plain service-role client without db.schema (Storage API doesn't use it)
function storageAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function ensureBucket(supabase: ReturnType<typeof storageAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.id === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    })
    if (error) throw new Error(`Cannot create bucket: ${error.message}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não suportado. Use PNG, JPG ou WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Ficheiro muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.` }, { status: 400 })
    }

    const supabase = storageAdminClient()
    await ensureBucket(supabase)

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace('jpg', 'jpeg')
    const storagePath = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData?.publicUrl ?? ''

    return NextResponse.json({
      ok: true,
      publicUrl,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      bucket: BUCKET,
    })
  } catch (err: any) {
    console.error('[banner-upload]', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { storagePath } = await req.json()
    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath required' }, { status: 400 })
    }
    const supabase = storageAdminClient()
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
