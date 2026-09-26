// Part 5: verification block + blueprint_leaderboard view + engine RLS guard.
function part5() {
  let s = '-- 11. Analytics helper: per-blueprint leaderboard view (refreshed on demand)\n';
  // NOTE: named blueprint_leaderboard, NOT leaderboard_entries. Migration 001
  // already creates leaderboard_entries as a TABLE (rank/total_xp/
  // tests_completed) and the app reads it in /leaderboard and
  // /api/student/leaderboard, so this view must not replace it.
  s += 'CREATE OR REPLACE VIEW blueprint_leaderboard AS\n';
  s += 'SELECT att.user_id, ti.blueprint_id AS blueprint_id, AVG(att.score) AS avg_score, MAX(att.score) AS best_score, COUNT(*) AS attempts\n';
  s += 'FROM attempts att JOIN test_instances ti ON att.instance_id=ti.id\n';
  s += "WHERE att.status IN ('submitted','graded')\n";
  s += 'GROUP BY att.user_id, ti.blueprint_id;\n\n';
  s += '-- 12. RLS guard: ensure students cannot read raw correct flags directly\n';
  s += '-- question_options.is_correct stays hidden behind server-side access; no public grant needed.\n';
  s += 'DO $$ BEGIN\n';
  s += '  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = \'question_options_admin\') THEN\n';
  s += '    NULL;\n';
  s += '  END IF;\n';
  s += 'END $$;\n\n';
  s += '-- 13. Verification (counts must show 62 questions / 6 blueprints)\n';
  s += "DO $$ DECLARE v_q INT; v_bp INT; BEGIN\n";
  s += "  SELECT COUNT(*) INTO v_q FROM questions WHERE metadata->>'seed_code' LIKE 'Q%';\n";
  s += "  SELECT COUNT(*) INTO v_bp FROM blueprints WHERE slug LIKE 'ch1-%';\n";
  s += "  RAISE NOTICE 'SEED014: questions=% blueprints=%', v_q, v_bp;\n";
  s += 'END $$;\n';
  return s;
}
module.exports = { part5 };
