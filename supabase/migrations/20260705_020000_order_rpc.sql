-- ============================================================
-- ViralizaHost — Order transaction RPC functions
-- Schema: viralizahost
-- ============================================================
-- INSTRUCTIONS: Run this in Supabase SQL Editor AFTER the previous migrations.
-- ============================================================

-- ── Ensure missing columns exist before creating functions ────

ALTER TABLE viralizahost.domains
  ADD COLUMN IF NOT EXISTS order_id    uuid REFERENCES viralizahost.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registered  boolean NOT NULL DEFAULT false;

-- Unique constraint on domain name (safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'viralizahost.domains'::regclass
    AND contype = 'u'
    AND conname = 'domains_name_key'
  ) THEN
    ALTER TABLE viralizahost.domains ADD CONSTRAINT domains_name_key UNIQUE (name);
  END IF;
END $$;

-- ── create_order ──────────────────────────────────────────────
-- Atomically creates order + order_items + services + domain
-- Called from /api/checkout/orders via db.rpc()

CREATE OR REPLACE FUNCTION viralizahost.create_order(
  p_user_id       uuid,
  p_billing_cycle text,
  p_domain_name   text,
  p_domain_action text,
  p_payment_method text,
  p_amount        numeric,
  p_proof_file    text,
  p_transfer_ref  text,
  p_status        text,
  p_items         jsonb   -- [{service_name, service_type, price, quantity}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_order_id uuid;
  v_item     jsonb;
BEGIN
  -- 1. Insert order
  INSERT INTO orders (
    user_id, billing_cycle, domain_name, domain_action,
    payment_method, amount, proof_file, transfer_ref, status
  ) VALUES (
    p_user_id, p_billing_cycle,
    NULLIF(p_domain_name, ''), NULLIF(p_domain_action, ''),
    p_payment_method, p_amount,
    NULLIF(p_proof_file, ''), NULLIF(p_transfer_ref, ''),
    p_status
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert order_items + service record per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (order_id, service_name, service_type, price, quantity)
    VALUES (
      v_order_id,
      v_item->>'service_name',
      v_item->>'service_type',
      (v_item->>'price')::numeric,
      (v_item->>'quantity')::int
    );

    -- Create pending service row so it appears in client dashboard
    INSERT INTO services (profile_id, service_type, service_name, status, order_id)
    VALUES (
      p_user_id,
      v_item->>'service_type',
      v_item->>'service_name',
      'pending',
      v_order_id
    );
  END LOOP;

  -- 3. Create pending domain row if a domain name is provided
  IF p_domain_name IS NOT NULL AND p_domain_name <> '' THEN
    INSERT INTO domains (profile_id, name, status, registered, order_id)
    VALUES (p_user_id, p_domain_name, 'pending', false, v_order_id)
    ON CONFLICT (name) DO UPDATE
      SET status     = 'pending',
          registered = false,
          order_id   = v_order_id,
          profile_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('id', v_order_id, 'status', p_status);

EXCEPTION WHEN OTHERS THEN
  -- RAISE re-throws, triggering automatic ROLLBACK of everything above
  RAISE;
END;
$$;

-- ── approve_order ─────────────────────────────────────────────
-- Atomically activates order + services + domain

CREATE OR REPLACE FUNCTION viralizahost.approve_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  UPDATE orders  SET status = 'active',    updated_at = now() WHERE id = p_order_id;
  UPDATE services SET status = 'active'                        WHERE order_id = p_order_id;
  UPDATE domains  SET status = 'active',   registered = true   WHERE order_id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'active');
END;
$$;

-- ── reject_order ──────────────────────────────────────────────
-- Atomically cancels order + services + domain

CREATE OR REPLACE FUNCTION viralizahost.reject_order(
  p_order_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  UPDATE orders   SET status = 'rejected',  notes = p_notes, updated_at = now() WHERE id = p_order_id;
  UPDATE services SET status = 'cancelled'                                        WHERE order_id = p_order_id;
  UPDATE domains  SET status = 'cancelled'                                        WHERE order_id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

-- ── Grant execute to service_role ─────────────────────────────
GRANT EXECUTE ON FUNCTION viralizahost.create_order TO service_role;
GRANT EXECUTE ON FUNCTION viralizahost.approve_order TO service_role;
GRANT EXECUTE ON FUNCTION viralizahost.reject_order  TO service_role;
