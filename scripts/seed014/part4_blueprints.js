// Part 4a: blueprints + sections (slug-resolved topic_ids inside filter_json).
const { q, uuid, jbDollar } = require('./sqlutil');
function topicsExpr(slugs) {
  const list = slugs.map(function(s) { return "'" + q(s) + "'"; }).join(',');
  return "(SELECT COALESCE(jsonb_agg(tp.id ORDER BY tp.sort_order),'[]'::jsonb) FROM topics tp JOIN chapters ch ON tp.chapter_id=ch.id JOIN subjects s ON ch.subject_id=s.id JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id WHERE b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions' AND tp.code IN (" + list + '))';
}
function filterExpr(f) {
  const parts = [];
  parts.push("'topic_ids', " + topicsExpr(f.topic_slugs));
  parts.push("'topic_slugs', '" + JSON.stringify(f.topic_slugs).replace(/'/g,"''") + "'::jsonb");
  parts.push("'types', '" + JSON.stringify(f.types).replace(/'/g,"''") + "'::jsonb");
  parts.push("'difficulty_min', " + f.dmin);
  parts.push("'difficulty_max', " + f.dmax);
  parts.push("'skills', '" + JSON.stringify(f.skills).replace(/'/g,"''") + "'::jsonb");
  parts.push("'tags', '" + JSON.stringify(f.tags).replace(/'/g,"''") + "'::jsonb");
  parts.push("'pyq_only', " + (f.pyq_only ? 'true' : 'false'));
  return 'jsonb_build_object(' + parts.join(',') + ')';
}
function part4(bps) {
  let s = '-- 9. Blueprints (6 starter blueprints)\n';
  for (const b of bps) {
    s += 'INSERT INTO blueprints (id,name,slug,description,kind,duration_sec,total_marks,marking_scheme_json,shuffle_questions,shuffle_options,is_public,chapter_id,subject_id)\n';
    s += "SELECT '" + uuid('ch1bp-' + b.slug) + "','" + q(b.name) + "','" + q(b.slug) + "','" + q(b.desc) + "','" + b.kind + "'," + b.duration + ',' + b.marks + ',' + jbDollar(b.marking) + '::jsonb,' + (b.shuffleQ ? 'true' : 'false') + ',' + (b.shuffleO ? 'true' : 'false') + ',true,ch.id,s.id\n';
    s += 'FROM chapters ch JOIN subjects s ON ch.subject_id=s.id JOIN classes c ON s.class_id=c.id JOIN boards b2 ON c.board_id=b2.id\n';
    s += "WHERE b2.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions'\n";
    s += 'ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, kind=EXCLUDED.kind, duration_sec=EXCLUDED.duration_sec, total_marks=EXCLUDED.total_marks, marking_scheme_json=EXCLUDED.marking_scheme_json, shuffle_questions=EXCLUDED.shuffle_questions, shuffle_options=EXCLUDED.shuffle_options, is_public=true;\n';
  }
  s += '\n-- 10. Blueprint sections\n';
  for (const b of bps) {
    for (const sec of b.sections) {
      s += 'INSERT INTO blueprint_sections (id,blueprint_id,title,position,filter_json,count,marks_per_q,neg_marks,instructions)\n';
      s += "SELECT '" + uuid('ch1bs-' + b.slug + sec.pos) + "',bl.id,'" + q(sec.title) + "'," + sec.pos + ',' + filterExpr(sec.filter) + ',' + sec.count + ',' + sec.mpq + ',' + sec.neg + ",'" + q(sec.instr) + "'\n";
      s += "FROM blueprints bl WHERE bl.slug='" + q(b.slug) + "'\n";
      s += 'ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, position=EXCLUDED.position, filter_json=EXCLUDED.filter_json, count=EXCLUDED.count, marks_per_q=EXCLUDED.marks_per_q, neg_marks=EXCLUDED.neg_marks, instructions=EXCLUDED.instructions;\n';
    }
  }
  return s + '\n';
}
module.exports = { part4 };
