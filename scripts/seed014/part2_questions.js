// Part 2a: question rows (parents first, then children).
const { q, uuid } = require('./sqlutil');
const QTYPE = { mcq:'single_correct', assertion_reason:'assertion_reason', match:'match_following', statement:'true_false', case_based:'case_study', fill_blank:'fill_blank', equation:'equation_balancing', short:'descriptive', long:'descriptive' };
const DIFF = { 1:'easy', 2:'medium', 3:'hard' };
function rowSql(r) {
  const id = uuid('ch1q-' + r.code);
  const parent = r.parent ? "'" + uuid('ch1q-' + r.parent) + "'" : 'NULL';
  const pyq = r.pyq ? r.pyq : 'NULL';
  return 'INSERT INTO questions (id,question_type_id,difficulty_level_id,topic_id,chapter_id,subject_id,question_text,explanation,marks,negative_marks,time_seconds,tags,metadata,is_active,is_verified,engine_type,stem,parent_id,subtopic_id,difficulty,skill,neg_marks,est_time_sec,board_pattern,pyq_year,lang,engine_status,source)\n'
  + "SELECT '" + id + "',qt.id,dl.id,tp.id,ch.id,s.id,'" + q('CH1-' + r.code + ': ' + r.stem) + "','" + q(r.expl) + "'," + r.marks + ',' + r.neg + ',' + r.time + ",'" + '{' + r.tags.map(function(x){return '"' + x + '"';}).join(',') + "}'::text[],'" + q(JSON.stringify({ seed_code: r.code, topic_code: r.topic, subtopic_code: r.sub })) + "'::jsonb,true,true,'" + r.t + "','" + q(r.stem) + "'," + parent + ',st.id,' + r.d + ",'" + r.skill + "'," + r.neg + ',' + r.time + ",'" + r.board + "'," + pyq + ",'en','published','manual'\n"
  + 'FROM question_types qt, difficulty_levels dl, topics tp JOIN chapters ch ON tp.chapter_id=ch.id JOIN subjects s ON ch.subject_id=s.id JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id LEFT JOIN subtopics st ON st.topic_id=tp.id AND st.code=\'' + r.sub + "'\n"
  + "WHERE qt.code='" + QTYPE[r.t] + "' AND dl.code='" + DIFF[r.d] + "' AND b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions' AND tp.code='" + r.topic + "'\n"
  + 'ON CONFLICT (id) DO UPDATE SET question_text=EXCLUDED.question_text, explanation=EXCLUDED.explanation, marks=EXCLUDED.marks, negative_marks=EXCLUDED.negative_marks, time_seconds=EXCLUDED.time_seconds, tags=EXCLUDED.tags, metadata=EXCLUDED.metadata, is_active=true, is_verified=true, engine_type=EXCLUDED.engine_type, stem=EXCLUDED.stem, parent_id=EXCLUDED.parent_id, subtopic_id=EXCLUDED.subtopic_id, difficulty=EXCLUDED.difficulty, skill=EXCLUDED.skill, neg_marks=EXCLUDED.neg_marks, est_time_sec=EXCLUDED.est_time_sec, board_pattern=EXCLUDED.board_pattern, pyq_year=EXCLUDED.pyq_year, engine_status=\'published\', source=\'manual\';\n';
}
function part2(rows) {
  let s = '-- 5. Questions (deterministic ids ch1q-Q..; parents first)\n';
  const ordered = rows.slice().sort(function(a, b) { return ((a.parent ? 1 : 0) - (b.parent ? 1 : 0)) || (a.code < b.code ? -1 : 1); });
  for (const r of ordered) { s += rowSql(r); }
  return s + '\n';
}
module.exports = { part2 };
