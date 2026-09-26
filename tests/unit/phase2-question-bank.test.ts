import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildAnswerJson,
  createEngineQuestionSchema,
  bulkEngineQuestionRowSchema,
  engineOptionSchema,
  engineQuestionQuerySchema,
  parseCsvRows,
  updateEngineQuestionSchema,
  validateOptionsForType,
  withEngineDefaults,
} from "@/lib/engine/question-schema";
import type { NormalizedEngineOption } from "@/lib/engine/question-schema";
import {
  ENGINE_STATUSES,
  ENGINE_STATUS_TO_LEGACY,
  ENGINE_TYPES,
  isAllowedEngineTransition,
  LEGACY_QTYPE_FOR_ENGINE,
} from "@/lib/engine/vocab";

function opts(pairs: Array<[string, boolean]>): NormalizedEngineOption[] {
  return pairs.map(([body, is_correct], i) => ({
    label: String.fromCharCode(65 + i),
    body,
    is_correct,
    position: i + 1,
  }));
}

const TOPIC = "11111111-1111-4111-8111-111111111111";

describe("engine question schema", () => {
  it("applies every default on a minimal valid mcq", () => {
    const parsed = createEngineQuestionSchema.parse({
      type: "mcq",
      stem: "Which gas turns limewater milky?",
      topicId: TOPIC,
      difficulty: 1,
      skill: "recall",
      options: [
        { body: "Oxygen", is_correct: false },
        { body: "Carbon dioxide", is_correct: true },
      ],
    });
    const filled = withEngineDefaults(parsed);
    expect(filled.marks).toBe(1);
    expect(filled.negMarks).toBe(0);
    expect(filled.estTimeSec).toBe(60);
    expect(filled.status).toBe("draft");
    expect(filled.source).toBe("manual");
    expect(filled.boardPattern).toBe("CBSE");
    expect(filled.lang).toBe("en");
    expect(filled.chapterId).toBe("");
    expect(filled.subjectId).toBe("");
    expect(filled.tags).toEqual([]);
    expect(filled.matchPairs).toEqual([]);
    expect(filled.blanks).toEqual([]);
  });

  it("never lets a default overwrite a value the caller supplied", () => {
    // Regression: the defaults used to be spread *after* the input, which threw
    // away marks, timing, status, source, tags, options and the answer key -
    // so a CSV import or an editor save silently wrote the defaults instead.
    const filled = withEngineDefaults({
      type: "mcq",
      stem: "x",
      topicId: TOPIC,
      difficulty: 2,
      skill: "application",
      marks: 5,
      negMarks: 1.5,
      estTimeSec: 120,
      status: "reviewed",
      source: "import",
      boardPattern: "SEBA",
      lang: "hi",
      tags: ["board"],
      explanation: "because",
      options: [{ body: "A", is_correct: true }],
      answer: { correct_option: "A" },
    });
    expect(filled.marks).toBe(5);
    expect(filled.negMarks).toBe(1.5);
    expect(filled.estTimeSec).toBe(120);
    expect(filled.status).toBe("reviewed");
    expect(filled.source).toBe("import");
    expect(filled.boardPattern).toBe("SEBA");
    expect(filled.lang).toBe("hi");
    expect(filled.tags).toEqual(["board"]);
    expect(filled.explanation).toBe("because");
    expect(filled.options).toHaveLength(1);
    expect(filled.answer).toEqual({ correct_option: "A" });
  });

  it("rejects an out-of-range difficulty", () => {
    const res = createEngineQuestionSchema.safeParse({
      type: "mcq",
      stem: "x",
      topicId: TOPIC,
      difficulty: 4,
      skill: "recall",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a non-uuid topicId", () => {
    const res = createEngineQuestionSchema.safeParse({
      type: "mcq",
      stem: "x",
      topicId: "not-a-uuid",
      difficulty: 1,
      skill: "recall",
    });
    expect(res.success).toBe(false);
  });

  it("coerces query paging and applies query defaults", () => {
    const q = engineQuestionQuerySchema.parse({ page: "2", limit: "5" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(5);
    expect(q.status).toBe("");
    expect(q.difficulty).toBe(0);
  });

  it("keeps every engine type valid in the update schema", () => {
    for (const t of ENGINE_TYPES) {
      expect(updateEngineQuestionSchema.safeParse({ type: t }).success, `update rejected ${t}`).toBe(true);
    }
  });

  it("defaults an option body to an empty string", () => {
    expect(engineOptionSchema.parse({}).body).toBe("");
    expect(engineOptionSchema.parse({}).isCorrect).toBe(false);
  });
});

describe("validateOptionsForType", () => {
  it("requires exactly one correct option for mcq", () => {
    expect(validateOptionsForType("mcq", opts([["a", false], ["b", true]]))).toBeNull();
    expect(validateOptionsForType("mcq", opts([["a", false], ["b", false]]))).toMatch(/exactly one/i);
    expect(validateOptionsForType("mcq", opts([["a", true], ["b", true]]))).toMatch(/exactly one/i);
  });

  it("requires at least two options", () => {
    expect(validateOptionsForType("mcq", opts([["only", true]]))).toMatch(/at least two/i);
  });

  it("rejects blank option text", () => {
    expect(validateOptionsForType("mcq", opts([["", true], ["b", false]]))).toMatch(/needs text/i);
  });

  it("allows multiple correct options for match and fill_blank", () => {
    expect(validateOptionsForType("match", opts([["x", false], ["y", true], ["z", true]]))).toBeNull();
    expect(validateOptionsForType("fill_blank", opts([["oxidation", true]]))).toBeNull();
  });

  it("does not require options for subjective types", () => {
    expect(validateOptionsForType("short", [])).toBeNull();
    expect(validateOptionsForType("long", [])).toBeNull();
    expect(validateOptionsForType("case_based", [])).toBeNull();
  });
});

describe("buildAnswerJson", () => {
  it("derives a single correct_option for mcq", () => {
    expect(buildAnswerJson({ type: "mcq" }, opts([["a", false], ["b", true]]))).toEqual({
      correct_option: "B",
    });
  });

  it("derives correct_options when several are right", () => {
    expect(buildAnswerJson({ type: "statement" }, opts([["a", true], ["b", false], ["c", true]]))).toEqual({
      correct_options: ["A", "C"],
    });
  });

  it("keeps the assertion and reason text", () => {
    const out = buildAnswerJson(
      { type: "assertion_reason", assertion: { assertion: "A is true", reason: "because B" } },
      opts([["both true", true]])
    );
    expect(out.correct_option).toBe("A");
    expect(out.assertion).toBe("A is true");
    expect(out.reason).toBe("because B");
  });

  it("splits a balanced equation into reactants and products", () => {
    const out = buildAnswerJson(
      { type: "equation", answer: { balanced_equation: "2H2 + O2 -> 2H2O" } },
      opts([["2H2 + O2 -> 2H2O", true]])
    );
    expect(out.balanced_equation).toBe("2H2 + O2 -> 2H2O");
    expect(out.reactants).toEqual(["2H2", "O2"]);
    expect(out.products).toEqual(["2H2O"]);
  });

  it("handles unicode arrows", () => {
    const out = buildAnswerJson({ type: "equation", answer: { balanced_equation: "N2 + 3H2 \u2192 2NH3" } }, []);
    expect(out.reactants).toEqual(["N2", "3H2"]);
    expect(out.products).toEqual(["2NH3"]);
  });

  it("flattens fill_blank answers into an accepted list", () => {
    const out = buildAnswerJson(
      {
        type: "fill_blank",
        blanks: [
          { blank_index: 0, answers: ["oxidation", "oxidation of copper"] },
          { blank_index: 1, answers: ["Rancidity"] },
        ],
      },
      []
    );
    expect(out.accepted).toEqual(["oxidation", "oxidation of copper", "Rancidity"]);
  });

  it("prefers the rubric model answer for subjective types", () => {
    expect(buildAnswerJson({ type: "short", rubric: { model_answer: "Rancidity" } }, [])).toEqual({
      value: "Rancidity",
    });
  });

  it("lets an explicit answer override the derived value", () => {
    expect(buildAnswerJson({ type: "mcq", answer: { correct_option: "D" } }, opts([["a", true]]))).toEqual({
      correct_option: "D",
    });
  });

  it("returns an empty object when nothing can be derived", () => {
    expect(buildAnswerJson({ type: "long" }, [])).toEqual({});
  });
});

describe("engine review state machine", () => {
  it("allows draft -> reviewed -> published", () => {
    expect(isAllowedEngineTransition("draft", "reviewed")).toBe(true);
    expect(isAllowedEngineTransition("reviewed", "published")).toBe(true);
  });

  it("blocks retired -> published", () => {
    expect(isAllowedEngineTransition("published", "draft")).toBe(true);
    expect(isAllowedEngineTransition("retired", "published")).toBe(false);
  });

  it("treats a same-state transition as a no-op success", () => {
    expect(isAllowedEngineTransition("draft", "draft")).toBe(true);
  });

  it("keeps the legacy status in lock-step for every engine status", () => {
    for (const s of ENGINE_STATUSES) {
      expect(typeof ENGINE_STATUS_TO_LEGACY[s], `missing legacy mapping for ${s}`).toBe("string");
    }
  });

  it("maps every engine type to a legacy question type code", () => {
    for (const t of ENGINE_TYPES) {
      expect(LEGACY_QTYPE_FOR_ENGINE[t], `missing legacy code for ${t}`).toBeTruthy();
    }
  });
});

describe("parseCsvRows", () => {
  it("parses a header row and trims cells", () => {
    const rows = parseCsvRows("a,b\n 1 , 2 \n");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("handles quoted cells containing commas", () => {
    const rows = parseCsvRows('type,stem\nmcq,"Balance, then explain"');
    expect(rows[0].stem).toBe("Balance, then explain");
  });

  it("handles doubled quotes and embedded newlines", () => {
    const rows = parseCsvRows('a\n"he said ""hi""\nagain"');
    expect(rows[0].a).toBe('he said "hi"\nagain');
  });

  it("strips a UTF-8 BOM from the header", () => {
    const rows = parseCsvRows("\uFEFFtype,stem\nmcq,x");
    expect(rows[0].type).toBe("mcq");
  });

  it("skips fully blank rows", () => {
    expect(parseCsvRows("a,b\n,,\n1,2")).toHaveLength(1);
  });
});

describe("bulkEngineQuestionRowSchema", () => {
  const valid = {
    type: "mcq",
    stem: "Which gas turns limewater milky?",
    topic_slug: "corrosion-and-rancidity",
    difficulty: "1",
    skill: "recall",
  };

  it("applies import-safe defaults", () => {
    const row = bulkEngineQuestionRowSchema.parse(valid);
    expect(row.marks).toBe(1);
    expect(row.neg_marks).toBe(0);
    expect(row.est_time_sec).toBe(60);
    expect(row.board_pattern).toBe("CBSE");
    expect(row.status).toBe("draft");
    expect(row.source).toBe("import");
  });

  it("never defaults an import to published", () => {
    expect(bulkEngineQuestionRowSchema.parse({ ...valid, status: "" }).status).toBe("draft");
  });

  it("rejects a bad difficulty and an empty topic slug", () => {
    expect(bulkEngineQuestionRowSchema.safeParse({ ...valid, difficulty: "9" }).success).toBe(false);
    expect(bulkEngineQuestionRowSchema.safeParse({ ...valid, topic_slug: "" }).success).toBe(false);
  });
});

describe("phase-2 migration contract (016)", () => {
  const MIG = readFileSync(join(process.cwd(), "supabase/migrations/016_question_review_history.sql"), "utf8");

  it("creates an auditable review history table behind RLS", () => {
    expect(MIG).toContain("CREATE TABLE IF NOT EXISTS question_review_history");
    expect(MIG).toContain("ALTER TABLE question_review_history ENABLE ROW LEVEL SECURITY");
    expect(MIG).toContain("is_reviewer_or_admin()");
  });

  it("exposes a review-counts view for the queue badges", () => {
    expect(MIG).toContain("CREATE OR REPLACE VIEW question_review_counts");
  });

  it("keeps questions.updated_at fresh on admin edits", () => {
    expect(MIG).toContain("tr_questions_admin_touch");
  });
});
