-- ============================================================
-- ViralizaHost — Add Nameserver fields to orders
-- ============================================================

ALTER TABLE viralizahost.orders
  ADD COLUMN IF NOT EXISTS use_default_ns boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ns1            text,
  ADD COLUMN IF NOT EXISTS ns2            text,
  ADD COLUMN IF NOT EXISTS ns3            text,
  ADD COLUMN IF NOT EXISTS ns4            text;

-- ── public.create_order — add NS params ──────────────────────
-- Drop old signature first (required for REPLACE with different params)
DROP FUNCTION IF EXISTS public.create_order(uuid,text,text,text,text,numeric,text,text,text,jsonb);

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
  v_order_id   uuid;
  v_item       jsonb;
  v_plan_id    uuid;
  v_base_name  text;
  v_extension  text;
BEGIN
  -- 1. Insert order
  INSERT INTO orders (
    user_id, billing_cycle, domain_name, domain_action,
    payment_method, amount, proof_file, transfer_ref, status,
    use_default_ns, ns1, ns2, ns3, ns4
  ) VALUES (
    p_user_id,
    p_billing_cycle,
    NULLIF(p_domain_name,   ''),
    NULLIF(p_domain_action, ''),
    p_payment_method,
    p_amount,
    NULLIF(p_proof_file,  ''),
    NULLIF(p_transfer_ref,''),
    p_status,
    p_use_default_ns,
    NULLIF(p_ns1, ''), NULLIF(p_ns2, ''),
    NULLIF(p_ns3, ''), NULLIF(p_ns4, '')
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert order_items + one pending service row per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, service_name, service_type, price, quantity)
    VALUES (
      v_order_id,
      v_item->>'service_name',
      v_item->>'service_type',
      (v_item->>'price')::numeric,
      (v_item->>'quantity')::int
    );

    v_plan_id := NULL;
    SELECT id INTO v_plan_id FROM plans WHERE slug = v_item->>'plan_slug' LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      INSERT INTO services (profile_id, plan_id, service_type, service_name, status, order_id)
      VALUES (
        p_user_id,
        v_plan_id,
        v_item->>'service_type',
        v_item->>'service_name',
        'pending',
        v_order_id
      );
    END IF;
  END LOOP;

  -- 3. Create pending domain row
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

  RETURN jsonb_build_object('id', v_order_id, 'status', p_status);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order TO service_role, authenticated;
