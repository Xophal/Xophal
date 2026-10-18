-- Ensure UUID helpers exist before creating the product catalog tables.
-- The app relies on gen_random_uuid() for additive admin-config tables and must
-- not assume a remote extension state matches the local environment.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO public.product_catalog (
  code,
  product_type,
  board_code,
  class_number,
  name,
  description,
  price_paise,
  early_bird_price_paise,
  school_price_paise,
  duration_days,
  validity_starts_at,
  validity_ends_at,
  is_active,
  is_public,
  metadata
)
VALUES
  (
    'seba_class_9_free',
    'free',
    'seba',
    9,
    'SEBA Class 9 Free',
    'Baseline free access for SEBA Class 9 students. Admins can later configure additional paid offers.',
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    true,
    '{"requires_admin_configuration": false, "category": "baseline"}'::jsonb
  ),
  (
    'seba_class_9_monthly',
    'class_9_monthly',
    'seba',
    9,
    'SEBA Class 9 Monthly',
    'Monthly paid access for SEBA Class 9 students. This record is admin-managed and can be activated when pricing is approved.',
    0,
    NULL,
    NULL,
    30,
    NULL,
    NULL,
    false,
    true,
    '{"requires_admin_configuration": true, "category": "paid_access"}'::jsonb
  ),
  (
    'seba_class_10_season_pass',
    'class_10_season_pass',
    'seba',
    10,
    'SEBA Class 10 Season Pass',
    'Season pass for SEBA Class 10 students. Keep this product inactive until pricing and approval rules are finalized.',
    0,
    NULL,
    NULL,
    365,
    NULL,
    NULL,
    false,
    true,
    '{"requires_admin_configuration": true, "category": "paid_access"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  board_code = EXCLUDED.board_code,
  class_number = EXCLUDED.class_number,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_paise = EXCLUDED.price_paise,
  early_bird_price_paise = EXCLUDED.early_bird_price_paise,
  school_price_paise = EXCLUDED.school_price_paise,
  duration_days = EXCLUDED.duration_days,
  validity_starts_at = EXCLUDED.validity_starts_at,
  validity_ends_at = EXCLUDED.validity_ends_at,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
