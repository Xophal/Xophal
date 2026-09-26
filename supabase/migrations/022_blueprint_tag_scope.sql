-- ============================================================================
-- Migration 021b: align blueprint tag filters with the imported tag vocabulary
--
-- The same two-vocabulary problem as the topic scope (migration 021), one level
-- down. Two seeded sections filter on tags, and neither tag exists on the
-- questions migration 017 imported:
--
--   'balancing'   (10 questions, all from 014)  vs  'balancing equations' (17, from 017)
--   'case-child'  (6 questions, all from 014)  vs  'case_based'         (21, from 017)
--
-- matchesTags is an exact string match, so those sections could not see the
-- imported content at all. This widens each section's tag list with its
-- equivalent, exactly as 021 does for topics, and leaves the row itself alone.
--
-- Idempotent: the union is already applied on a re-run.
-- ============================================================================

WITH alias(tag, alias_tag) AS (
  VALUES
    ('balancing',  'balancing equations'),
    ('case-child', 'case_based')
)
UPDATE blueprint_sections bs
SET filter_json = COALESCE(bs.filter_json, '{}'::jsonb)
                  || jsonb_build_object('tags', widened.after_tags)
FROM (
  SELECT s.id AS section_id,
         s.before_tags
         || COALESCE((
              SELECT jsonb_agg(to_jsonb(a.alias_tag))
              FROM alias a
              WHERE a.tag = ANY (SELECT jsonb_array_elements_text(s.before_tags))
            ), '[]'::jsonb) AS after_tags
  FROM (
    SELECT id, COALESCE(filter_json -> 'tags', '[]'::jsonb) AS before_tags
    FROM blueprint_sections
  ) s
) widened
WHERE bs.id = widened.section_id
  AND (bs.filter_json -> 'tags') IS DISTINCT FROM widened.after_tags;

DO $$
DECLARE
  v_sections INT;
  v_tags     INT;
BEGIN
  SELECT COUNT(*) INTO v_sections
  FROM blueprint_sections
  WHERE COALESCE(jsonb_array_length(filter_json -> 'tags'), 0) > 0;

  SELECT COUNT(*) INTO v_tags FROM (
    SELECT DISTINCT jsonb_array_elements_text(filter_json -> 'tags') AS tag
    FROM blueprint_sections
  ) referenced;

  RAISE NOTICE 'QBANK021B: % sections carry a tag filter, referencing % distinct tags', v_sections, v_tags;
END $$;
