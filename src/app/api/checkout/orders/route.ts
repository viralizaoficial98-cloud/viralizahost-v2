import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      items, billingCycle, domainName, domainAction,
      paymentMethod, proofFileUrl, transferRef,
      userData, amount,
    } = body

    const db = await createAdminClient()

    // Resolve user — either the authenticated session or create a new account
    let userId: string | null = null

    const { data: { user: sessionUser } } = await db.auth.getUser()
    if (sessionUser) {
      userId = sessionUser.id
    } else if (userData?.email && userData?.password) {
      // Create account
      const { data: newUser, error: signUpErr } = await db.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { full_name: userData.name, phone: userData.phone },
      })
      if (signUpErr) console.warn('[checkout/orders] signup warning:', signUpErr.message)
      userId = newUser?.user?.id ?? null

      // Upsert profile
      if (userId) {
        await (db as any).from('profiles').upsert({
          id: userId,
          email: userData.email,
          full_name: userData.name,
          phone: userData.phone ?? null,
          country: 'AO',
          role: 'client',
          currency: 'AKZ',
          is_active: true,
          email_verified: false,
        }, { onConflict: 'id' })
      }
    }

    // Map payment method to DB enum value
    const paymentMap: Record<string, string> = {
      pix:          'pix',
      card:         'credit_card',
      paypal:       'paypal',
      bic_transfer: 'bank_transfer',
    }
    const dbPayment = paymentMap[paymentMethod] ?? 'bank_transfer'

    // Determine order status
    const status = paymentMethod === 'bic_transfer' ? 'aguardando_confirmacao' : 'pending'

    // Create order
    const { data: order, error: orderErr } = await (db as any)
      .from('orders')
      .insert({
        user_id:        userId,
        billing_cycle:  billingCycle,
        domain_name:    domainName || null,
        domain_action:  domainAction || null,
        payment_method: dbPayment,
        amount:         Math.round(amount),
        status,
        proof_file:     proofFileUrl || null,
        transfer_ref:   transferRef || null,
      })
      .select('id')
      .single()

    if (orderErr) {
      console.error('[checkout/orders] order insert error:', orderErr)
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }

    const orderId = order.id

    // Create order items
    if (items?.length) {
      const orderItems = items.map((item: any) => ({
        order_id:     orderId,
        service_name: item.name,
        service_type: item.type,
        price:        Math.round(item.price),
        quantity:     item.quantity,
      }))

      const { error: itemsErr } = await (db as any).from('order_items').insert(orderItems)
      if (itemsErr) console.warn('[checkout/orders] order_items insert warning:', itemsErr.message)
    }

    console.log(`[checkout/orders] created order ${orderId} for user ${userId ?? 'guest'} — ${status}`)

    return NextResponse.json({ id: orderId, status })
  } catch (err: any) {
    console.error('[checkout/orders] unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
