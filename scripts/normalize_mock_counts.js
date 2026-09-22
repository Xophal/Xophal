const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) { console.error('Missing SUPABASE env'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  // find mock tests mentioning METALS
  const { data: mks } = await supabase.from('mock_tests').select('id, title, slug, chapter_id').ilike('title', '%METALS%');
  if (!mks || mks.length === 0) {
    console.log('No mock tests matching METALS found'); return;
  }
  for (const mk of mks) {
    // 1) count mock_test_questions
    const { count: mtqCount } = await supabase.from('mock_test_questions').select('question_id', { count: 'exact' }).eq('mock_test_id', mk.id);
    if (mtqCount && mtqCount > 0) {
      const { data: rows } = await supabase.from('mock_test_questions').select('marks').eq('mock_test_id', mk.id);
      const totalMarks = (rows || []).reduce((s, r) => s + (Number(r.marks) || 0), 0);
      const { error } = await supabase.from('mock_tests').update({ total_questions: mtqCount, total_marks: totalMarks }).eq('id', mk.id);
      if (error) console.error('Failed update', mk.id, error); else console.log('Updated from mock_test_questions', mk.id, mtqCount, totalMarks);
      continue;
    }
    // 2) count questions by chapter
    if (mk.chapter_id) {
      const { count: qCount } = await supabase.from('questions').select('id', { count: 'exact' }).eq('chapter_id', mk.chapter_id);
      if (qCount && qCount > 0) {
        const { data: qrows } = await supabase.from('questions').select('marks').eq('chapter_id', mk.chapter_id);
        const totalMarks = (qrows || []).reduce((s, r) => s + (Number(r.marks) || 0), 0);
        const { error } = await supabase.from('mock_tests').update({ total_questions: qCount, total_marks: totalMarks }).eq('id', mk.id);
        if (error) console.error('Failed update', mk.id, error); else console.log('Updated from questions by chapter', mk.id, qCount, totalMarks);
        continue;
      }
    }
    // 3) fallback to CSV
    const qCsvPath = path.join(process.cwd(), 'docs', 'imports', 'questions.csv');
    if (fs.existsSync(qCsvPath)) {
      const lines = fs.readFileSync(qCsvPath, 'utf8').replace(/\r\n/g,'\n').split('\n').filter(Boolean);
      const count = Math.max(0, lines.length - 1);
      // sum marks column if present
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const marksIdx = headers.indexOf('marks');
      let totalMarks = 0;
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const m = marksIdx >=0 ? Number((parts[marksIdx]||'d').replace(/"/g,'')) || 1 : 1;
        totalMarks += m;
      }
      const { error } = await supabase.from('mock_tests').update({ total_questions: count, total_marks: totalMarks }).eq('id', mk.id);
      if (error) console.error('Failed update', mk.id, error); else console.log('Updated from CSV fallback', mk.id, count, totalMarks);
      continue;
    }
    console.log('Could not determine counts for mock_test', mk.id);
  }
}

run();
