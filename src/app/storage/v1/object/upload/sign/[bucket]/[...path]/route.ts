import { putObject, verifyToken } from '@/lib/storage/server'

export const dynamic = 'force-dynamic'

// Upload com URL assinado (createSignedUploadUrl) — usado no envio do vídeo da página inicial.
// Aceita o corpo em multipart (campo de ficheiro) ou binário, como o Supabase.
async function handle(req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params
  const objectPath = path.map(decodeURIComponent).join('/')
  if (!verifyToken(new URL(req.url).searchParams.get('token'), 'upload', bucket, objectPath)) {
    return Response.json({ statusCode: '400', error: 'InvalidJWT', message: 'invalid signature or expired' }, { status: 400 })
  }
  let body: Blob
  let contentType = req.headers.get('content-type') ?? 'application/octet-stream'
  if (contentType.startsWith('multipart/form-data')) {
    const fd = await req.formData()
    const file = [...fd.values()].find((v): v is File => typeof v !== 'string')
    if (!file) return Response.json({ statusCode: '400', error: 'Bad Request', message: 'ficheiro em falta' }, { status: 400 })
    body = file
    contentType = file.type || 'application/octet-stream'
  } else {
    body = await req.blob()
  }
  const upsert = req.headers.get('x-upsert') === 'true'
  const r = await putObject(bucket, objectPath, body, { contentType, upsert })
  if (r.error) return Response.json({ statusCode: r.error.statusCode, error: r.error.message, message: r.error.message }, { status: Number(r.error.statusCode) || 400 })
  return Response.json({ Key: `${bucket}/${objectPath}`, Id: r.data!.id })
}
export const PUT = handle
export const POST = handle
