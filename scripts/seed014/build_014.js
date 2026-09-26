// Build script: assembles 014_seed_class10_science_ch1.sql from data files.
const fs = require('fs');
const path = require('path');
const { part1 } = require('./part1_taxonomy');
const { part2 } = require('./part2_questions');
const { part3 } = require('./part3_options');
const { part4 } = require('./part4_blueprints');
const { part5 } = require('./part5_verify');
const qfiles = ['q01_mcq_a','q02_mcq_b','q03_ar','q04_match','q05_stmt_case','q06_casechild','q07_fill_eq','q08_eq_short','q09_short_long','q10_booster'];
let rows = [];
for (const f of qfiles) { rows = rows.concat(require('./' + f + '.js')); }
const bps = require('./bp_a.js').concat(require('./bp_b.js'));
const sql = part1() + part2(rows) + part3(rows) + part4(bps) + part5();
const out = path.join(__dirname, '..', '..', 'supabase', 'migrations', '014_seed_class10_science_ch1.sql');
fs.writeFileSync(out, sql, 'utf8');
console.log('wrote', out, 'bytes', sql.length, 'questions', rows.length, 'blueprints', bps.length);
const byType = {};
for (const r of rows) { byType[r.t] = (byType[r.t] || 0) + 1; }
console.log('byType', JSON.stringify(byType));
