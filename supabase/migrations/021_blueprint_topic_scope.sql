-- ============================================================================
-- Migration 021: make the whole Ch1 bank reachable from the seeded blueprints
--
-- The chapter ended up with two topic vocabularies. Migration 014 created
-- balancing-equations / types-of-reactions / redox-reactions (+ corrosion,
-- rancidity, exothermic-endothermic, whose slugs migration 017 reused). The CSV
-- import (017) created chemical-equations-balancing, combination-decomposition,
-- displacement-double-displacement and oxidation-reduction.
--
-- The six seeded blueprints were built in 014 against the 014 slugs, so their
-- section filters - and the topic_ids resolved inside them - never matched the
-- 124 questions imported by 017. Measured before this migration: only 152 of
-- 276 published questions were reachable by any blueprint, and
-- ch1-balancing-topic-test could fill 5 of the 10 questions it asked for.
--
-- Rather than merge the two vocabularies (which would orphan 16 subtopics and
-- touch every question row), each section's existing topic scope is widened by
-- its equivalents, so a section keeps its intent while the matching imported
-- content becomes reachable:
--
--   balancing-equations        -> chemical-equations-balancing
--   types-of-reactions         -> combination-decomposition, displacement-double-displacement
--   redox-reactions            -> oxidation-reduction
--
-- Chapter-wide sections already list every 014 slug, so they gain all four.
--
-- Idempotent: re-running adds nothing, the union is already applied.
-- ============================================================================

WITH alias(topic_slug, alias_slug) AS (
  VALUES
    ('balancing-equations',        'chemical-equations-balancing'),
    ('types-of-reactions',         'combination-decomposition'),
    ('types-of-reactions',         'displacement-double-displacement'),
    ('redox-reactions',            'oxidation-reduction')
),
ch1 AS (
  SELECT tp.id, tp.slug
  FROM topics tp
  JOIN chapters ch ON tp.chapter_id = ch.id
  JOIN subjects  s  ON ch.subject_id = s.id
  JOIN classes   c  ON s.class_id = c.id
  JOIN boards    b  ON c.board_id = b.id
  WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science' AND ch.code = 'chemical-reactions'
),
slugs_of AS (
  SELECT bs.id AS section_id,
         COALESCE(bs.filter_json -> 'topic_slugs', '[]'::jsonb) AS before_slugs
  FROM blueprint_sections bs
),
expanded AS (
  SELECT DISTINCT
    s.section_id,
    s.before_slugs
    || COALESCE((
         SELECT jsonb_agg(to_jsonb(a.alias_slug))
         FROM alias a
         WHERE a.topic_slug = ANY (
           SELECT jsonb_array_elements_text(s.before_slugs)
         )
       ), '[]'::jsonb) AS after_slugs
  FROM slugs_of s
),
resolved AS (
  SELECT e.section_id,
         e.after_slugs,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(t.id) ORDER BY t.id)
           FROM ch1 t
           WHERE t.slug = ANY (SELECT jsonb_array_elements_text(e.after_slugs))
         ), '[]'::jsonb) AS after_ids
  FROM expanded e
)
UPDATE blueprint_sections bs
SET filter_json = COALESCE(bs.filter_json, '{}'::jsonb)
                  || jsonb_build_object('topic_ids', r.after_ids, 'topic_slugs', r.after_slugs)
FROM resolved r
WHERE bs.id = r.section_id
  AND (bs.filter_json -> 'topic_ids') IS DISTINCT FROM r.after_ids;

DO $$
DECLARE
  v_sections INT;
  v_topics   INT;
BEGIN
  SELECT COUNT(*) INTO v_sections FROM blueprint_sections;
  SELECT COUNT(*) INTO v_topics FROM (
    SELECT DISTINCT jsonb_array_elements_text(filter_json -> 'topic_ids') AS topic_id
    FROM blueprint_sections
  ) referenced;
  RAISE NOTICE 'QBANK021: widened % sections, which now reference % distinct topics', v_sections, v_topics;
END $$;
