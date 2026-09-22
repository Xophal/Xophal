const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
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
    for (let i = 0; i < headers.length; i++) obj[headers[i].toLowerCase()] = (parts[i] || '').trim();
    return obj;
  });
}

if (process.argv.length < 3) {
  console.error('Usage: node prepare_import_from_csv.js <source-csv-path> [options]');
  console.error('Options via ENV: BOARD_CODE, CLASS_CODE, SUBJECT_CODE, CHAPTER_CODE, MOCK_TITLE');
  process.exit(1);
}

const src = process.argv[2];
const text = fs.readFileSync(src, 'utf8');
const rows = parseCsv(text);

const boardCode = process.env.BOARD_CODE || 'CBSE';
const classCode = process.env.CLASS_CODE || '10';
const subjectCode = process.env.SUBJECT_CODE || 'SCIENCE';
const chapterCode = process.env.CHAPTER_CODE || 'METALS_NON_METALS';
const mockTitle = process.env.MOCK_TITLE || `Class ${classCode} ${subjectCode} - ${chapterCode} Mock Test`;

const outDir = path.join(process.cwd(), 'docs', 'imports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// boards.csv
const boardsCsv = `code,name\n${boardCode},Central Board of Secondary Education`;
fs.writeFileSync(path.join(outDir, 'boards.csv'), boardsCsv);

// classes.csv (board_id must be provided by DB after import; we set code only)
const classesCsv = `board_code,code,name\n${boardCode},${classCode},Class ${classCode}`;
fs.writeFileSync(path.join(outDir, 'classes.csv'), classesCsv);

// subjects.csv
const subjectsCsv = `class_code,code,name\n${classCode},${subjectCode},Science`;
fs.writeFileSync(path.join(outDir, 'subjects.csv'), subjectsCsv);

// chapters.csv
const chaptersCsv = `subject_code,code,name\n${subjectCode},${chapterCode},Metals and Non-metals`;
fs.writeFileSync(path.join(outDir, 'chapters.csv'), chaptersCsv);

// mock_tests.csv
const mockCsv = `title,type,slug,description,total_questions,total_marks,duration_minutes,is_published,is_active\n"${mockTitle}",CLASS_TEST,${chapterCode.toLowerCase()}-mock,"Auto-generated mock for ${chapterCode}",${rows.length},${rows.length},60,true,true`;
fs.writeFileSync(path.join(outDir, 'mock_tests.csv'), mockCsv);

// questions.csv - map common columns
// Expected minimal columns per cms-import: question_text, question_type, topic_id (we will leave topic_id blank and rely on topic import or manual mapping)
const questionHeaders = ['question_text','question_type','option_a','option_b','option_c','option_d','correct_option','marks','negative_marks','year','explanation'];
const questions = rows.map(r => {
  const q = r.question || r.question_text || r.stem || Object.values(r)[0] || '';
  const optA = r.option_a || r.option1 || r.a || '';
  const optB = r.option_b || r.option2 || r.b || '';
  const optC = r.option_c || r.option3 || r.c || '';
  const optD = r.option_d || r.option4 || r.d || '';
  const correct = r.correct_option || r.answer || '';
  const marks = r.marks || '1';
  const negative = r.negative_marks || '0';
  const year = r.year || '';
  const explanation = r.explanation || r.solution || '';
  return [
    `"${q.replace(/"/g,'""')}"`,
    'MCQ',
    `"${optA.replace(/"/g,'""')}"`,
    `"${optB.replace(/"/g,'""')}"`,
    `"${optC.replace(/"/g,'""')}"`,
    `"${optD.replace(/"/g,'""')}"`,
    correct,
    marks,
    negative,
    year,
    `"${String(explanation).replace(/"/g,'""')}"`
  ].join(',');
});
const questionsCsv = questionHeaders.join(',') + '\n' + questions.join('\n');
fs.writeFileSync(path.join(outDir, 'questions.csv'), questionsCsv);

console.log('Prepared import files in docs/imports:');
console.log('- boards.csv');
console.log('- classes.csv');
console.log('- subjects.csv');
console.log('- chapters.csv');
console.log('- mock_tests.csv');
console.log('- questions.csv');
console.log('Next: go to /admin/content/imports in the app and upload these CSVs in the order: boards -> classes -> subjects -> chapters -> mock_tests -> questions');
