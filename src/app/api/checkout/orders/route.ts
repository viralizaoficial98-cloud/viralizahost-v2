import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items, billingCycle, domainName, domainAction,
      paymentMethod, proofFileUrl, transferRef,
      userData, amount,
    } = body

    // ── 1. Resolve authenticated user ──────────────────────────────────────
    // Use anon-key client (reads session cookies) to get the real user.
    // createAdminClient uses service_role key and cannot resolve user from cookies.
    const authClient = await createClient()
    const { data: { user: sessionUser } } = await authClient.auth.getUser()

    const db = await createAdminClient()
    let userId: string | null = sessionUser?.id ?? null

    // ── 2. Create account if user arrived as guest ─────────────────────────
    if (!userId && userData?.email && userData?.password) {
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

    // ── 4. Order status ────────────────────────────────────────────────────
    // BIC transfer → aguardando_confirmacao (manual review)
    // All others   → pending (awaiting automated payment gateway)
    const status = paymentMethod === 'bic_transfer' ? 'aguardando_confirmacao' : 'pending'

    // ── 5. Build items payload for RPC ─────────────────────────────────────
    const rpcItems = (items ?? []).map((item: any) => ({
      service_name: item.name,
      service_type: item.type,
      price:        Math.round(item.price),
      quantity:     item.quantity ?? 1,
    }))

    // ── 6. Call transaction RPC — all-or-nothing ───────────────────────────
    const { data, error: rpcErr } = await (db as any).rpc('create_order', {
      p_user_id:        userId,
      p_billing_cycle:  billingCycle ?? 'monthly',
      p_domain_name:    domainName   ?? '',
      p_domain_action:  domainAction ?? '',
      p_payment_method: dbPayment,
      p_amount:         Math.round(amount ?? 0),
      p_proof_file:     proofFileUrl ?? '',
      p_transfer_ref:   transferRef  ?? '',
      p_status:         status,
      p_items:          rpcItems,
    })

    if (rpcErr) {
      console.error('[checkout/orders] RPC error:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const orderId = data?.id
    console.log(`[checkout/orders] created order ${orderId} for user ${userId} — ${status}`)

    return NextResponse.json({ id: orderId, status })

  } catch (err: any) {
    console.error('[checkout/orders] unexpected error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}
