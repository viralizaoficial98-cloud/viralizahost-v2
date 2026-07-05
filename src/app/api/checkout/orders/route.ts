import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createRpcClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items, billingCycle, domainName, domainAction,
      paymentMethod, proofFileUrl, transferRef,
      userData, amount,
    } = body

    console.log('[checkout/orders] START — paymentMethod:', paymentMethod, 'amount:', amount)

    // ── 1. Resolve authenticated user ──────────────────────────────────────
    // createAuthClient has NO db.schema — auth.getUser() must never send
    // a Content-Profile header; that belongs only to PostgREST table queries.
    const authClient = await createAuthClient()
    const { data: { user: sessionUser }, error: authErr } = await authClient.auth.getUser()

    console.log('[checkout/orders] auth.getUser —', sessionUser?.id ?? 'no session', authErr?.message ?? 'ok')

    const db = await createAdminClient() // for profile upsert (table query, viralizahost schema)
    let userId: string | null = sessionUser?.id ?? null

    // ── 2. Create account if user arrived as guest ─────────────────────────
    if (!userId && userData?.email && userData?.password) {
      console.log('[checkout/orders] creating guest account for', userData.email)
      const { data: newUser, error: signUpErr } = await db.auth.admin.createUser({
        email:         userData.email,
        password:      userData.password,
        email_confirm: true,
        user_metadata: { full_name: userData.name, phone: userData.phone },
      })

      if (signUpErr) {
        console.error('[checkout/orders] signup error:', signUpErr.message)
        return NextResponse.json({ error: `Erro ao criar conta: ${signUpErr.message}` }, { status: 400 })
      }

      userId = newUser?.user?.id ?? null

      if (userId) {
        await (db as any).from('profiles').upsert({
          id:             userId,
          email:          userData.email,
          full_name:      userData.name,
          phone:          userData.phone ?? null,
          country:        'AO',
          role:           'client',
          currency:       'AKZ',
          is_active:      true,
          email_verified: false,
        }, { onConflict: 'id' })
      }
    }

    if (!userId) {
      console.error('[checkout/orders] no userId — aborting')
      return NextResponse.json(
        { error: 'Sessão inválida. Faça login e tente novamente.' },
        { status: 401 }
      )
    }

    // ── 3. Map payment method ──────────────────────────────────────────────
    const paymentMap: Record<string, string> = {
      pix:          'pix',
      card:         'credit_card',
      paypal:       'paypal',
      bic_transfer: 'bank_transfer',
    }
    const dbPayment = paymentMap[paymentMethod] ?? 'bank_transfer'
    const status    = paymentMethod === 'bic_transfer' ? 'aguardando_confirmacao' : 'pending'

    // ── 4. Build items payload ─────────────────────────────────────────────
    const rpcItems = (items ?? []).map((item: any) => ({
      service_name: item.name,
      service_type: item.type,
      price:        Math.round(item.price),
      quantity:     item.quantity ?? 1,
    }))

    console.log('[checkout/orders] CALLING RPC create_order — userId:', userId, 'items:', rpcItems.length)

    // ── 5. Call RPC via rpcClient (NO db.schema) ───────────────────────────
    // public.create_order uses SECURITY DEFINER + SET search_path = viralizahost
    // so it operates on viralizahost tables without PostgREST needing the schema exposed.
    const rpcClient = createRpcClient()
    const { data, error: rpcErr } = await rpcClient.rpc('create_order', {
      p_user_id:        userId,
      p_billing_cycle:  billingCycle  ?? 'monthly',
      p_domain_name:    domainName    ?? '',
      p_domain_action:  domainAction  ?? '',
      p_payment_method: dbPayment,
      p_amount:         Math.round(amount ?? 0),
      p_proof_file:     proofFileUrl  ?? '',
      p_transfer_ref:   transferRef   ?? '',
      p_status:         status,
      p_items:          rpcItems,
    })

    if (rpcErr) {
      console.error('[checkout/orders] RPC error:', rpcErr.message, rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const orderId = (data as any)?.id
    console.log('[checkout/orders] ORDER CREATED — id:', orderId, 'status:', status)

    return NextResponse.json({ id: orderId, status })

  } catch (err: any) {
    console.error('[checkout/orders] UNEXPECTED ERROR:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}
