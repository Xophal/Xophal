/**
 * Builds supabase/migrations/017_question_bank_ch1_import.sql from the CSV
 * question bank in docs/imports/ch1-class10-science/.
 *
 * Why a generated migration instead of the zip's import-question-bank.mjs:
 * that script targets the throwaway MASTER PROMPT schema (topics.level,
 * topics.parent_id, questions.legacy_id, question_options.label|body|position).
 * This app's schema is boards -> classes -> subjects -> chapters -> topics ->
 * subtopics, with dual-written engine columns (migration 013) and legacy FK
 * columns (question_types, difficulty_levels). The generated SQL resolves every
 * FK by code at run time, so it is board-agnostic and safe to re-run.
 *
 * Everything lands as draft / is_verified = false. Nothing is published.
 *
 * Rebuild: npm run qb:build
 * Verify:  npm run qb:verify   (read-only counts against the remote project)
 */
const fs = require("fs");
const path = require("path");
const { q, uuid, jbDollar } = require("../seed014/sqlutil");

const REPO = path.join(__dirname, "..", "..");
const DATA = path.join(REPO, "docs", "imports", "ch1-class10-science");
const OUT = path.join(REPO, "supabase", "migrations", "017_question_bank_ch1_import.sql");

/** Target taxonomy: the Class 10 Science chapter this bank belongs to. */
const BOARD = "cbse";
const CLASS = "class-10";
const SUBJECT = "science";
const CHAPTER = "chemical-reactions";

/** engine type -> legacy question_types.code (mirrors src/lib/engine/vocab.ts). */
const QTYPE_FOR = {
  mcq: "single_correct",
  assertion_reason: "assertion_reason",
  match: "match_following",
  statement: "true_false",
  case_based: "case_study",
  fill_blank: "fill_blank",
  equation: "equation_balancing",
  short: "descriptive",
  long: "descriptive",
};
const LEVEL_FOR = { 1: "easy", 2: "medium", 3: "hard" };
/** Types that carry a four-option list in options.csv. */
const OBJECTIVE = new Set(["mcq", "assertion_reason", "statement", "match", "case_based"]);
const LETTERS = "ABCDEFGH";

/* ---------------------------------------------------------------- CSV input */

/** RFC-4180 parser (mirrors parseCsvRows in src/lib/engine/question-schema.ts). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj = {};
      header.forEach((h, i) => {
        if (h) obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

function load(file) {
  return parseCsv(fs.readFileSync(path.join(DATA, file), "utf8"));
}

/** Splits a loose list cell (tags, exam_focus) on ; , or |. */
const splitList = (s) => String(s || "").split(/[;,|]/).map((x) => x.trim()).filter(Boolean);

/**
 * Splits an answer cell on "|" ONLY. Answer text must not be split on commas:
 * an equation's conditions ("(sunlight, chlorophyll)") contain commas, and
 * splitting there would corrupt balanced_equation / reactants / products.
 */
const splitVariants = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);

/** "CBSE/SEBA" -> "CBSE" (engine_board_pattern has no combined value). */
function boardPattern(raw) {
  const v = String(raw || "").toUpperCase();
  if (v.includes("SEBA")) return "SEBA";
  if (v.includes("CBSE")) return "CBSE";
  return "OTHER";
}


/* ------------------------------------------------------------ answer shaping */

const ARROW = /\s*(?:-->|->|⇌|=>|→)\s*/;

/** "To obey X (1). The total ... (1)." -> [{point,marks}] for the rubric. */
function rubricPoints(text, maxMarks) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const sentences = raw
    .split(/(?<=\))\.\s+|\.\s+(?=[A-Z])/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
  if (sentences.length < 2) return [{ point: raw, marks: maxMarks || 1 }];
  return sentences.map((s) => {
    const m = s.match(/\((\d+(?:\.\d+)?)\)\s*$/);
    return {
      point: s.replace(/\s*\(\d+(?:\.\d+)?\)\s*$/, "").trim(),
      marks: m ? Number(m[1]) : 0.5,
    };
  });
}

/**
 * answer_json in the shape src/lib/engine/question-schema.ts derives (see
 * docs/phase2-question-bank.md, "Derived answer keys"), plus the legacy
 * correct_options / value / key_points keys migration 014 writes so both the
 * admin editor and the older mock engine can read the same row.
 */
function buildAnswer(row, options) {
  const type = row.type;
  const fromOptions = LETTERS.split("").find((L) => options.some((o) => o.label === L && o.is_correct));
  const label = fromOptions || (row.correct_option || "").toUpperCase();

  if (OBJECTIVE.has(type)) {
    if (type === "match") {
      const pairs = splitList(row.answer_text.replace(/,/g, ";"))
        .map((p) => {
          const [left, right] = p.split("-").map((x) => x.trim());
          return { left, right };
        })
        .filter((p) => p.left && p.right);
      return {
        correct_option: label,
        correct_options: [label],
        value: label,
        match_pairs: pairs,
        match: Object.fromEntries(pairs.map((p) => [p.left, p.right])),
      };
    }
    return { correct_option: label, correct_options: [label], value: label };
  }

  if (type === "fill_blank") {
    const answers = splitVariants(row.answer_text);
    return { blanks: [{ blank_index: 0, answers, case_sensitive: false }], accepted: answers };
  }

  if (type === "equation") {
    const accepted = splitVariants(row.answer_text);
    const equation = accepted[0] || "";
    const [lhs, rhs] = equation.split(ARROW);
    const side = (s) => String(s || "").split(/\s*\+\s*/).map((x) => x.trim()).filter(Boolean);
    return {
      balanced_equation: equation,
      balanced_equations: accepted,
      accepted,
      reactants: side(lhs),
      products: side(rhs),
    };
  }

  const model = String(row.answer_text || "").trim();
  return { value: model, key_points: [model], accepted: model ? [model] : [] };
}

function buildRubric(row) {
  const type = row.type;
  const max = Number(row.marks) || 1;
  if (type === "mcq" || type === "assertion_reason" || type === "statement" || type === "case_based") {
    return { criteria: "Exactly one option is correct.", partial_credit: false, max_marks: max };
  }
  if (type === "match") {
    return {
      criteria: "Every column-I item matched to the correct column-II entry.",
      partial_credit: false,
      max_marks: max,
    };
  }
  if (type === "fill_blank") {
    return { criteria: "Any accepted variant scores the mark.", per_blank_marks: true, max_marks: max };
  }
  if (type === "equation") {
    return {
      criteria: "Correct formulae and balanced coefficients; state symbols accepted.",
      marks_split: "formulae_plus_balance",
      max_marks: max,
    };
  }
  const model = String(row.answer_text || "").trim();
  return { model_answer: model, criteria: rubricPoints(model, max), max_marks: max };
}


/* -------------------------------------------------------------- SQL emitters */

const CHAPTER_WHERE = `b.code='${BOARD}' AND c.code='${CLASS}' AND s.code='${SUBJECT}' AND ch.code='${CHAPTER}'`;

/**
 * Explicit cross joins for the lookup tables, then the real FK joins. Written
 * out longhand rather than as `FROM a, b JOIN c ...` because mixing a comma
 * list with a JOIN chain does not parse in Postgres.
 */
function lookupFrom(subtopicName) {
  return (
    "FROM question_types qt\n" +
    "  CROSS JOIN difficulty_levels dl\n" +
    "  CROSS JOIN topics tp\n" +
    "  JOIN chapters ch ON tp.chapter_id = ch.id\n" +
    "  JOIN subjects s ON ch.subject_id = s.id\n" +
    "  JOIN classes c ON s.class_id = c.id\n" +
    "  JOIN boards b ON c.board_id = b.id\n" +
    (subtopicName ? `  LEFT JOIN subtopics st ON st.topic_id = tp.id AND st.name = '${q(subtopicName)}'\n` : "")
  );
}

const textArray = (tags) => "ARRAY[" + tags.map((t) => "'" + q(t) + "'").join(",") + "]::text[]";

function emitTopics(taxonomy) {
  const topics = taxonomy.filter((r) => r.level === "topic");
  const subtopics = taxonomy.filter((r) => r.level === "subtopic");
  let s = `-- 2. Topics (${topics.length}) - upserted on (chapter_id, slug), so a topic that\n`;
  s += `--    already exists from another seed is reused instead of duplicated.\n`;
  topics.forEach((t, i) => {
    const meta = { qbank_code: t.code, qbank_source: "ch1-class10-science" };
    s += `INSERT INTO topics (chapter_id,code,name,slug,sort_order,metadata)\n`;
    s += `SELECT ch.id,'${q(t.code)}','${q(t.name)}','${q(t.slug)}',${i + 1},${jbDollar(meta)}::jsonb\n`;
    s += `FROM chapters ch\n  JOIN subjects s ON ch.subject_id=s.id\n  JOIN classes c ON s.class_id=c.id\n  JOIN boards b ON c.board_id=b.id\n`;
    s += `WHERE ${CHAPTER_WHERE}\n`;
    s += `ON CONFLICT (chapter_id, slug) DO UPDATE SET name=EXCLUDED.name, sort_order=EXCLUDED.sort_order, metadata=EXCLUDED.metadata;\n`;
  });

  s += `\n-- 3. Subtopics (${subtopics.length}) - upserted on (topic_id, slug).\n`;
  subtopics.forEach((st, i) => {
    const meta = { qbank_code: st.code, qbank_source: "ch1-class10-science" };
    s += `INSERT INTO subtopics (topic_id,code,name,slug,sort_order,metadata)\n`;
    s += `SELECT tp.id,'${q(st.code)}','${q(st.name)}','${q(st.slug)}',${i + 1},${jbDollar(meta)}::jsonb\n`;
    s += `FROM topics tp\n  JOIN chapters ch ON tp.chapter_id=ch.id\n  JOIN subjects s ON ch.subject_id=s.id\n  JOIN classes c ON s.class_id=c.id\n  JOIN boards b ON c.board_id=b.id\n`;
    s += `WHERE ${CHAPTER_WHERE} AND tp.slug='${q(st.parent_slug)}'\n`;
    s += `ON CONFLICT (topic_id, slug) DO UPDATE SET name=EXCLUDED.name, sort_order=EXCLUDED.sort_order, metadata=EXCLUDED.metadata;\n`;
  });
  return s;
}

function emitPassages(passages) {
  let s = `\n-- 4. Case passages (${passages.length}) - zero-mark parents. engine_question_type has\n`;
  s += `--    no 'case_passage' value, so a passage is a draft case_based row with marks = 0\n`;
  s += `--    (the convention migration 014 uses) that its case_based children point to.\n`;
  for (const p of passages) {
    const meta = {
      qbank_id: p.passage_id,
      qbank_kind: "case_passage",
      qbank_source: p.source,
      qbank_status: p.status,
      topic_slug: p.topic_slug,
      subtopic: p.subtopic,
    };
    s += `INSERT INTO questions (id,question_type_id,difficulty_level_id,topic_id,chapter_id,subject_id,question_text,explanation,marks,negative_marks,time_seconds,tags,metadata,is_active,is_verified,status,engine_type,stem,parent_id,subtopic_id,difficulty,skill,neg_marks,est_time_sec,board_pattern,pyq_year,lang,engine_status,source,legacy_id)\n`;
    s += `SELECT '${uuid("qbank-ch1-p-" + p.passage_id)}',qt.id,dl.id,tp.id,ch.id,s.id,'${q(p.passage_text)}',NULL,0,0,60,${textArray(["board", "case_passage"])},${jbDollar(meta)}::jsonb,true,false,'draft','case_based','${q(p.passage_text)}',NULL,st.id,1,'recall',0,60,'CBSE',NULL,'en','draft','ai','${q(p.passage_id)}'\n`;
    s += lookupFrom(p.subtopic);
    s += `WHERE qt.code='case_study' AND dl.code='easy' AND ${CHAPTER_WHERE} AND tp.slug='${q(p.topic_slug)}'\n`;
    s += `ON CONFLICT (id) DO UPDATE SET question_text=EXCLUDED.question_text, stem=EXCLUDED.stem, metadata=EXCLUDED.metadata, subtopic_id=EXCLUDED.subtopic_id, topic_id=EXCLUDED.topic_id, is_verified=false, status='draft', engine_status='draft';\n`;
  }
  return s;
}


function emitQuestions(questions) {
  let s = `\n-- 5. Questions (${questions.length}) - every row lands as draft; nothing is published.\n`;
  for (const r of questions) {
    const tags = Array.from(new Set([...splitList(r.tags), ...splitList(r.exam_focus)]));
    const meta = {
      qbank_id: r.question_id,
      qbank_source: r.source,
      qbank_status: r.status,
      chapter_slug: r.chapter_slug,
      topic_slug: r.topic_slug,
      subtopic: r.subtopic,
      board_pattern_raw: r.board_pattern,
      common_mistake: r.common_mistake || null,
      exam_focus: r.exam_focus || null,
    };
    const parent = r.parent_id ? `'${uuid("qbank-ch1-p-" + r.parent_id)}'` : "NULL";
    const pyq = /^\d{4}$/.test(r.pyq_year || "") ? r.pyq_year : "NULL";
    const marks = Number(r.marks) || 0;
    const neg = Number(r.neg_marks) || 0;
    const time = Number(r.est_time_sec) || 60;
    s += `INSERT INTO questions (id,question_type_id,difficulty_level_id,topic_id,chapter_id,subject_id,question_text,explanation,marks,negative_marks,time_seconds,tags,metadata,is_active,is_verified,status,engine_type,stem,parent_id,subtopic_id,difficulty,skill,neg_marks,est_time_sec,board_pattern,pyq_year,lang,engine_status,source,legacy_id)\n`;
    s += `SELECT '${uuid("qbank-ch1-q-" + r.question_id)}',qt.id,dl.id,tp.id,ch.id,s.id,'${q(r.stem)}','${q(r.explanation)}',${marks},${neg},${time},${textArray(tags)},${jbDollar(meta)}::jsonb,true,false,'draft','${q(r.type)}','${q(r.stem)}',${parent},st.id,${Number(r.difficulty)},'${q(r.skill)}',${neg},${time},'${q(boardPattern(r.board_pattern))}',${pyq},'${q(r.lang) || "en"}','draft','ai','${q(r.question_id)}'\n`;
    s += lookupFrom(r.subtopic);
    s += `WHERE qt.code='${QTYPE_FOR[r.type]}' AND dl.code='${LEVEL_FOR[Number(r.difficulty)]}' AND ${CHAPTER_WHERE} AND tp.slug='${q(r.topic_slug)}'\n`;
    s += `ON CONFLICT (id) DO UPDATE SET question_type_id=EXCLUDED.question_type_id, difficulty_level_id=EXCLUDED.difficulty_level_id, topic_id=EXCLUDED.topic_id, chapter_id=EXCLUDED.chapter_id, subject_id=EXCLUDED.subject_id, question_text=EXCLUDED.question_text, stem=EXCLUDED.stem, explanation=EXCLUDED.explanation, parent_id=EXCLUDED.parent_id, subtopic_id=EXCLUDED.subtopic_id, marks=EXCLUDED.marks, negative_marks=EXCLUDED.negative_marks, time_seconds=EXCLUDED.time_seconds, neg_marks=EXCLUDED.neg_marks, est_time_sec=EXCLUDED.est_time_sec, tags=EXCLUDED.tags, metadata=EXCLUDED.metadata, difficulty=EXCLUDED.difficulty, skill=EXCLUDED.skill, board_pattern=EXCLUDED.board_pattern, pyq_year=EXCLUDED.pyq_year, lang=EXCLUDED.lang, is_active=true, is_verified=false, status='draft', engine_status='draft';\n`;
  }
  return s;
}

function emitOptions(options) {
  const byQuestion = new Map();
  for (const o of options) {
    if (!byQuestion.has(o.question_id)) byQuestion.set(o.question_id, []);
    byQuestion.get(o.question_id).push(o);
  }
  let s = `\n-- 6. Options (${options.length}) - objective rows only. The option set of an\n`;
  s += `--    import-owned question is replaced wholesale so a re-run cannot duplicate rows.\n`;
  for (const [qid, list] of byQuestion) {
    s += `DELETE FROM question_options WHERE question_id='${uuid("qbank-ch1-q-" + qid)}';\n`;
    for (const o of list) {
      const pos = (Number(o.position) || 1) - 1;
      s += `INSERT INTO question_options (id,question_id,option_text,option_html,is_correct,sort_order,label,body,position)\n`;
      s += `VALUES ('${uuid("qbank-ch1-o-" + qid + o.label)}','${uuid("qbank-ch1-q-" + qid)}','${q(o.text)}',NULL,${/^true$/i.test(o.is_correct) ? "true" : "false"},${pos},'${q(o.label)}','${q(o.text)}',${pos});\n`;
    }
  }
  return s;
}


function emitAnswers(questions, options) {
  const byQuestion = new Map();
  for (const o of options) {
    if (!byQuestion.has(o.question_id)) byQuestion.set(o.question_id, []);
    byQuestion.get(o.question_id).push({ label: o.label, is_correct: /^true$/i.test(o.is_correct) });
  }
  let s = `\n-- 7. Answers + rubrics (${questions.length}) - one row per question.\n`;
  for (const r of questions) {
    const opts = (byQuestion.get(r.question_id) || []).sort(
      (a, b) => LETTERS.indexOf(a.label) - LETTERS.indexOf(b.label)
    );
    s += `INSERT INTO question_answers (id,question_id,answer_json,rubric_json,explanation)\n`;
    s += `VALUES ('${uuid("qbank-ch1-a-" + r.question_id)}','${uuid("qbank-ch1-q-" + r.question_id)}',${jbDollar(buildAnswer(r, opts))}::jsonb,${jbDollar(buildRubric(r))}::jsonb,'${q(r.explanation)}')\n`;
    s += `ON CONFLICT (question_id) DO UPDATE SET answer_json=EXCLUDED.answer_json, rubric_json=EXCLUDED.rubric_json, explanation=EXCLUDED.explanation;\n`;
  }
  return s;
}

function emitTagsAndStats(questions) {
  let tags = `\n-- 8. Tag rows (search facets used by the review queue and the generator).\n`;
  let stats = `\n-- 9. Stats rows (all zero until students attempt the questions).\n`;
  for (const r of questions) {
    const id = uuid("qbank-ch1-q-" + r.question_id);
    for (const t of Array.from(new Set([...splitList(r.tags), ...splitList(r.exam_focus)]))) {
      tags += `INSERT INTO question_tags (id,question_id,tag) VALUES ('${uuid("qbank-ch1-t-" + r.question_id + t)}','${id}','${q(t)}') ON CONFLICT (question_id, tag) DO UPDATE SET tag=EXCLUDED.tag;\n`;
    }
    stats += `INSERT INTO question_stats (question_id,attempts,correct_count,correct_rate,avg_time) VALUES ('${id}',0,0,0,${Number(r.est_time_sec) || 60}) ON CONFLICT (question_id) DO NOTHING;\n`;
  }
  return tags + stats;
}

function emitHeader(taxonomy, passages, questions, options) {
  const topics = taxonomy.filter((r) => r.level === "topic").length;
  const subtopics = taxonomy.filter((r) => r.level === "subtopic").length;
  let s = `-- ============================================================================\n`;
  s += `-- Migration 017: Class 10 Science Ch1 question bank (${questions.length} questions)\n`;
  s += `-- Generated by scripts/qbank_ch1/build_017.js - do not edit by hand.\n`;
  s += `-- Source: docs/imports/ch1-class10-science/*.csv\n`;
  s += `--\n`;
  s += `-- Idempotent: deterministic sha1-derived UUIDs, every write is an upsert, and\n`;
  s += `-- every row carries its CSV id in the new questions.legacy_id column, so a\n`;
  s += `-- re-run updates rows instead of duplicating them.\n`;
  s += `--\n`;
  s += `-- Safety: every question lands as engine_status='draft' / status='draft' /\n`;
  s += `-- is_verified=false. This migration never publishes anything - review and\n`;
  s += `-- publishing are manual steps in /admin/questions.\n`;
  s += `--\n`;
  s += `-- Depends on: 013 (engine columns, subtopics, question_answers, question_tags,\n`;
  s += `-- question_stats) and 012 (questions.status).\n`;
  s += `-- Contents: ${topics} topics, ${subtopics} subtopics, ${passages.length} case passages,\n`;
  s += `-- ${questions.length} questions, ${options.length} options.\n`;
  s += `-- ============================================================================\n\n`;

  s += `DO $$ BEGIN\n`;
  s += `  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='engine_question_type') THEN\n`;
  s += `    RAISE EXCEPTION 'migration 013 must be applied before 017';\n`;
  s += `  END IF;\n`;
  s += `  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='status') THEN\n`;
  s += `    RAISE EXCEPTION 'migration 012 must be applied before 017';\n`;
  s += `  END IF;\n`;
  s += `  IF NOT EXISTS (\n`;
  s += `    SELECT 1 FROM chapters ch JOIN subjects s ON ch.subject_id=s.id\n`;
  s += `      JOIN classes c ON s.class_id=c.id JOIN boards b ON c.board_id=b.id\n`;
  s += `    WHERE b.code='${BOARD}' AND c.code='${CLASS}' AND s.code='${SUBJECT}' AND ch.code='${CHAPTER}'\n`;
  s += `  ) THEN\n`;
  s += `    RAISE EXCEPTION 'target chapter ${BOARD}/${CLASS}/${SUBJECT}/${CHAPTER} not found (migration 003)';\n`;
  s += `  END IF;\n`;
  s += `END $$;\n\n`;

  s += `-- Stable external key for idempotent re-imports and for the review queue.\n`;
  s += `ALTER TABLE questions ADD COLUMN IF NOT EXISTS legacy_id TEXT;\n`;
  s += `CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_legacy_id\n`;
  s += `  ON questions(legacy_id) WHERE legacy_id IS NOT NULL;\n\n`;

  s += `-- Legacy lookup rows the engine maps to (003/014 may not have created them).\n`;
  s += `INSERT INTO question_types (code,name,description,sort_order) VALUES\n`;
  s += `  ('descriptive','Descriptive','Short/long written answer',12),\n`;
  s += `  ('equation_balancing','Equation Balancing','Write and balance equations',13)\n`;
  s += `ON CONFLICT (code) DO NOTHING;\n`;
  s += `INSERT INTO difficulty_levels (code,name,weight,color,sort_order) VALUES\n`;
  s += `  ('easy','Easy',1.0,'#22c55e',1),('medium','Medium',2.0,'#f59e0b',2),('hard','Hard',3.0,'#ef4444',3)\n`;
  s += `ON CONFLICT (code) DO NOTHING;\n\n`;
  return s;
}


function emitVerify() {
  return `\n-- 10. Post-import report (surfaced as a NOTICE by supabase db push)\n` +
    `DO $$\n` +
    `DECLARE v_q INT; v_pass INT; v_opt INT; v_ans INT; v_draft INT; v_pub INT;\n` +
    `BEGIN\n` +
    `  SELECT COUNT(*) INTO v_q    FROM questions WHERE legacy_id LIKE 'CR-%';\n` +
    `  SELECT COUNT(*) INTO v_pass FROM questions WHERE legacy_id LIKE 'CP-%';\n` +
    `  SELECT COUNT(*) INTO v_opt  FROM question_options o JOIN questions q ON q.id=o.question_id WHERE q.legacy_id LIKE 'CR-%';\n` +
    `  SELECT COUNT(*) INTO v_ans  FROM question_answers a JOIN questions q ON q.id=a.question_id WHERE q.legacy_id LIKE 'CR-%';\n` +
    `  SELECT COUNT(*) INTO v_draft FROM questions WHERE legacy_id LIKE 'CR-%' AND engine_status='draft';\n` +
    `  SELECT COUNT(*) INTO v_pub  FROM questions WHERE legacy_id LIKE 'CR-%' AND engine_status='published';\n` +
    `  RAISE NOTICE 'QBANK017: questions=% passages=% options=% answers=% draft=% published=%', v_q, v_pass, v_opt, v_ans, v_draft, v_pub;\n` +
    `END $$;\n`;
}

/* -------------------------------------------------------------------- main */

function main() {
  const taxonomy = load("taxonomy.csv");
  const passages = load("case_passages.csv");
  const questions = load("questions.csv");
  const options = load("options.csv");

  const known = new Set(questions.map((r) => r.question_id));
  const passageIds = new Set(passages.map((p) => p.passage_id));
  const taxonomyTopics = new Set(taxonomy.filter((r) => r.level === "topic").map((r) => r.slug));
  const subtopicNames = new Set(taxonomy.filter((r) => r.level === "subtopic").map((r) => r.name));
  const problems = [];
  for (const r of questions) {
    if (!QTYPE_FOR[r.type]) problems.push(`${r.question_id}: unknown type '${r.type}'`);
    if (!LEVEL_FOR[Number(r.difficulty)]) problems.push(`${r.question_id}: difficulty ${r.difficulty} out of 1..3`);
    if (!taxonomyTopics.has(r.topic_slug)) problems.push(`${r.question_id}: unknown topic_slug '${r.topic_slug}'`);
    // The SQL resolves subtopic_id by name; an unmatched name silently yields NULL.
    if (r.subtopic && !subtopicNames.has(r.subtopic)) {
      problems.push(`${r.question_id}: subtopic '${r.subtopic}' is not in taxonomy.csv`);
    }
    if (r.parent_id && !passageIds.has(r.parent_id)) problems.push(`${r.question_id}: unknown parent ${r.parent_id}`);
    if (OBJECTIVE.has(r.type) && !/^[A-F]$/i.test(r.correct_option || "")) {
      problems.push(`${r.question_id}: missing correct_option`);
    }
  }
  for (const p of passages) {
    if (!taxonomyTopics.has(p.topic_slug)) problems.push(`${p.passage_id}: unknown topic_slug '${p.topic_slug}'`);
    if (p.subtopic && !subtopicNames.has(p.subtopic)) {
      problems.push(`${p.passage_id}: subtopic '${p.subtopic}' is not in taxonomy.csv`);
    }
  }
  for (const o of options) {
    if (!known.has(o.question_id)) problems.push(`option ${o.question_id}/${o.label}: no such question`);
  }
  if (problems.length) {
    console.error("Refusing to build - fix these first:");
    problems.slice(0, 20).forEach((p) => console.error("  " + p));
    process.exit(1);
  }

  const sql =
    emitHeader(taxonomy, passages, questions, options) +
    emitTopics(taxonomy) +
    emitPassages(passages) +
    emitQuestions(questions) +
    emitOptions(options) +
    emitAnswers(questions, options) +
    emitTagsAndStats(questions) +
    emitVerify();

  fs.writeFileSync(OUT, sql, "utf8");
  const topics = taxonomy.filter((r) => r.level === "topic").length;
  const subtopics = taxonomy.filter((r) => r.level === "subtopic").length;
  console.log(`wrote ${path.relative(REPO, OUT)}`);
  console.log(
    `  topics=${topics} subtopics=${subtopics} passages=${passages.length} questions=${questions.length} options=${options.length} (${sql.length} bytes)`
  );
}

main();





