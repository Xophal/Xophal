-- Razorpay Route seller onboarding and provider-backed delayed payouts.
-- Raw PAN and settlement-account details are sent to Razorpay and never stored
-- by Xophol. Only the provider account id and non-sensitive status are kept.

CREATE TABLE IF NOT EXISTS ebook_seller_payout_accounts (
  seller_user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE RESTRICT,
  provider_account_id VARCHAR(80) UNIQUE,
  onboarding_idempotency_key UUID NOT NULL DEFAULT gen_random_uuid(),
  account_status VARCHAR(32) NOT NULL DEFAULT 'created',
  activation_status VARCHAR(32) NOT NULL DEFAULT 'under_review',
  settlement_verification_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  settlement_account_last4 VARCHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ebook_payouts ADD COLUMN IF NOT EXISTS provider_status VARCHAR(32);
ALTER TABLE ebook_payouts ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (provider_fee >= 0);
ALTER TABLE ebook_payouts ADD COLUMN IF NOT EXISTS provider_tax NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (provider_tax >= 0);
ALTER TABLE ebook_payouts ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE ebook_transactions ALTER COLUMN payment_fee DROP NOT NULL;
ALTER TABLE ebook_transactions ALTER COLUMN tax_amount DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ebook_payouts_provider_reference_key
  ON ebook_payouts(provider_reference) WHERE provider_reference IS NOT NULL;

ALTER TABLE ebook_seller_payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebook_seller_payout_accounts_owner_read ON ebook_seller_payout_accounts;
CREATE POLICY ebook_seller_payout_accounts_owner_read ON ebook_seller_payout_accounts
  FOR SELECT USING (seller_user_id = auth.uid() OR is_admin());

REVOKE ALL ON ebook_seller_payout_accounts FROM anon, authenticated;
GRANT SELECT (
  seller_user_id,
  account_status,
  activation_status,
  settlement_verification_status,
  settlement_account_last4,
  created_at,
  updated_at
) ON ebook_seller_payout_accounts TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON ebook_seller_payout_accounts FROM anon, authenticated;

-- Older verified rows stored estimated deductions at checkout. Keep their gross
-- ledger intact, but require reconciliation before they can be paid out.
UPDATE ebook_transactions
SET seller_net_amount = NULL,
    payment_fee = NULL,
    tax_amount = NULL,
    payout_status = 'NOT_AVAILABLE',
    updated_at = NOW()
WHERE status = 'VERIFIED'
  AND payout_status IN ('PENDING', 'AVAILABLE')
  AND payout_id IS NULL;

CREATE OR REPLACE FUNCTION record_ebook_payment_costs(
  p_transaction_id UUID,
  p_payment_fee NUMERIC,
  p_tax_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  IF p_payment_fee IS NULL OR p_tax_amount IS NULL OR p_payment_fee < 0 OR p_tax_amount < 0 THEN
    RAISE EXCEPTION 'Provider fees and tax must be non-negative';
  END IF;

  UPDATE ebook_transactions
  SET payment_fee = round(p_payment_fee, 2),
      tax_amount = round(p_tax_amount, 2),
      seller_net_amount = greatest(0, round(seller_amount - p_payment_fee - p_tax_amount, 2)),
      updated_at = NOW()
  WHERE id = p_transaction_id
    AND status = 'VERIFIED'
    AND provider = 'razorpay';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION record_ebook_payment_costs(UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_ebook_payment_costs(UUID, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION reserve_ebook_route_onboarding(p_seller_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_key UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_seller_user_id::TEXT, 1));
  INSERT INTO ebook_seller_payout_accounts (seller_user_id, account_status, activation_status)
  VALUES (p_seller_user_id, 'onboarding', 'under_review')
  ON CONFLICT (seller_user_id) DO NOTHING;

  SELECT onboarding_idempotency_key INTO v_key
  FROM ebook_seller_payout_accounts
  WHERE seller_user_id = p_seller_user_id
    AND provider_account_id IS NULL
  FOR UPDATE;

  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION reserve_ebook_route_onboarding(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_ebook_route_onboarding(UUID) TO service_role;

CREATE OR REPLACE FUNCTION rotate_ebook_route_onboarding_key(p_seller_user_id UUID, p_old_key UUID)
RETURNS UUID AS $$
DECLARE
  v_key UUID := gen_random_uuid();
BEGIN
  UPDATE ebook_seller_payout_accounts
  SET onboarding_idempotency_key = v_key, updated_at = NOW()
  WHERE seller_user_id = p_seller_user_id
    AND provider_account_id IS NULL
    AND onboarding_idempotency_key = p_old_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION rotate_ebook_route_onboarding_key(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rotate_ebook_route_onboarding_key(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION save_ebook_route_account(
  p_seller_user_id UUID,
  p_onboarding_key UUID,
  p_provider_account_id TEXT,
  p_account_status TEXT,
  p_activation_status TEXT,
  p_settlement_verification_status TEXT,
  p_settlement_account_last4 TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE ebook_seller_payout_accounts
  SET provider_account_id = p_provider_account_id,
      account_status = left(p_account_status, 32),
      activation_status = left(p_activation_status, 32),
      settlement_verification_status = left(p_settlement_verification_status, 24),
      settlement_account_last4 = right(regexp_replace(COALESCE(p_settlement_account_last4, ''), '[^0-9]', '', 'g'), 4),
      updated_at = NOW()
  WHERE seller_user_id = p_seller_user_id
    AND onboarding_idempotency_key = p_onboarding_key
    AND provider_account_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not save Route linked account for seller';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION save_ebook_route_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_ebook_route_account(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION refresh_ebook_route_account_status(
  p_provider_account_id TEXT,
  p_account_status TEXT,
  p_activation_status TEXT,
  p_settlement_verification_status TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE ebook_seller_payout_accounts
  SET account_status = left(p_account_status, 32),
      activation_status = left(p_activation_status, 32),
      settlement_verification_status = left(p_settlement_verification_status, 24),
      updated_at = NOW()
  WHERE provider_account_id = p_provider_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION refresh_ebook_route_account_status(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_ebook_route_account_status(TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION claim_ebook_payout(p_seller_user_id UUID)
RETURNS TABLE (
  payout_id UUID,
  amount NUMERIC,
  currency VARCHAR,
  transaction_count INT,
  provider_account_id VARCHAR
) AS $$
DECLARE
  v_existing ebook_payouts%ROWTYPE;
  v_transaction_ids UUID[];
  v_amount NUMERIC(10,2);
  v_count INT;
  v_payout_id UUID;
  v_provider_account_id VARCHAR(80);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_seller_user_id::TEXT, 0));

  SELECT account.provider_account_id
  INTO v_provider_account_id
  FROM ebook_seller_payout_accounts AS account
  WHERE account.seller_user_id = p_seller_user_id
    AND account.activation_status = 'activated'
    AND account.settlement_verification_status = 'verified';

  IF v_provider_account_id IS NULL THEN
    RETURN;
  END IF;

  SELECT payout.*
  INTO v_existing
  FROM ebook_payouts AS payout
  WHERE payout.seller_user_id = p_seller_user_id
    AND payout.status = 'PROCESSING'
    AND payout.provider = 'razorpay_route'
  ORDER BY payout.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.amount, v_existing.currency,
      v_existing.transaction_count, v_provider_account_id;
    RETURN;
  END IF;

  SELECT array_agg(ledger.id),
         round(COALESCE(sum(ledger.seller_net_amount), 0), 2),
         count(*)::INT
  INTO v_transaction_ids, v_amount, v_count
  FROM ebook_transactions AS ledger
  WHERE ledger.seller_user_id = p_seller_user_id
    AND ledger.status = 'VERIFIED'
    AND ledger.payout_status = 'AVAILABLE'
    AND ledger.payout_id IS NULL
    AND ledger.currency = 'INR'
    AND ledger.payment_fee IS NOT NULL
    AND ledger.tax_amount IS NOT NULL
    AND ledger.seller_net_amount > 0;

  IF v_amount < 1 OR v_transaction_ids IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO ebook_payouts (
    seller_user_id, amount, currency, status, provider, transaction_count, created_by
  ) VALUES (
    p_seller_user_id, v_amount, 'INR', 'PROCESSING', 'razorpay_route', v_count, p_seller_user_id
  ) RETURNING id INTO v_payout_id;

  UPDATE ebook_transactions
  SET payout_status = 'PROCESSING',
      payout_id = v_payout_id,
      updated_at = NOW()
  WHERE id = ANY(v_transaction_ids)
    AND payout_status = 'AVAILABLE'
    AND payout_id IS NULL;

  RETURN QUERY SELECT v_payout_id, v_amount, 'INR'::VARCHAR, v_count, v_provider_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION claim_ebook_payout(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_ebook_payout(UUID) TO service_role;

CREATE OR REPLACE FUNCTION finalize_ebook_payout(
  p_payout_id UUID,
  p_provider_reference TEXT,
  p_provider_status TEXT,
  p_provider_fee NUMERIC DEFAULT 0,
  p_provider_tax NUMERIC DEFAULT 0,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_status VARCHAR(24);
BEGIN
  SELECT payout.status INTO v_status
  FROM ebook_payouts AS payout
  WHERE payout.id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND OR v_status IN ('PAID', 'FAILED') THEN
    RETURN;
  END IF;

  IF p_provider_status = 'processed' THEN
    UPDATE ebook_payouts
    SET status = 'PAID',
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        provider_status = p_provider_status,
        provider_fee = GREATEST(0, COALESCE(p_provider_fee, 0)),
        provider_tax = GREATEST(0, COALESCE(p_provider_tax, 0)),
        failure_reason = NULL,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payout_id;

    UPDATE ebook_transactions
    SET payout_status = 'PAID', updated_at = NOW()
    WHERE payout_id = p_payout_id AND payout_status = 'PROCESSING';
  ELSIF p_provider_status = 'failed' THEN
    UPDATE ebook_payouts
    SET status = 'FAILED',
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        provider_status = p_provider_status,
        failure_reason = left(COALESCE(p_failure_reason, 'Provider transfer failed.'), 500),
        updated_at = NOW()
    WHERE id = p_payout_id;

    UPDATE ebook_transactions
    SET payout_status = 'AVAILABLE', payout_id = NULL, updated_at = NOW()
    WHERE payout_id = p_payout_id AND payout_status = 'PROCESSING';
  ELSE
    UPDATE ebook_payouts
    SET status = 'PROCESSING',
        provider_reference = COALESCE(p_provider_reference, provider_reference),
        provider_status = left(p_provider_status, 32),
        provider_fee = GREATEST(0, COALESCE(p_provider_fee, 0)),
        provider_tax = GREATEST(0, COALESCE(p_provider_tax, 0)),
        updated_at = NOW()
    WHERE id = p_payout_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION finalize_ebook_payout(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_ebook_payout(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO service_role;