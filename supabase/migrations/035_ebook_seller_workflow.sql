-- Seller profiles and draft-first moderation lifecycle.
-- Existing listings and transaction history are preserved.

ALTER TABLE public.ebook_contributors
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS teaching_experience TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE public.ebook_listings
  ALTER COLUMN category_id DROP NOT NULL,
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN cover_image_url DROP NOT NULL,
  ALTER COLUMN short_description DROP NOT NULL,
  ALTER COLUMN full_description DROP NOT NULL,
  ALTER COLUMN language DROP NOT NULL,
  ALTER COLUMN external_product_url DROP NOT NULL,
  ALTER COLUMN author_name DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE public.ebook_listings DROP CONSTRAINT IF EXISTS ebook_listings_status_check;
ALTER TABLE public.ebook_listings ADD CONSTRAINT ebook_listings_status_check
  CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'NEEDS_CHANGES', 'UNPUBLISHED'));

CREATE INDEX IF NOT EXISTS ebook_listings_author_profile_idx
  ON public.ebook_listings(contributor_id, status, published_at DESC);

ALTER TABLE public.ebook_events DROP CONSTRAINT IF EXISTS ebook_events_event_name_check;
ALTER TABLE public.ebook_events ADD CONSTRAINT ebook_events_event_name_check
  CHECK (event_name IN (
    'ebook_view', 'ebook_search', 'ebook_listing_submit', 'ebook_approved',
    'ebook_rejected', 'ebook_external_click', 'ebook_purchase_started',
    'ebook_purchase_completed', 'mock_test_from_ebook', 'mock_test_started',
    'mock_test_completed', 'author_profile_view', 'ebook_changes_requested',
    'ebook_suspended', 'ebook_unpublished', 'ebook_restored', 'ebook_reported',
    'seller_profile_view', 'ebook_created', 'ebook_submitted', 'ebook_resubmitted'
  ));