const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE env'); process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

async function fix() {
  try {
    // find mock tests with metals in title or slug
    const { data: mks, error } = await supabase.from('mock_tests').select('id, title, slug').ilike('title', '%metals%');
    if (error) { console.error('Search error', error); return; }
    if (!mks || mks.length === 0) {
      console.log('No mock tests found with metals in title; trying slug...');
      const { data: mks2 } = await supabase.from('mock_tests').select('id, title, slug').ilike('slug', '%metals%');
      if (!mks2 || mks2.length === 0) { console.log('No mock tests found.'); return; }
      mks = mks2;
    }
    for (const mk of mks) {
        let totalQuestions = 0;
        let totalMarks = 0;
        const { count } = await supabase.from('mock_test_questions').select('question_id', { count: 'exact' }).eq('mock_test_id', mk.id);
        if (count && count > 0) {
          const { data: rows } = await supabase.from('mock_test_questions').select('marks').eq('mock_test_id', mk.id);
          totalQuestions = count;
          totalMarks = (rows || []).reduce((s, r) => s + (Number(r.marks) || 0), 0);
        } else {
          // fallback: if mock_test_questions empty, try counting questions by chapter
          // find chapter by slug or from mock_test record
          const { data: mt } = await supabase.from('mock_tests').select('chapter_id').eq('id', mk.id).maybeSingle();
          const chapterId = mt?.chapter_id;
          if (chapterId) {
            const { count: qbyc } = await supabase.from('questions').select('id', { count: 'exact' }).eq('chapter_id', chapterId);
            totalQuestions = qbyc || 0;
            const { data: qrows } = await supabase.from('questions').select('marks').eq('chapter_id', chapterId);
            totalMarks = (qrows || []).reduce((s, r) => s + (Number(r.marks) || 0), 0);
          }
        }
        const upd = { total_questions: totalQuestions || 0, total_marks: totalMarks || 0 };
      const { error: upErr } = await supabase.from('mock_tests').update(upd).eq('id', mk.id);
      if (upErr) console.error('Update error for', mk.id, upErr); else console.log('Updated', mk.id, mk.title, upd);
    }
  } catch (e) { console.error(e); }
}

fix();
