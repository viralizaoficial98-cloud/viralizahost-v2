import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireAdminRole } from '@/lib/api/require-admin'

const BUCKET    = 'site-team'
const MAX_BYTES = 5 * 1024 * 1024   // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function storageAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function ensureBucket(supabase: ReturnType<typeof storageAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(b => b.id === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    })
    if (error) throw new Error(`Não foi possível criar o bucket: ${error.message}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum ficheiro enviado.' }, { status: 400 })

    // Validate MIME type (don't trust extension alone)
    const normalizedMime = file.type === 'image/jpg' ? 'image/jpeg' : file.type
    if (!ALLOWED_MIME.includes(normalizedMime)) {
      return NextResponse.json(
        { error: 'Formato inválido. Utilize JPG, PNG ou WEBP.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `A imagem não pode ultrapassar 5 MB (tamanho actual: ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      )
    }

    const supabase = storageAdminClient()
    await ensureBucket(supabase)

    const ext = normalizedMime === 'image/webp' ? 'webp'
              : normalizedMime === 'image/png'  ? 'png'
              : 'jpeg'

    // Safe, unique path — no path traversal possible
    const storagePath = `members/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: normalizedMime,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      console.error('[team-upload] upload error:', uploadError)
      return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return NextResponse.json({
      ok: true,
      publicUrl:   urlData?.publicUrl ?? '',
      storagePath,
      fileName:    file.name,
      mimeType:    normalizedMime,
      fileSize:    file.size,
      bucket:      BUCKET,
    })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    console.error('[team-upload] error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdminRole()
    const { storagePath } = await req.json()
    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath é obrigatório.' }, { status: 400 })
    }
    // Only delete paths that belong to this bucket (safety check)
    if (!storagePath.startsWith('members/')) {
      return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 })
    }
    const supabase = storageAdminClient()
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
