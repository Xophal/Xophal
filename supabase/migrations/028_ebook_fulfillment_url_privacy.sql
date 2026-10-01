-- Keep the seller's fulfilment destination server-only. RLS filters rows, not
-- columns, so public discovery receives an explicit safe column projection.
REVOKE SELECT ON public.ebook_listings FROM anon, authenticated;

GRANT SELECT (
  id,
  contributor_id,
  category_id,
  subject_id,
  exam_id,
  title,
  slug,
  cover_image_url,
  short_description,
  full_description,
  subject,
  exam,
  language,
  page_count,
  price,
  currency,
  preview_url,
  author_name,
  publication_date,
  status,
  is_featured,
  view_count,
  external_click_count,
  published_at,
  created_at,
  updated_at
) ON public.ebook_listings TO anon, authenticated;