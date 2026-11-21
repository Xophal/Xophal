BEGIN;

ALTER TABLE public.ebook_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (refunded_amount >= 0);

CREATE OR REPLACE FUNCTION public.record_manual_ebook_refund(
  p_order_id UUID,
  p_amount_minor BIGINT,
  p_refund_reference TEXT,
  p_refund_date TIMESTAMPTZ,
  p_reason TEXT,
  p_status TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_order public.ebook_transactions%ROWTYPE;
  v_refund public.refund_events%ROWTYPE;
  v_gross_minor BIGINT;
  v_refunded_minor BIGINT;
  v_fully_refunded BOOLEAN;
BEGIN
  IF p_order_id IS NULL
    OR p_amount_minor IS NULL
    OR p_amount_minor <= 0
    OR NULLIF(btrim(p_refund_reference), '') IS NULL
    OR p_refund_date IS NULL
    OR NULLIF(btrim(p_reason), '') IS NULL
    OR p_status NOT IN ('pending', 'confirmed', 'rejected')
    OR p_admin_id IS NULL
  THEN
    RAISE EXCEPTION 'Refund details are incomplete or invalid';
  END IF;

  SELECT * INTO v_order
  FROM public.ebook_transactions
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ebook order not found';
  END IF;

  SELECT * INTO v_refund
  FROM public.refund_events
  WHERE order_id = p_order_id
    AND refund_reference = btrim(p_refund_reference);

  IF FOUND THEN
    IF v_refund.amount_minor <> p_amount_minor
      OR v_refund.refund_date <> p_refund_date
      OR v_refund.reason <> btrim(p_reason)
      OR v_refund.status <> p_status
    THEN
      RAISE EXCEPTION 'Refund reference was already recorded with different details';
    END IF;
    RETURN jsonb_build_object(
      'refund_id', v_refund.id,
      'order_id', v_refund.order_id,
      'amount_minor', v_refund.amount_minor,
      'refund_reference', v_refund.refund_reference,
      'refund_date', v_refund.refund_date,
      'reason', v_refund.reason,
      'status', v_refund.status,
      'admin_id', v_refund.admin_id,
      'already_recorded', TRUE,
      'refund_total_minor', round(v_order.refunded_amount * 100)::BIGINT,
      'fully_refunded', v_order.status = 'REFUNDED'
    );
  END IF;

  IF p_status = 'confirmed' AND v_order.status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'Only verified ebook payments can be refunded';
  END IF;

  v_gross_minor := round(v_order.gross_amount * 100)::BIGINT;
  IF p_amount_minor > v_gross_minor THEN
    RAISE EXCEPTION 'Refund amount exceeds the original payment';
  END IF;

  SELECT COALESCE(sum(amount_minor), 0)::BIGINT
  INTO v_refunded_minor
  FROM public.refund_events
  WHERE order_id = p_order_id AND status = 'confirmed';

  IF p_status = 'confirmed' AND v_refunded_minor + p_amount_minor > v_gross_minor THEN
    RAISE EXCEPTION 'Confirmed refunds would exceed the original payment';
  END IF;

  INSERT INTO public.refund_events (
    order_id, amount_minor, refund_reference, refund_date, reason, status, admin_id
  )
  VALUES (
    p_order_id, p_amount_minor, btrim(p_refund_reference), p_refund_date,
    btrim(p_reason), p_status, p_admin_id
  )
  RETURNING * INTO v_refund;

  IF p_status = 'confirmed' THEN
    v_refunded_minor := v_refunded_minor + p_amount_minor;
    v_fully_refunded := v_refunded_minor = v_gross_minor;

    UPDATE public.ebook_transactions
    SET refunded_amount = round(v_refunded_minor::NUMERIC / 100, 2),
        refund_status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE 'PARTIAL' END,
        status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE status END,
        order_status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE order_status END,
        refunded_at = CASE WHEN v_fully_refunded THEN p_refund_date ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF v_fully_refunded THEN
      UPDATE public.user_library
      SET access_status = 'revoked',
          revoked_at = NOW(),
          revoked_reason = btrim(p_reason)
      WHERE order_id = p_order_id
        AND access_status = 'active';
    END IF;
  ELSE
    v_fully_refunded := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'refund_id', v_refund.id,
    'order_id', v_refund.order_id,
    'amount_minor', v_refund.amount_minor,
    'refund_reference', v_refund.refund_reference,
    'refund_date', v_refund.refund_date,
    'reason', v_refund.reason,
    'status', v_refund.status,
    'admin_id', v_refund.admin_id,
    'already_recorded', FALSE,
    'refund_total_minor', v_refunded_minor,
    'fully_refunded', v_fully_refunded
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_ebook_refund(
  UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_ebook_refund(
  UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, UUID
) TO service_role;

COMMIT;
