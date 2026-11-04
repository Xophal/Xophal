WITH ranked_slugs AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY LOWER(slug) ORDER BY created_at, id) AS duplicate_rank
  FROM public.mock_tests
),
duplicate_slugs AS (
  SELECT id, slug
  FROM ranked_slugs
  WHERE duplicate_rank > 1
)
UPDATE public.mock_tests AS mock_test
SET slug = LEFT(duplicate_slugs.slug, 467) || '-' || REPLACE(duplicate_slugs.id::TEXT, '-', '')
FROM duplicate_slugs
WHERE mock_test.id = duplicate_slugs.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_tests_slug_lower
  ON public.mock_tests (LOWER(slug));
