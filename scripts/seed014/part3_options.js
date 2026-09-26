// Part 3a: options + answers + tags + stats.
const { q, uuid, jbDollar } = require('./sqlutil');
const LETTERS = ['A','B','C','D','E','F'];
function canonAns(r) {
  if (r.t === 'mcq' || r.t === 'assertion_reason' || r.t === 'match' || r.t === 'statement') {
    const idx = r.opts.findIndex(function(o) { return o[1] === 1; });
    const L = LETTERS[idx < 0 ? 0 : idx];
    return { correct_options: [L], value: L };
  }
  if (r.t === 'fill_blank') return { blanks: r.ans.blanks, accept_case_insensitive: true, trim_whitespace: true };
  if (r.t === 'equation') return { balanced_equations: r.ans.equations, check_atom_balance: true, allow_state_symbol_variants: true };
  if (r.t === 'short' || r.t === 'long') return { key_points: r.ans.text, graded_by: 'rubric_or_ai' };
  return { value: 'case_passage' };
}
function canonRub(r) {
  if (r.t === 'mcq' || r.t === 'assertion_reason' || r.t === 'match' || r.t === 'statement') return { criteria: r.rub, partial_credit: false };
  if (r.t === 'fill_blank') return { criteria: r.rub, per_blank_marks: true };
  if (r.t === 'equation') return { criteria: r.rub, marks_split: 'formulae_plus_balance' };
  if (r.t === 'short' || r.t === 'long') return { criteria: r.rub, key_points: r.ans ? r.ans.text : [] };
  return { criteria: r.rub };
}
function part3(rows) {
  let s = '-- 6. Options (objective rows only)\n';
  for (const r of rows) {
    if (!r.opts || !r.opts.length) continue;
    const qid = uuid('ch1q-' + r.code);
    for (let i = 0; i < r.opts.length; i++) {
      const L = LETTERS[i];
      s += 'INSERT INTO question_options (id,question_id,option_text,option_html,is_correct,sort_order,label,body,position)\n';
      s += "VALUES ('" + uuid('ch1o-' + r.code + L) + "','" + qid + "','" + q(r.opts[i][0]) + "','" + q(r.opts[i][0]) + "'," + (r.opts[i][1] === 1 ? 'true' : 'false') + ',' + i + ",'" + L + "','" + q(r.opts[i][0]) + "'," + i + ')\n';
      s += 'ON CONFLICT (id) DO UPDATE SET option_text=EXCLUDED.option_text, option_html=EXCLUDED.option_html, is_correct=EXCLUDED.is_correct, sort_order=EXCLUDED.sort_order, label=EXCLUDED.label, body=EXCLUDED.body, position=EXCLUDED.position;\n';
    }
  }
  s += '\n-- 7. Answers + rubrics + explanations\n';
  for (const r of rows) {
    const qid = uuid('ch1q-' + r.code);
    s += 'INSERT INTO question_answers (id,question_id,answer_json,rubric_json,explanation)\n';
    s += "VALUES ('" + uuid('ch1a-' + r.code) + "','" + qid + "'," + jbDollar(canonAns(r)) + '::jsonb,' + jbDollar(canonRub(r)) + "::jsonb,'" + q(r.expl) + "')\n";
    s += 'ON CONFLICT (question_id) DO UPDATE SET answer_json=EXCLUDED.answer_json, rubric_json=EXCLUDED.rubric_json, explanation=EXCLUDED.explanation;\n';
  }
  s += '\n-- 8. Tag rows + stats rows\n';
  for (const r of rows) {
    const qid = uuid('ch1q-' + r.code);
    for (const t of r.tags) {
      s += "INSERT INTO question_tags (id,question_id,tag) VALUES ('" + uuid('ch1t-' + r.code + t) + "','" + qid + "','" + q(t) + "') ON CONFLICT (id) DO NOTHING;\n";
    }
    s += "INSERT INTO question_stats (question_id,attempts,correct_count,correct_rate,avg_time) VALUES ('" + qid + "',0,0,0," + r.time + ') ON CONFLICT (question_id) DO NOTHING;\n';
  }
  return s + '\n';
}
module.exports = { part3 };
