-- ============================================================
-- ViralizaHost — Service Provisioning Flow
-- Ensures every approved order creates service rows visible
-- in the client area, even before WHM provisioning completes.
-- ============================================================

-- 1. Add pending_provisioning to service_status enum
ALTER TYPE viralizahost.service_status ADD VALUE IF NOT EXISTS 'pending_provisioning';

-- 2. Make plan_id nullable so services can exist without a plans entry
--    (email packages live in site_email_plans, not plans)
ALTER TABLE viralizahost.services
  ALTER COLUMN plan_id DROP NOT NULL;

-- 3. Idempotent provisioning function — creates service rows from order_items
--    Safe to call multiple times; skips items that already have a services row.
CREATE OR REPLACE FUNCTION public.provision_order_services(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_user_id  uuid;
  v_item     record;
  v_exists   boolean;
  v_created  int := 0;
BEGIN
  -- Get the owner of this order
  SELECT user_id INTO v_user_id FROM orders WHERE id = p_order_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order not found');
  END IF;

  FOR v_item IN
    SELECT id, service_name, service_type, price, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    -- Skip if a service row already links this order + item name
    SELECT EXISTS(
      SELECT 1 FROM services
      WHERE order_id = p_order_id
        AND service_name = v_item.service_name
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO services (
        profile_id, plan_id, service_type, service_name,
        status, order_id, price, billing_cycle
      )
      SELECT
        v_user_id,
        NULL,
        v_item.service_type,
        v_item.service_name,
        'pending_provisioning',
        p_order_id,
        v_item.price,
        COALESCE((SELECT billing_cycle FROM orders WHERE id = p_order_id), 'monthly')
      WHERE NOT EXISTS (
        SELECT 1 FROM services
        WHERE order_id = p_order_id AND service_name = v_item.service_name
      );

      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

-- 4. Update approve_order to provision services before flipping statuses
CREATE OR REPLACE FUNCTION public.approve_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_provision jsonb;
BEGIN
  -- Create service rows for any items that don't have one yet
  SELECT public.provision_order_services(p_order_id) INTO v_provision;

  -- Flip order + all related services + domains to active
  UPDATE orders   SET status = 'active',    updated_at = now()    WHERE id = p_order_id;
  UPDATE services SET status = 'active',    updated_at = now()    WHERE order_id = p_order_id;
  UPDATE domains  SET status = 'active',    registered_at = now(),
                      updated_at = now()                           WHERE order_id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'active', 'provision', v_provision);
END;
$$;

-- 5. Reconcile old approved orders that have no services rows
--    Run once manually after deploy; safe to run repeatedly.
CREATE OR REPLACE FUNCTION public.reconcile_unprovisioned_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_order    record;
  v_result   jsonb;
  v_total    int := 0;
BEGIN
  FOR v_order IN
    SELECT DISTINCT o.id
    FROM orders o
    WHERE o.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM services s WHERE s.order_id = o.id
      )
  LOOP
    SELECT public.provision_order_services(v_order.id) INTO v_result;
    -- Also flip any newly created services to active
    UPDATE viralizahost.services
    SET status = 'active', updated_at = now()
    WHERE order_id = v_order.id AND status = 'pending_provisioning';
    v_total := v_total + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'orders_processed', v_total);
END;
$$;

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.provision_order_services TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_order            TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_unprovisioned_orders TO service_role;

-- 7. Index for fast lookup of services by order_id
CREATE INDEX IF NOT EXISTS services_order_id_idx ON viralizahost.services(order_id);
