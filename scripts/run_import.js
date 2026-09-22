const fs = require('fs');
const path = require('path');
// Load environment variables from .env.local if present, otherwise .env
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

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

const outDir = path.join(process.cwd(), 'docs', 'imports');
if (!fs.existsSync(outDir)) {
  console.error('No docs/imports directory found. Run prepare_import_from_csv.js first.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Supabase credentials not found in env. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function upsertBoard(row) {
  const code = row.code || row.board_code || row.code;
  const name = row.name || '';
  if (!code) return null;
  const { data: existing } = await supabase.from('boards').select('id').eq('code', code).maybeSingle();
  if (existing?.id) return existing.id;
  const slug = (row.slug || String(code)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { data, error } = await supabase.from('boards').insert([{ code, name, slug }]).select('id').maybeSingle();
  if (error) { console.error('Board insert error', error); return null; }
  return data?.id;
}

async function upsertClass(row, boardId) {
  const code = row.code || row.class_code || row.code;
  const name = row.name || '';
  if (!code) return null;
  const { data: existing } = await supabase.from('classes').select('id').eq('code', code).maybeSingle();
  if (existing?.id) return existing.id;
  const slug = (row.slug || String(code)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const payload = { board_id: boardId, code, name, slug };
  const { data, error } = await supabase.from('classes').insert([payload]).select('id').maybeSingle();
  if (error) { console.error('Class insert error', error); return null; }
  return data?.id;
}

async function upsertSubject(row, classId) {
  const code = row.code || row.subject_code || row.code;
  const name = row.name || '';
  if (!code) return null;
  const { data: existing } = await supabase.from('subjects').select('id').eq('code', code).maybeSingle();
  if (existing?.id) return existing.id;
  const slug = (row.slug || String(code)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const payload = { class_id: classId, code, name, slug };
  const { data, error } = await supabase.from('subjects').insert([payload]).select('id').maybeSingle();
  if (error) { console.error('Subject insert error', error); return null; }
  return data?.id;
}

async function upsertChapter(row, subjectId) {
  const code = row.code || row.chapter_code || row.code;
  const name = row.name || '';
  if (!code) return null;
  const { data: existing } = await supabase.from('chapters').select('id').eq('code', code).maybeSingle();
  if (existing?.id) return existing.id;
  const slug = (row.slug || String(code)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const payload = { subject_id: subjectId, code, name, slug };
  const { data, error } = await supabase.from('chapters').insert([payload]).select('id').maybeSingle();
  if (error) { console.error('Chapter insert error', error); return null; }
  return data?.id;
}

async function insertMockTest(row, chapterId) {
  const title = row.title || row.name || 'Untitled';
  const slug = row.slug || (title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const description = row.description || '';
  const total_questions = row.total_questions ? Number(row.total_questions) : null;
  const total_marks = row.total_marks ? Number(row.total_marks) : null;
  const duration_minutes = row.duration_minutes ? Number(row.duration_minutes) : (row.duration_minutes ? Number(row.duration_minutes) : 60);
  // Ensure there is a valid test_type_id
  let { data: tt } = await supabase.from('test_types').select('id').limit(1).maybeSingle();
  let testTypeId = tt?.id;
  if (!testTypeId) {
    const { data: created, error: createErr } = await supabase.from('test_types').insert([{ name: 'Auto', code: 'AUTO' }]).select('id').maybeSingle();
    if (createErr) console.error('Failed to create default test_type', createErr);
    testTypeId = created?.id;
  }

  const payload = { title, slug, description, chapter_id: chapterId, test_type_id: testTypeId, total_questions, total_marks, duration_minutes, is_published: true, is_active: true };
  const { data, error } = await supabase.from('mock_tests').insert([payload]).select('id').maybeSingle();
  if (error) { console.error('Mock test insert error', error); return null; }
  return data?.id;
}

async function insertQuestion(row, chapterId) {
  const stem = row.question_text || row.question || row.stem || '';
  if (!stem) return null;
  // minimal payload: include only commonly-present columns to avoid schema mismatch
  const payload = {
    chapter_id: chapterId,
    type: row.question_type || 'MCQ',
    stem,
    explanation: row.explanation || null,
    marks: row.marks ? Number(row.marks) : 1,
    negative_marks: row.negative_marks ? Number(row.negative_marks) : 0,
  };
  const { data, error } = await supabase.from('questions').insert([payload]).select('id').maybeSingle();
  if (error) { console.error('Question insert error', error); return null; }
  const qid = data?.id;
  const options = [];
  if (row.option_a) options.push({ label: 'A', text: row.option_a, is_correct: (row.correct_option || '').toUpperCase() === 'A' });
  if (row.option_b) options.push({ label: 'B', text: row.option_b, is_correct: (row.correct_option || '').toUpperCase() === 'B' });
  if (row.option_c) options.push({ label: 'C', text: row.option_c, is_correct: (row.correct_option || '').toUpperCase() === 'C' });
  if (row.option_d) options.push({ label: 'D', text: row.option_d, is_correct: (row.correct_option || '').toUpperCase() === 'D' });
  if (options.length) {
    const inserts = options.map((opt, i) => ({ question_id: qid, label: opt.label, text: opt.text, is_correct: !!opt.is_correct, sort_order: i }));
    const { error: optErr } = await supabase.from('question_options').insert(inserts);
    if (optErr) console.error('Question options insert error', optErr);
  }
  return qid;
}

async function run() {
  try {
    // boards
    const boardsCsv = fs.readFileSync(path.join(outDir, 'boards.csv'), 'utf8');
    const boards = parseCsv(boardsCsv);
    for (const b of boards) {
      await upsertBoard(b);
    }

    // classes
    const classesCsv = fs.readFileSync(path.join(outDir, 'classes.csv'), 'utf8');
    const classes = parseCsv(classesCsv);
    for (const c of classes) {
      const boardCode = c.board_code || c.board_code || c.board || 'CBSE';
      const { data: board } = await supabase.from('boards').select('id').eq('code', boardCode).maybeSingle();
      const boardId = board?.id;
      await upsertClass(c, boardId);
    }

    // subjects
    const subjectsCsv = fs.readFileSync(path.join(outDir, 'subjects.csv'), 'utf8');
    const subjects = parseCsv(subjectsCsv);
    for (const s of subjects) {
      const classCode = s.class_code || s.class_code || s.class || '10';
      const { data: klass } = await supabase.from('classes').select('id').eq('code', classCode).maybeSingle();
      const classId = klass?.id;
      await upsertSubject(s, classId);
    }

    // chapters
    const chaptersCsv = fs.readFileSync(path.join(outDir, 'chapters.csv'), 'utf8');
    const chapters = parseCsv(chaptersCsv);
    for (const ch of chapters) {
      const subjectCode = ch.subject_code || ch.subject_code || ch.subject || 'SCIENCE';
      const { data: subject } = await supabase.from('subjects').select('id').eq('code', subjectCode).maybeSingle();
      const subjectId = subject?.id;
      await upsertChapter(ch, subjectId);
    }

    // mock test: use chapter code from chapters.csv first row
    const mkCsv = fs.readFileSync(path.join(outDir, 'mock_tests.csv'), 'utf8');
    const mks = parseCsv(mkCsv);
    let chapterIdForMock = null;
    if (mks.length) {
      const chapterCode = process.env.CHAPTER_CODE || chapters[0]?.code || chapters[0]?.chapter_code;
      const { data: ch } = await supabase.from('chapters').select('id').eq('code', chapterCode).maybeSingle();
      chapterIdForMock = ch?.id;
      // insert mock tests and keep their IDs
      var mockTestIds = [];
      for (const mk of mks) {
        const id = await insertMockTest(mk, chapterIdForMock);
        if (id) mockTestIds.push(id);
      }
    }

    // questions
    const qCsv = fs.readFileSync(path.join(outDir, 'questions.csv'), 'utf8');
    const qs = parseCsv(qCsv);
    // attach questions to the first mock test (if exists) and update counts
    const mockTestId = (typeof mockTestIds !== 'undefined' && mockTestIds.length) ? mockTestIds[0] : null;
    let sortOrder = 1;
    for (const q of qs) {
      const qid = await insertQuestion(q, chapterIdForMock);
      if (qid && mockTestId) {
        const marks = q.marks ? Number(q.marks) : 1;
        const { error: attachErr } = await supabase.from('mock_test_questions').insert([{ mock_test_id: mockTestId, question_id: qid, sort_order: sortOrder, marks }]);
        if (attachErr) console.error('Attach question error', attachErr);
        sortOrder++;
      }
    }

    // update mock_test counts if we attached questions
    if (mockTestId) {
      // compute total questions and sum of marks
      const { count: qCount } = await supabase.from('mock_test_questions').select('question_id', { count: 'exact' }).eq('mock_test_id', mockTestId);
      const { data: rows, error: rerr } = await supabase.from('mock_test_questions').select('marks').eq('mock_test_id', mockTestId);
      let totalQuestions = qCount || 0;
      let totalMarks = 0;
      if (!rerr && rows) totalMarks = rows.reduce((s, r) => s + (Number(r.marks) || 0), 0);
      const upd = {};
      if (totalQuestions !== null) upd.total_questions = totalQuestions;
      if (totalMarks !== null) upd.total_marks = totalMarks;
      if (Object.keys(upd).length) {
        const { error: upErr } = await supabase.from('mock_tests').update(upd).eq('id', mockTestId);
        if (upErr) console.error('Failed to update mock_test counts', upErr);
      }
    }

    console.log('Import completed.');
  } catch (err) {
    console.error('Import failed:', err);
  }
}

run();
