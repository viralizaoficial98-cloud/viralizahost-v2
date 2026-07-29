-- ============================================================
-- ViralizaHost — Financial Module: RPC, indexes, sync trigger
-- Safe to re-run (idempotent).
-- ============================================================

-- ── 1. Indexes for performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_profile_created
  ON viralizahost.invoices (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_profile_status
  ON viralizahost.invoices (profile_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON viralizahost.payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON viralizahost.orders (user_id, created_at DESC);

-- ── 2. Sync proof_file: when payments.proof_url is set, copy to invoices ──
CREATE OR REPLACE FUNCTION viralizahost.sync_invoice_proof_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
BEGIN
  IF NEW.proof_url IS NOT NULL AND NEW.invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET proof_file = NEW.proof_url,
        updated_at = now()
    WHERE id = NEW.invoice_id
      AND (proof_file IS NULL OR proof_file = '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_proof ON viralizahost.payments;
CREATE TRIGGER trg_sync_invoice_proof
  AFTER INSERT OR UPDATE OF proof_url ON viralizahost.payments
  FOR EACH ROW EXECUTE FUNCTION viralizahost.sync_invoice_proof_file();

-- ── 3. RPC: get_client_invoices — paginated list with filters ─────────────
CREATE OR REPLACE FUNCTION public.get_client_invoices(
  p_user_id  uuid,
  p_status   text    DEFAULT NULL,
  p_search   text    DEFAULT NULL,
  p_page     int     DEFAULT 1,
  p_per_page int     DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_offset   int  := (GREATEST(p_page, 1) - 1) * GREATEST(p_per_page, 1);
  v_limit    int  := GREATEST(p_per_page, 1);
  v_total    bigint;
  v_rows     jsonb;
BEGIN
  -- Count total (for pagination)
  SELECT COUNT(*)
  INTO v_total
  FROM invoices i
  WHERE i.profile_id = p_user_id
    AND (p_status IS NULL OR i.status::text = p_status)
    AND (
      p_search IS NULL OR p_search = '' OR
      i.invoice_number ILIKE '%' || p_search || '%' OR
      i.notes          ILIKE '%' || p_search || '%'
    );

  -- Fetch page
  SELECT COALESCE(jsonb_agg(row ORDER BY row.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      i.id,
      i.invoice_number,
      i.order_id,
      i.status,
      i.currency,
      i.subtotal,
      i.discount,
      i.tax,
      i.total,
      i.amount_paid,
      GREATEST(0, i.total - COALESCE(i.amount_paid, 0)) AS outstanding,
      i.due_date,
      i.issue_date,
      i.paid_at,
      i.notes,
      i.proof_file,
      i.items,
      i.created_at,
      -- order details for display
      o.billing_cycle,
      o.domain_name,
      o.payment_method,
      o.transfer_ref,
      -- order items as jsonb array
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'service_name', oi.service_name,
            'service_type', oi.service_type,
            'price',        oi.price,
            'quantity',     oi.quantity
          )
        ), '[]'::jsonb)
        FROM order_items oi
        WHERE oi.order_id = i.order_id
      ) AS order_items
    FROM invoices i
    LEFT JOIN orders o ON o.id = i.order_id
    WHERE i.profile_id = p_user_id
      AND (p_status IS NULL OR i.status::text = p_status)
      AND (
        p_search IS NULL OR p_search = '' OR
        i.invoice_number ILIKE '%' || p_search || '%' OR
        i.notes          ILIKE '%' || p_search || '%' OR
        o.domain_name    ILIKE '%' || p_search || '%'
      )
    ORDER BY i.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) AS row;

  RETURN jsonb_build_object(
    'invoices', v_rows,
    'total',    v_total,
    'page',     p_page,
    'per_page', v_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_invoices TO authenticated, service_role;

-- ── 4. RPC: get_client_financial_summary — KPI cards ─────────────────────
CREATE OR REPLACE FUNCTION public.get_client_financial_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = viralizahost
AS $$
DECLARE
  v_paid          numeric := 0;
  v_pending       numeric := 0;
  v_under_review  numeric := 0;
  v_credit        numeric := 0;
  v_next_due      date    := NULL;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('pending','overdue','partially_paid') THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'under_review' THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0)
  INTO v_paid, v_pending, v_under_review
  FROM invoices
  WHERE profile_id = p_user_id;

  -- Credit from clients table if it exists
  BEGIN
    SELECT COALESCE(credit_balance, 0) INTO v_credit
    FROM clients WHERE profile_id = p_user_id LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_credit := 0;
  END;

  -- Next due date
  SELECT MIN(due_date) INTO v_next_due
  FROM invoices
  WHERE profile_id = p_user_id
    AND status IN ('pending', 'overdue', 'partially_paid', 'under_review');

  RETURN jsonb_build_object(
    'total_paid',       v_paid,
    'total_pending',    v_pending,
    'total_under_review', v_under_review,
    'credit',           v_credit,
    'next_due',         v_next_due
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_financial_summary TO authenticated, service_role;

-- ── 5. RLS on invoices — client sees only own rows ───────────────────────
ALTER TABLE viralizahost.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_own" ON viralizahost.invoices;
CREATE POLICY "invoices_select_own"
  ON viralizahost.invoices FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Service role bypasses RLS (admin access)
-- Anon: no access

-- ── 6. RLS on payments — client sees only own rows ───────────────────────
ALTER TABLE viralizahost.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON viralizahost.payments;
CREATE POLICY "payments_select_own"
  ON viralizahost.payments FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ── 7. Grant SELECT for authenticated on needed tables ───────────────────
GRANT SELECT ON viralizahost.invoices    TO authenticated;
GRANT SELECT ON viralizahost.payments    TO authenticated;
GRANT SELECT ON viralizahost.orders      TO authenticated;
GRANT SELECT ON viralizahost.order_items TO authenticated;
