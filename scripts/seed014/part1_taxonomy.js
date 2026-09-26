// Part 1: header + taxonomy + question_types/difficulty rows.
const { TOPICS } = require('./taxonomy');
function part1() {
  let s = '';
  s += '-- ============================================================================\n';
  s += '-- Migration 014: Class 10 Science Ch1 seed (Chemical Reactions and Equations)\n';
  s += '-- Idempotent: safe to re-run. Deterministic UUIDs via sha1 seeds.\n';
  s += '-- Depends on: 001 (boards/classes/subjects/chapters/topics/questions),\n';
  s += '--   003 (CBSE Class 10 Science chapters), 013 (subtopics, engine columns,\n';
  s += '--   question_answers/tags/stats, blueprints/sections).\n';
  s += '-- ============================================================================\n\n';
  s += "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='engine_question_type') THEN RAISE EXCEPTION '013 must run first'; END IF; END $$;\n\n";
  s += '-- 1. Question type + difficulty lookups for legacy FK columns\n';
  s += "INSERT INTO question_types (code,name,description,sort_order) VALUES\n";
  s += " ('single_correct','Single Correct','One correct option',1),\n ('multiple_correct','Multiple Correct','Multiple correct options',2),\n ('true_false','True/False','True or False',3),\n ('fill_blank','Fill in the Blank','Fill missing word',4),\n ('assertion_reason','Assertion-Reason','Assertion and Reason',7),\n ('match_following','Match the Following','Match two columns',6),\n ('case_study','Case Study','Passage with linked questions',8),\n ('descriptive','Descriptive','Short/long written answer',12),\n ('equation_balancing','Equation Balancing','Write and balance equations',13)\nON CONFLICT (code) DO NOTHING;\n\n";
  s += "INSERT INTO difficulty_levels (code,name,weight,color,sort_order) VALUES\n";
  s += " ('easy','Easy',1.0,'#22c55e',1),('medium','Medium',2.0,'#f59e0b',2),('hard','Hard',3.0,'#ef4444',3)\nON CONFLICT (code) DO NOTHING;\n\n";
  s += '-- 2. SEBA Class 10 Science chapter (CBSE one already exists from 003)\n';
  s += 'INSERT INTO chapters (subject_id,code,name,slug,chapter_number,sort_order)\n';
  s += "SELECT s.id,'chemical-reactions','Chemical Reactions and Equations','chemical-reactions',1,1\n";
  s += 'FROM subjects s JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id\n';
  s += "WHERE b.code='seba' AND c.code='class-10' AND s.code='science'\n";
  s += 'ON CONFLICT DO NOTHING;\n\n';
  s += '-- 3. Topics under the CBSE chapter (canonical content spine)\n';
  for (const t of TOPICS) {
    s += 'INSERT INTO topics (chapter_id,code,name,slug,sort_order)\n';
    s += "SELECT ch.id,'" + t.code + "','" + t.name.replace(/'/g,"''") + "','" + t.slug + "'," + t.order + '\n';
    s += 'FROM chapters ch JOIN subjects s ON ch.subject_id=s.id JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id\n';
    s += "WHERE b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions'\n";
    s += 'ON CONFLICT DO NOTHING;\n';
  }
  s += '\n-- 4. Subtopics\n';
  for (const t of TOPICS) {
    for (const st of t.subs) {
      s += 'INSERT INTO subtopics (topic_id,code,name,slug,sort_order)\n';
      s += "SELECT tp.id,'" + st.code + "','" + st.name.replace(/'/g,"''") + "','" + st.slug + "'," + st.order + '\n';
      s += 'FROM topics tp JOIN chapters ch ON tp.chapter_id=ch.id JOIN subjects s ON ch.subject_id=s.id JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id\n';
      s += "WHERE b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions' AND tp.code='" + t.code + "'\n";
      s += 'ON CONFLICT DO NOTHING;\n';
    }
  }
  return s + '\n';
}
module.exports = { part1 };
