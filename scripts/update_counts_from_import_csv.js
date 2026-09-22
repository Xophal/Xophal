const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const outDir = path.join(process.cwd(), 'docs', 'imports');
if (!fs.existsSync(path.join(outDir, 'questions.csv'))) {
  console.error('docs/imports/questions.csv not found. Run prepare_import_from_csv.js first.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Supabase credentials not found in env.'); process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    const obj = {};
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = (parts[i] || '').trim();
    return obj;
  });
}

async function run() {
  const qCsv = fs.readFileSync(path.join(outDir, 'questions.csv'), 'utf8');
  const rows = parseCsv(qCsv);
  // If questions.csv has no chapter mapping, fall back to using mock_tests.csv mapping
  const hasChapter = Object.keys(rows[0] || {}).some(k => k.includes('chapter'));
  if (!hasChapter) {
    // read mock_tests.csv to find target mock test(s)
    const mkCsvPath = path.join(outDir, 'mock_tests.csv');
    if (!fs.existsSync(mkCsvPath)) { console.error('mock_tests.csv missing and questions.csv lacks chapter info'); return; }
    const mkCsv = fs.readFileSync(mkCsvPath, 'utf8');
    const mks = parseCsv(mkCsv);
    const totalCount = rows.length;
    const totalMarks = rows.reduce((s, r) => s + (Number(r.marks || 1) || 1), 0);
    for (const mk of mks) {
      // find mock_test by slug or title
      const slug = (mk.slug || mk.title || '').toString();
      let { data: found } = await supabase.from('mock_tests').select('id, title').ilike('slug', slug).limit(1).maybeSingle();
      if (!found) {
        // try title match
        const { data: f2 } = await supabase.from('mock_tests').select('id, title').ilike('title', `%${mk.title}%`).limit(1).maybeSingle();
        found = f2;
      }
      if (!found) {
        console.log('No matching mock_test found for import row', mk); continue;
      }
      const upd = { total_questions: totalCount, total_marks: totalMarks };
      const { error } = await supabase.from('mock_tests').update(upd).eq('id', found.id);
      if (error) console.error('Failed updating', found.id, error); else console.log('Updated mock_test', found.id, found.title, upd);
    }
    return;
  }

  // group by chapter code detected in CSV
  const chapterKeyCandidates = ['chapter_code','chapter','chapter_code '];
  const chapterKey = Object.keys(rows[0] || {}).find(k => k.includes('chapter'));
  if (!chapterKey) { console.error('Could not detect chapter column in questions.csv'); return; }
  const groups = {};
  for (const r of rows) {
    const ch = (r[chapterKey] || '').trim();
    if (!ch) continue;
    // normalize code: remove 'Chapter - ' and anything after colon
    let code = ch.replace(/chapter\s*-?\s*/i, '').trim();
    // attempt to extract short code like METALS_NON_METALS from questions import (some scripts used code field)
    code = code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    groups[code] = groups[code] || { count: 0, marks: 0 };
    groups[code].count += 1;
    const marks = Number(r.marks || 1) || 1;
    groups[code].marks += marks;
  }

  for (const code of Object.keys(groups)) {
    // try to find chapter by code or name
    const { data: ch } = await supabase.from('chapters').select('id, code, name').ilike('code', `%${code}%`).limit(1).maybeSingle();
    let chapterId = ch?.id;
    if (!chapterId) {
      // try by name
      const { data: ch2 } = await supabase.from('chapters').select('id, code, name').ilike('name', `%${code.replace(/_/g, ' ')}%`).limit(1).maybeSingle();
      chapterId = ch2?.id;
    }
    if (!chapterId) {
      console.log('No chapter found for code', code, '; skipping');
      continue;
    }
    // find mock tests for this chapter
    const { data: mks } = await supabase.from('mock_tests').select('id, title').eq('chapter_id', chapterId);
    if (!mks || mks.length === 0) {
      console.log('No mock_tests for chapter', code); continue;
    }
    for (const mk of mks) {
      const upd = { total_questions: groups[code].count, total_marks: groups[code].marks };
      const { error } = await supabase.from('mock_tests').update(upd).eq('id', mk.id);
      if (error) console.error('Failed updating', mk.id, error); else console.log('Updated mock_test', mk.id, mk.title, upd);
    }
  }
}

run();
