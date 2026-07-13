import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient, createRpcClient, createAdminWriteClient } from '@/lib/supabase/server'

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

    // ── 4. Server-side price validation for domain items ──────────────────
    const domainItems = (items ?? []).filter((i: any) => i.type === 'domain')
    if (domainItems.length > 0) {
      const dbClient = createAdminWriteClient()
      const { data: dbDomains } = await dbClient
        .from('site_domains')
        .select('extension, price_annual, price_monthly')
        .eq('active', true)

      for (const item of domainItems) {
        // Derive TLD from plan id: 'domain-com' → '.com', 'domain-com-br' → '.com.br'
        const tld = '.' + (item.id as string).replace(/^domain-/, '').replace(/-/g, '.')
        const row = dbDomains?.find((d: any) => d.extension === tld)
        if (row) {
          const expected = row.price_annual ?? row.price_monthly ?? 0
          if (expected > 0) {
            const pct = Math.abs(item.price - expected) / expected
            if (pct > 0.15) {
              console.error('[checkout/orders] price tamper detected — submitted:', item.price, 'expected:', expected, 'tld:', tld)
              return NextResponse.json({ error: 'Preço inválido. Atualize a página e tente novamente.' }, { status: 400 })
            }
            // Override with DB price to prevent rounding drift
            item.price = expected
          }
        }
      }
    }

    // ── 5. Build items payload ─────────────────────────────────────────────
    const PLAN_SLUG_MAP: Record<string, string> = { pro: 'premium' }
    const rpcItems = (items ?? []).map((item: any) => {
      const slug = item.id as string
      return {
        service_name: item.name,
        service_type: item.type,
        price:        Math.round(item.price),
        quantity:     item.quantity ?? 1,
        plan_slug:    PLAN_SLUG_MAP[slug] ?? slug,
      }
    })

    // ── 5b. Re-compute total server-side from validated prices ─────────────
    const DOMAIN_YEARS_SRV: Record<string, number> = { monthly: 1, '6months': 1, '1year': 1, '2years': 2, '3years': 3 }
    const DOMAIN_DISC_SRV:  Record<string, number> = { monthly: 0, '6months': 0, '1year': 0, '2years': 0.10, '3years': 0.15 }
    const HOST_MONTHS_SRV:  Record<string, number> = { monthly: 1, '6months': 6, '1year': 12, '2years': 24, '3years': 36 }
    const HOST_DISC_SRV:    Record<string, number> = { monthly: 0, '6months': 0.15, '1year': 0.30, '2years': 0.45, '3years': 0.55 }

    const serverAmount = Math.round((items ?? []).reduce((acc: number, item: any) => {
      const price = Math.round(item.price)
      const qty   = item.quantity ?? 1
      const cycle = billingCycle ?? 'monthly'
      if (item.type === 'domain') {
        return acc + price * qty * (DOMAIN_YEARS_SRV[cycle] ?? 1) * (1 - (DOMAIN_DISC_SRV[cycle] ?? 0))
      }
      return acc + price * qty * (HOST_MONTHS_SRV[cycle] ?? 1) * (1 - (HOST_DISC_SRV[cycle] ?? 0))
    }, 0))

    console.log('[checkout/orders] CALLING RPC create_order — userId:', userId, 'items:', rpcItems.length, 'serverAmount:', serverAmount)

    // ── 6. Call RPC via rpcClient (NO db.schema) ───────────────────────────
    // public.create_order uses SECURITY DEFINER + SET search_path = viralizahost
    // so it operates on viralizahost tables without PostgREST needing the schema exposed.
    const rpcClient = createRpcClient()
    const { data, error: rpcErr } = await rpcClient.rpc('create_order', {
      p_user_id:        userId,
      p_billing_cycle:  billingCycle  ?? 'monthly',
      p_domain_name:    domainName    ?? '',
      p_domain_action:  domainAction  ?? '',
      p_payment_method: dbPayment,
      p_amount:         serverAmount,
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
