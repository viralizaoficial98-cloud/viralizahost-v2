-- ============================================================
-- ViralizaHost — Auto-create invoice on order + update on approval/rejection
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. Add proof_file column to invoices (if not exists) ─────
ALTER TABLE viralizahost.invoices
  ADD COLUMN IF NOT EXISTS proof_file TEXT;

-- ── 2. Drop old public.create_order (10-param and 15-param) ──
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,numeric,text,text,text,jsonb);
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,numeric,text,text,text,jsonb,boolean,text,text,text,text);

-- ── 3. New public.create_order — creates order + invoice atomically
CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id         uuid,
  p_billing_cycle   text,
  p_domain_name     text,
  p_domain_action   text,
  p_payment_method  text,
  p_amount          numeric,
  p_proof_file      text,
  p_transfer_ref    text,
  p_status          text,
  p_items           jsonb,
  p_use_default_ns  boolean DEFAULT true,
  p_ns1             text    DEFAULT 'ns1.viralizahost.com',
  p_ns2             text    DEFAULT 'ns2.viralizahost.com',
  p_ns3             text    DEFAULT NULL,
  p_ns4             text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_order_id        uuid;
  v_item            jsonb;
  v_plan_id         uuid;
  v_base_name       text;
  v_extension       text;
  v_invoice_id      uuid;
  v_invoice_number  text;
  v_invoice_status  invoice_status;
  v_invoice_items   jsonb;
  v_month_seq       bigint;
BEGIN
  -- ── a. Insert order ───────────────────────────────────────────
  INSERT INTO orders (
    user_id, billing_cycle, domain_name, domain_action,
    payment_method, amount, proof_file, transfer_ref, status,
    use_default_ns, ns1, ns2, ns3, ns4
  ) VALUES (
    p_user_id, p_billing_cycle,
    NULLIF(p_domain_name, ''),  NULLIF(p_domain_action, ''),
    p_payment_method, p_amount,
    NULLIF(p_proof_file,  ''),  NULLIF(p_transfer_ref, ''),
    p_status,
    COALESCE(p_use_default_ns, true),
    COALESCE(NULLIF(p_ns1, ''), 'ns1.viralizahost.com'),
    COALESCE(NULLIF(p_ns2, ''), 'ns2.viralizahost.com'),
    NULLIF(p_ns3, ''), NULLIF(p_ns4, '')
  )
  RETURNING id INTO v_order_id;

  -- ── b. Order items + service rows ─────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, service_name, service_type, price, quantity)
    VALUES (
      v_order_id,
      v_item->>'service_name',
      v_item->>'service_type',
      (v_item->>'price')::numeric,
      (v_item->>'quantity')::int
    );

    -- Always create a pending service row (plan_id is optional)
    v_plan_id := NULL;
    SELECT id INTO v_plan_id FROM plans WHERE slug = v_item->>'plan_slug' LIMIT 1;

    INSERT INTO services (profile_id, plan_id, service_type, service_name, status, order_id)
    VALUES (
      p_user_id, v_plan_id,
      v_item->>'service_type',
      v_item->>'service_name',
      'pending',
      v_order_id
    );
  END LOOP;

  -- ── c. Pending domain row ──────────────────────────────────────
  IF p_domain_name IS NOT NULL AND p_domain_name <> '' THEN
    v_base_name := split_part(p_domain_name, '.', 1);
    v_extension := '.' || substring(p_domain_name FROM position('.' IN p_domain_name) + 1);

    INSERT INTO domains (profile_id, name, extension, status, order_id)
    VALUES (p_user_id, v_base_name, v_extension, 'pending', v_order_id)
    ON CONFLICT (name, extension) DO UPDATE
      SET status     = 'pending',
          order_id   = EXCLUDED.order_id,
          profile_id = EXCLUDED.profile_id,
          updated_at = now();
  END IF;

  -- ── d. Generate invoice number: VH-YYYYMM-NNNN ────────────────
  SELECT COUNT(*) + 1 INTO v_month_seq
  FROM invoices
  WHERE invoice_number LIKE 'VH-' || TO_CHAR(now(), 'YYYYMM') || '-%';

  v_invoice_number := 'VH-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(v_month_seq::text, 4, '0');

  -- ── e. Invoice status ─────────────────────────────────────────
  IF p_proof_file IS NOT NULL AND p_proof_file <> '' THEN
    v_invoice_status := 'under_review';
  ELSE
    v_invoice_status := 'pending';
  END IF;

  -- ── f. Build invoice items JSONB from order items ─────────────
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'name',       elem->>'service_name',
      'type',       elem->>'service_type',
      'quantity',   (elem->>'quantity')::int,
      'unit_price', (elem->>'price')::numeric,
      'price',      (elem->>'price')::numeric
    )),
    '[]'::jsonb
  )
  INTO v_invoice_items
  FROM jsonb_array_elements(p_items) AS elem;

  -- ── g. Insert invoice (idempotent — unique index on order_id) ─
  INSERT INTO invoices (
    profile_id, order_id, invoice_number,
    status, currency,
    subtotal, discount, tax, total, amount_paid,
    due_date, issue_date,
    notes, proof_file, items
  ) VALUES (
    p_user_id, v_order_id, v_invoice_number,
    v_invoice_status, 'AKZ'::currency_code,
    p_amount, 0, 0, p_amount, 0,
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE,
    CASE
      WHEN p_domain_name IS NOT NULL AND p_domain_name <> ''
        THEN 'Domínio: ' || p_domain_name
      ELSE NULL
    END,
    NULLIF(p_proof_file, ''),
    v_invoice_items
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object(
    'id',         v_order_id,
    'status',     p_status,
    'invoice_id', v_invoice_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order TO service_role, authenticated, anon;

-- ── 4. Drop old approve_order & replace with invoice-aware version ──
DROP FUNCTION IF EXISTS public.approve_order(uuid);

CREATE OR REPLACE FUNCTION public.approve_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  -- Activate order
  UPDATE orders
  SET status = 'active', updated_at = now()
  WHERE id = p_order_id;

  -- Activate services
  UPDATE services
  SET status = 'active'
  WHERE order_id = p_order_id;

  -- Activate domain
  UPDATE domains
  SET status = 'active', registered_at = now(), updated_at = now()
  WHERE order_id = p_order_id;

  -- Mark invoice as paid
  UPDATE invoices
  SET status      = 'paid'::invoice_status,
      amount_paid = total,
      paid_at     = now(),
      updated_at  = now()
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'active');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_order TO service_role;

-- ── 5. Drop old reject_order & replace with invoice-aware version ──
DROP FUNCTION IF EXISTS public.reject_order(uuid, text);

CREATE OR REPLACE FUNCTION public.reject_order(p_order_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  -- Reject order
  UPDATE orders
  SET status = 'rejected', notes = p_notes, updated_at = now()
  WHERE id = p_order_id;

  -- Cancel services
  UPDATE services
  SET status = 'cancelled'
  WHERE order_id = p_order_id;

  -- Cancel domain
  UPDATE domains
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id;

  -- Cancel invoice
  UPDATE invoices
  SET status     = 'cancelled'::invoice_status,
      updated_at = now()
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_order TO service_role;

-- ── 6. Backfill invoices for existing orders that don't have one ──
-- (Safe: the ON CONFLICT on order_id prevents duplicates)
DO $$
DECLARE
  r RECORD;
  v_seq bigint;
  v_inv_num text;
  v_inv_status viralizahost.invoice_status;
  v_items jsonb;
BEGIN
  FOR r IN
    SELECT o.id AS order_id, o.user_id, o.amount, o.proof_file,
           o.domain_name, o.created_at, o.status AS order_status
    FROM viralizahost.orders o
    WHERE NOT EXISTS (
      SELECT 1 FROM viralizahost.invoices i WHERE i.order_id = o.id
    )
    ORDER BY o.created_at
  LOOP
    -- Generate invoice number based on order creation month
    SELECT COUNT(*) + 1 INTO v_seq
    FROM viralizahost.invoices
    WHERE invoice_number LIKE 'VH-' || TO_CHAR(r.created_at, 'YYYYMM') || '-%';

    v_inv_num := 'VH-' || TO_CHAR(r.created_at, 'YYYYMM') || '-' || LPAD(v_seq::text, 4, '0');

    -- Determine status
    IF r.order_status = 'active' THEN
      v_inv_status := 'paid';
    ELSIF r.order_status = 'rejected' THEN
      v_inv_status := 'cancelled';
    ELSIF r.proof_file IS NOT NULL THEN
      v_inv_status := 'under_review';
    ELSE
      v_inv_status := 'pending';
    END IF;

    -- Build items from order_items
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'name',       oi.service_name,
        'type',       oi.service_type,
        'quantity',   oi.quantity,
        'unit_price', oi.price,
        'price',      oi.price
      )),
      '[]'::jsonb
    )
    INTO v_items
    FROM viralizahost.order_items oi
    WHERE oi.order_id = r.order_id;

    BEGIN
      INSERT INTO viralizahost.invoices (
        profile_id, order_id, invoice_number,
        status, currency,
        subtotal, discount, tax, total, amount_paid,
        due_date, issue_date,
        notes, proof_file, items,
        paid_at, created_at
      ) VALUES (
        r.user_id, r.order_id, v_inv_num,
        v_inv_status, 'AKZ'::viralizahost.currency_code,
        r.amount, 0, 0, r.amount,
        CASE WHEN v_inv_status = 'paid' THEN r.amount ELSE 0 END,
        r.created_at::date + INTERVAL '7 days',
        r.created_at::date,
        CASE WHEN r.domain_name IS NOT NULL THEN 'Domínio: ' || r.domain_name ELSE NULL END,
        r.proof_file,
        COALESCE(v_items, '[]'::jsonb),
        CASE WHEN v_inv_status = 'paid' THEN r.created_at ELSE NULL END,
        r.created_at
      );
    EXCEPTION WHEN unique_violation THEN
      -- Already exists (race condition) — skip
      NULL;
    END;
  END LOOP;
END;
$$;

-- ── 7. Grant SELECT on invoices to authenticated ──────────────
GRANT SELECT ON viralizahost.invoices TO authenticated;
GRANT SELECT ON viralizahost.invoice_items TO authenticated;
