import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { createClient as createStorageClient } from '@supabase/supabase-js'

function storageAdmin() {
  return createStorageClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminWriteClient()
  const { data: inv, error } = await db
    .from('invoices')
    .select('id, profile_id, proof_file')
    .eq('id', params.id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (error || !inv) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
  if (!inv.proof_file) return NextResponse.json({ error: 'Sem comprovativo.' }, { status: 404 })

  const storage = storageAdmin()
  const { data: signed } = await storage.storage
    .from('payment-proofs')
    .createSignedUrl(inv.proof_file, 3600)

  if (!signed?.signedUrl) return NextResponse.json({ error: 'Erro ao gerar URL.' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}
