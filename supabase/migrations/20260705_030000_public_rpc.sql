-- ============================================================
-- ViralizaHost — Move RPC functions to public schema
-- ============================================================
-- PROBLEM: PostgREST rejects Content-Profile: viralizahost unless
-- viralizahost is listed in "Exposed Schemas" (Dashboard → Settings → API).
-- SOLUTION: Define functions in public schema (always accessible) and
-- use SET search_path = viralizahost so they operate on viralizahost tables.
-- ============================================================

-- ── Ensure domains has order_id column (safe to re-run) ──────────────────────
ALTER TABLE viralizahost.domains
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES viralizahost.orders(id) ON DELETE SET NULL;

-- Unique constraint on domain name alone (for ON CONFLICT used in create_order)
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

-- ── Drop old viralizahost-schema versions (replaced by public ones) ──────────
DROP FUNCTION IF EXISTS viralizahost.create_order(uuid,text,text,text,text,numeric,text,text,text,jsonb);
DROP FUNCTION IF EXISTS viralizahost.approve_order(uuid);
DROP FUNCTION IF EXISTS viralizahost.reject_order(uuid,text);

-- ── public.create_order ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_order(
  p_user_id        uuid,
  p_billing_cycle  text,
  p_domain_name    text,
  p_domain_action  text,
  p_payment_method text,
  p_amount         numeric,
  p_proof_file     text,
  p_transfer_ref   text,
  p_status         text,
  p_items          jsonb   -- [{service_name, service_type, price, quantity, plan_slug}]
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
  v_base_name  text;  -- e.g. "empresa"  (tudo antes do primeiro ponto)
  v_extension  text;  -- e.g. ".com.br"  (ponto + tudo após o primeiro ponto)
BEGIN
  -- 1. Insert order
  INSERT INTO orders (
    user_id, billing_cycle, domain_name, domain_action,
    payment_method, amount, proof_file, transfer_ref, status
  ) VALUES (
    p_user_id,
    p_billing_cycle,
    NULLIF(p_domain_name,   ''),
    NULLIF(p_domain_action, ''),
    p_payment_method,
    p_amount,
    NULLIF(p_proof_file,  ''),
    NULLIF(p_transfer_ref,''),
    p_status
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert order_items + one pending service row per item (only when plan exists)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, service_name, service_type, price, quantity)
    VALUES (
      v_order_id,
      v_item->>'service_name',
      v_item->>'service_type',
      (v_item->>'price')::numeric,
      (v_item->>'quantity')::int
    );

    -- Look up plan by slug; domain/email items without a plan are skipped
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
  --    Splits full domain into base name + extension:
  --      "empresa.ao"     → name="empresa"  extension=".ao"
  --      "empresa.com.br" → name="empresa"  extension=".com.br"
  --      "empresa.co.ao"  → name="empresa"  extension=".co.ao"
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
  RAISE; -- triggers automatic ROLLBACK
END;
$$;

-- ── public.approve_order ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  UPDATE orders   SET status = 'active',    updated_at = now()   WHERE id = p_order_id;
  UPDATE services SET status = 'active'                           WHERE order_id = p_order_id;
  UPDATE domains  SET status = 'active',    registered_at = now(),
                      updated_at = now()                          WHERE order_id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'status', 'active');
END;
$$;

-- ── public.reject_order ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_order(
  p_order_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  UPDATE orders   SET status = 'rejected', notes = p_notes, updated_at = now() WHERE id = p_order_id;
  UPDATE services SET status = 'cancelled'                                        WHERE order_id = p_order_id;
  UPDATE domains  SET status = 'cancelled', updated_at = now()                   WHERE order_id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.create_order  TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_order TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_order  TO service_role;
