const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) { console.error('Missing SUPABASE env'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: mks } = await supabase.from('mock_tests').select('id, title, total_questions');
  if (!mks) return console.log('No mock tests');
  for (const mk of mks) {
    const { count } = await supabase.from('mock_test_questions').select('question_id', { count: 'exact' }).eq('mock_test_id', mk.id);
    const attached = count || 0;
    if (attached !== mk.total_questions) {
      if (attached === 0) { console.log('Skipping', mk.id, mk.title, 'attached=0'); continue; }
      const { error } = await supabase.from('mock_tests').update({ total_questions: attached }).eq('id', mk.id);
      if (error) console.error('Failed update', mk.id, error); else console.log('Synced', mk.id, mk.title, attached);
    }
  }
}
run();
