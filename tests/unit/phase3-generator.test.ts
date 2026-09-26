import { describe, expect, it } from "vitest";

import {
  BLUEPRINT_KINDS,
  createBlueprintSchema,
  sectionFilterSchema,
  withSectionDefaults,
} from "@/lib/engine/blueprint-schema";
import type { BlueprintSectionInput } from "@/lib/engine/blueprint-schema";
import { checkAvailability } from "@/lib/engine/blueprint-service";
import {
  createRng,
  dailySeed,
  expandDifficultyMix,
  fillSection,
  generateStatic,
  hashSeed,
  matchesFilter,
  matchesTags,
  nextAdaptiveQuestion,
  RELAXATION_ORDER,
  seededShuffle,
  weakAreaWeights,
  weightedSample,
} from "@/lib/engine/generator";
import type { Candidate, PoolQuestion } from "@/lib/engine/generator";

/* ------------------------------------------------------------- fixtures */

const TOPIC_A = "aaaaaaaa-1111-4111-8111-111111111111";
const TOPIC_B = "bbbbbbbb-2222-4222-8222-222222222222";

function q(over: Partial<PoolQuestion> & { id: string }): PoolQuestion {
  return {
    engine_type: "mcq",
    topic_id: TOPIC_A,
    subtopic_id: null,
    parent_id: null,
    difficulty: 2,
    skill: "recall",
    board_pattern: "CBSE",
    pyq_year: null,
    lang: "en",
    est_time_sec: 60,
    ...over,
  };
}

function c(question: PoolQuestion, tags: string[] = []): Candidate {
  return { question, tags };
}

function section(over: Partial<BlueprintSectionInput> = {}) {
  return withSectionDefaults({
    title: "Section A",
    count: 3,
    filter: sectionFilterSchema.parse({}),
    ...over,
  });
}

/**
 * A pool of `n` distinct questions in topic A.
 *
 * The ids come from a shared counter, not the loop index: two `poolOf(4, ...)`
 * calls with different overrides must not produce the same four ids, or
 * "never picks the same question twice" and the difficulty-mix quotas would be
 * measured against a pool that is really only half the size it looks.
 */
let poolSeq = 0;
function poolOf(n: number, over: Partial<PoolQuestion> = {}): Candidate[] {
  return Array.from({ length: n }, () => {
    poolSeq += 1;
    return c(q({ id: `00000000-0000-4000-8000-${String(poolSeq).padStart(12, "0")}`, ...over }));
  });
}

const IDS = (pool: Candidate[]) => pool.map((x) => x.question.id);

/* ------------------------------------------------------------------ rng */

describe("seeded rng", () => {
  it("is deterministic for the same seed", () => {
    const a = Array.from({ length: 5 }, createRng(42));
    const b = Array.from({ length: 5 }, createRng(42));
    expect(a).toEqual(b);
  });

  it("differs across seeds", () => {
    const a = Array.from({ length: 5 }, createRng(1));
    const b = Array.from({ length: 5 }, createRng(2));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("hashSeed is stable and date-scoped", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
    expect(dailySeed("2026-09-25", "x")).toBe(dailySeed("2026-09-25", "x"));
    expect(dailySeed("2026-09-25", "x")).not.toBe(dailySeed("2026-09-26", "x"));
    expect(dailySeed("2026-09-25", "x")).not.toBe(dailySeed("2026-09-25", "y"));
  });

  it("seededShuffle preserves every element and is seed-stable", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = seededShuffle(input, createRng(9));
    const s2 = seededShuffle(input, createRng(9));
    expect(s1).toEqual(s2);
    expect(s1.slice().sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

/* ------------------------------------------------------------- matching */

describe("matchesFilter", () => {
  const base = sectionFilterSchema.parse({ topic_ids: [TOPIC_A] });

  it("matches a question inside the topic scope", () => {
    expect(matchesFilter(q({ id: "x" }), base)).toBe(true);
  });

  it("rejects a question outside the topic scope", () => {
    expect(matchesFilter(q({ id: "x", topic_id: TOPIC_B }), base)).toBe(false);
  });

  it("honours the topic scope when relaxed", () => {
    expect(matchesFilter(q({ id: "x", topic_id: TOPIC_B }), base, new Set(["topic"]))).toBe(true);
  });

  it("excludes case-based parents and includes children by default", () => {
    const f = sectionFilterSchema.parse({});
    // The passage row: case_based with no parent_id. Scores zero marks, so it
    // must never be served as a standalone question.
    expect(matchesFilter(q({ id: "p", engine_type: "case_based", parent_id: null }), f)).toBe(false);
    // Its children are what actually get served.
    expect(matchesFilter(q({ id: "c", parent_id: "parent-uuid" }), f)).toBe(true);
    // An ordinary standalone question is not a parent and stays eligible.
    expect(matchesFilter(q({ id: "s" }), f)).toBe(true);
  });

  it("can be relaxed to serve the parent passage", () => {
    const f = sectionFilterSchema.parse({});
    expect(matchesFilter(q({ id: "p", engine_type: "case_based", parent_id: null }), f, new Set(["topic"]))).toBe(true);
  });

  it("excludes children only when asked to", () => {
    const f = sectionFilterSchema.parse({ exclude_children: true });
    expect(matchesFilter(q({ id: "c", parent_id: "parent-uuid" }), f)).toBe(false);
    expect(matchesFilter(q({ id: "c", parent_id: "parent-uuid" }), f, new Set(["topic"]))).toBe(true);
  });

  it("respects an explicit difficulty band", () => {
    const f = sectionFilterSchema.parse({ difficulty_min: 3, difficulty_max: 3 });
    expect(matchesFilter(q({ id: "x", difficulty: 3 }), f)).toBe(true);
    expect(matchesFilter(q({ id: "x", difficulty: 1 }), f)).toBe(false);
  });

  it("enforces pyq_only only when a year is present", () => {
    const f = sectionFilterSchema.parse({ pyq_only: true });
    expect(matchesFilter(q({ id: "x", pyq_year: 2023 }), f)).toBe(true);
    expect(matchesFilter(q({ id: "x", pyq_year: null }), f)).toBe(false);
    expect(matchesFilter(q({ id: "x", pyq_year: null }), f, new Set(["pyq"]))).toBe(true);
  });

  it("rejects a wrong language", () => {
    const f = sectionFilterSchema.parse({ lang: "en" });
    expect(matchesFilter(q({ id: "x", lang: "hi" }), f)).toBe(false);
  });

  it("filters by tags and relaxes them on demand", () => {
    const f = sectionFilterSchema.parse({ tags: ["pyq"] });
    expect(matchesTags(["pyq"], f)).toBe(true);
    expect(matchesTags(["other"], f)).toBe(false);
    expect(matchesTags(["other"], f, new Set(["tags"]))).toBe(true);
  });
});

/* ------------------------------------------------------ difficulty mix */

describe("expandDifficultyMix", () => {
  it("returns a single no-preference band for an empty mix", () => {
    expect(expandDifficultyMix({}, 5)).toEqual([[0, 5]]);
  });

  it("returns nothing for a zero count", () => {
    expect(expandDifficultyMix({}, 0)).toEqual([]);
    expect(expandDifficultyMix({ "1": 1 }, 0)).toEqual([]);
  });

  it("scales weights onto the requested count", () => {
    expect(expandDifficultyMix({ "1": 1, "3": 1 }, 10)).toEqual([
      [1, 5],
      [3, 5],
    ]);
  });

  it("always totals exactly the requested count", () => {
    for (const count of [1, 3, 7, 10, 30]) {
      const quotas = expandDifficultyMix({ "1": 3, "2": 5, "3": 1 }, count);
      expect(quotas.reduce((s, [, v]) => s + v, 0)).toBe(count);
    }
  });

  it("ignores zero-weight bands", () => {
    expect(expandDifficultyMix({ "1": 0, "2": 1 }, 4)).toEqual([[2, 4]]);
  });
});

/* ------------------------------------------------------ section filling */

describe("fillSection", () => {
  it("fills exactly the requested count", () => {
    const r = fillSection(poolOf(10), section({ count: 4 }), createRng(1));
    expect(r.picked).toHaveLength(4);
    expect(r.warnings).toHaveLength(0);
  });

  it("never picks the same question twice", () => {
    const r = fillSection(poolOf(20), section({ count: 10 }), createRng(3));
    expect(new Set(IDS(r.picked)).size).toBe(10);
  });

  it("is deterministic for a given seed", () => {
    const pool = poolOf(20);
    const a = fillSection(pool, section({ count: 5 }), createRng(11));
    const b = fillSection(pool, section({ count: 5 }), createRng(11));
    expect(IDS(a.picked)).toEqual(IDS(b.picked));
  });

  it("produces a different paper for a different seed", () => {
    const pool = poolOf(30);
    const a = fillSection(pool, section({ count: 5 }), createRng(1));
    const b = fillSection(pool, section({ count: 5 }), createRng(2));
    expect(IDS(a.picked)).not.toEqual(IDS(b.picked));
  });

  it("warns and returns short when the bank cannot fill the section", () => {
    const r = fillSection(poolOf(2), section({ count: 5 }), createRng(1));
    expect(r.picked).toHaveLength(2);
    expect(r.warnings.some((w) => w.code === "SHORTFALL")).toBe(true);
    expect(r.warnings[0].requested).toBe(5);
    expect(r.warnings[0].filled).toBe(2);
  });

  it("excludes recently seen questions", () => {
    const pool = poolOf(10);
    const seen = pool.slice(0, 6).map((x) => x.question.id);
    const r = fillSection(pool, section({ count: 6 }), createRng(1), { recentlySeen: seen });
    expect(r.picked.every((x) => !seen.includes(x.question.id))).toBe(true);
  });

  it("relaxes recency rather than returning short when everything is seen", () => {
    const pool = poolOf(4);
    const seen = IDS(pool);
    const r = fillSection(pool, section({ count: 4 }), createRng(1), { recentlySeen: seen });
    expect(r.picked).toHaveLength(4);
    expect(r.usedRelaxations).toContain("recent");
  });

  it("honours allowRepeat without relaxing", () => {
    const pool = poolOf(4);
    const r = fillSection(pool, section({ count: 4 }), createRng(1), {
      recentlySeen: IDS(pool),
      allowRepeat: true,
    });
    expect(r.picked).toHaveLength(4);
    expect(r.usedRelaxations).toHaveLength(0);
  });

  it("relaxes the topic scope to fill a narrow filter", () => {
    const pool = [
      ...poolOf(3, { topic_id: TOPIC_A }),
      ...poolOf(3, { topic_id: TOPIC_B }),
    ];
    const filter = sectionFilterSchema.parse({ topic_ids: [TOPIC_A] });
    const r = fillSection(pool, section({ count: 5, filter }), createRng(1));
    expect(r.picked).toHaveLength(5);
    expect(r.usedRelaxations).toContain("topic");
  });

  it("respects a difficulty mix when the bank allows it", () => {
    const pool = [
      ...poolOf(4, { difficulty: 1 }),
      ...poolOf(4, { difficulty: 2 }),
      ...poolOf(4, { difficulty: 3 }),
    ];
    const s = section({ count: 6, difficulty_mix: { "1": 2, "2": 2, "3": 2 } });
    const r = fillSection(pool, s, createRng(5));
    const bands = r.picked.map((x) => x.question.difficulty).sort();
    expect(bands).toEqual([1, 1, 2, 2, 3, 3]);
    expect(r.warnings).toHaveLength(0);
  });

  it("falls back to other bands rather than returning short on a thin mix", () => {
    const pool = [...poolOf(1, { difficulty: 1 }), ...poolOf(9, { difficulty: 2 })];
    const s = section({ count: 6, difficulty_mix: { "1": 3, "3": 3 } });
    const r = fillSection(pool, s, createRng(5));
    expect(r.picked).toHaveLength(6);

    expect(r.usedRelaxations.length).toBeGreaterThan(0);
  });

  it("returns an empty result for a zero-count section", () => {
    const r = fillSection(poolOf(5), section({ count: 0 }), createRng(1));
    expect(r.picked).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });

/* ------------------------------------------------------------ assembly */

describe("generateStatic", () => {
  const pool = poolOf(30);

  it("numbers picks contiguously from zero", () => {
    const r = generateStatic([section({ count: 3, id: "s1" }), section({ count: 2, id: "s2" })], pool, 1);
    expect(r.picks.map((p) => p.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("never reuses a question across sections", () => {
    const r = generateStatic([section({ count: 5, id: "s1" }), section({ count: 5, id: "s2" })], pool, 4);
    const ids = r.picks.map((p) => p.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tags each pick with its section id", () => {
    const r = generateStatic([section({ count: 2, id: "s1" }), section({ count: 2, id: "s2" })], pool, 1);
    expect(r.picks.filter((p) => p.sectionId === "s1")).toHaveLength(2);
    expect(r.picks.filter((p) => p.sectionId === "s2")).toHaveLength(2);
  });

  it("is reproducible from the recorded seed", () => {
    const sections = [section({ count: 6, id: "s1" })];
    const a = generateStatic(sections, pool, 777);
    const b = generateStatic(sections, pool, 777);
    expect(a.picks.map((p) => p.questionId)).toEqual(b.picks.map((p) => p.questionId));
    expect(a.seed).toBe(777);
  });

  it("aggregates shortfall warnings across sections", () => {
    const r = generateStatic([section({ count: 20, title: "A", id: "s1" })], poolOf(3), 1);
    expect(r.warnings.some((w) => w.code === "SHORTFALL")).toBe(true);
  });

  it("keeps section order but shuffles inside it", () => {
    const r = generateStatic([section({ count: 3, id: "s1" }), section({ count: 3, id: "s2" })], pool, 2, {}, true);
    const first = r.picks.filter((p) => p.sectionId === "s1").map((p) => p.position);
    const second = r.picks.filter((p) => p.sectionId === "s2").map((p) => p.position);
    expect(Math.max(...first)).toBeLessThan(Math.min(...second));
  });
});


/* ------------------------------------------------------------- adaptive */

describe("nextAdaptiveQuestion", () => {
  const pool = poolOf(3, { difficulty: 1 })
    .concat(poolOf(3, { difficulty: 2 }))
    .concat(poolOf(3, { difficulty: 3 }));

  it("starts at medium difficulty", () => {
    expect(nextAdaptiveQuestion(pool, [], { total: 5, startDifficulty: 2 })?.question.difficulty).toBe(2);
  });

  it("steps up after two consecutive correct answers", () => {
    const answered = [
      { questionId: "a", correct: true },
      { questionId: "b", correct: true },
    ];
    expect(nextAdaptiveQuestion(pool, answered, { total: 5, startDifficulty: 2 })?.question.difficulty).toBe(3);
  });

  it("steps down after two consecutive wrong answers", () => {
    const answered = [
      { questionId: "a", correct: false },
      { questionId: "b", correct: false },
    ];
    expect(nextAdaptiveQuestion(pool, answered, { total: 5, startDifficulty: 2 })?.question.difficulty).toBe(1);
  });

  it("never re-serves a question already answered", () => {
    const first = nextAdaptiveQuestion(pool, [], { total: 5 });
    const answered = [{ questionId: first!.question.id, correct: true }];
    expect(nextAdaptiveQuestion(pool, answered, { total: 5 })?.question.id).not.toBe(first!.question.id);
  });

  it("stops at the total", () => {
    const answered = Array.from({ length: 5 }, (_, i) => ({ questionId: `q${i}`, correct: true }));
    expect(nextAdaptiveQuestion(pool, answered, { total: 5 })).toBeNull();
  });

  it("stops early at the confidence threshold", () => {
    const answered = Array.from({ length: 3 }, (_, i) => ({ questionId: `q${i}`, correct: true }));
    expect(nextAdaptiveQuestion(pool, answered, { total: 10, confidenceThreshold: 3 })).toBeNull();
  });

  it("is deterministic for the same answer history", () => {
    const answered = [{ questionId: "a", correct: true }];
    expect(nextAdaptiveQuestion(pool, answered, { total: 5 })?.question.id).toBe(
      nextAdaptiveQuestion(pool, answered, { total: 5 })?.question.id
    );
  });

  it("returns null when the pool is exhausted", () => {
    const one = pool.slice(0, 1);
    const answered = [{ questionId: one[0].question.id, correct: true }];
    expect(nextAdaptiveQuestion(one, answered, { total: 5 })).toBeNull();
  });
});


/* ----------------------------------------------------- weak area / daily */

describe("weakAreaWeights", () => {
  it("weights a mastered topic near zero and a weak one near one", () => {
    const w = weakAreaWeights([TOPIC_A, TOPIC_B], { [TOPIC_A]: 0.9, [TOPIC_B]: 0.1 });
    expect(w[TOPIC_A]).toBeCloseTo(0.1);
    expect(w[TOPIC_B]).toBeCloseTo(0.9);
  });

  it("treats an unseen topic as fully weighted", () => {
    expect(weakAreaWeights([TOPIC_A])[TOPIC_A]).toBe(1);
  });
});

describe("weightedSample", () => {
  it("never picks a zero-weight item", () => {
    const out = weightedSample([{ w: 0 }, { w: 0 }, { w: 1 }], (i) => i.w, 5, createRng(2));
    expect(out.every((i) => i.w === 1)).toBe(true);
  });

  it("samples without replacement", () => {
    const out = weightedSample([1, 2, 3, 4], () => 1, 3, createRng(2));
    expect(new Set(out).size).toBe(3);
  });

  it("favours the higher-weighted item over many draws", () => {
    // weightedSample is without replacement, so a single call over two items can
    // return at most two. The distribution is measured over many single draws.
    let ones = 0;
    for (let i = 0; i < 200; i++) {
      const out = weightedSample([0, 1], (x) => x, 1, createRng(i + 1));
      if (out[0] === 1) ones += 1;
    }
    expect(ones).toBeGreaterThan(150);
  });

  it("stops when only zero-weight items remain", () => {
    // Without replacement, and with the 0-weight item never pickable, a single
    // call can return at most the one weighted item - not the whole pool.
    const out = weightedSample([0, 1], (x) => x, 200, createRng(9));
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(1);
  });

  it("returns nothing when every weight is zero", () => {
    expect(weightedSample([1, 2], () => 0, 2, createRng(1))).toEqual([]);
  });
});


/* --------------------------------------------------------- availability */

describe("checkAvailability", () => {
  it("reports a section as fillable when the exact match suffices", () => {
    const r = checkAvailability([section({ count: 3, id: "s1" })], poolOf(10));
    expect(r[0]).toMatchObject({ exact: 10, reachable: 10, canFill: true, shortfall: 0, wouldRelax: [] });
  });

  it("reports a shortfall the bank cannot cover even fully relaxed", () => {
    const r = checkAvailability([section({ count: 20, id: "s1" })], poolOf(3));
    expect(r[0].canFill).toBe(false);
    expect(r[0].shortfall).toBe(17);
    expect(r[0].reachable).toBe(3);
  });

  it("names the constraint that must be relaxed", () => {
    const pool = [...poolOf(3, { topic_id: TOPIC_A }), ...poolOf(3, { topic_id: TOPIC_B })];
    const filter = sectionFilterSchema.parse({ topic_ids: [TOPIC_A] });
    const r = checkAvailability([section({ count: 5, id: "s1", filter })], pool);
    expect(r[0].exact).toBe(3);
    expect(r[0].canFill).toBe(true);
    expect(r[0].wouldRelax).toContain("topic");
  });

  it("reports per section independently", () => {
    const r = checkAvailability(
      [section({ count: 1, title: "ok", id: "s1" }), section({ count: 99, title: "short", id: "s2" })],
      poolOf(5)
    );
    expect(r[0].canFill).toBe(true);
    expect(r[1].canFill).toBe(false);
  });
});

/* -------------------------------------------------------------- schemas */

describe("blueprint schema", () => {
  it("defaults a section's filter and marks", () => {
    const s = withSectionDefaults({ title: "S" });
    expect(s.count).toBe(5);
    expect(s.marks_per_q).toBe(1);
    expect(s.neg_marks).toBe(0);
    expect(s.filter.types).toEqual([]);
    expect(s.filter.difficulty_min).toBe(1);
    expect(s.filter.difficulty_max).toBe(3);
  });

  it("rejects an inverted difficulty band", () => {
    expect(sectionFilterSchema.safeParse({ difficulty_min: 3, difficulty_max: 1 }).success).toBe(false);
  });

  it("requires a kebab-case slug", () => {
    const base = { name: "T", sections: [{ title: "S" }] };
    expect(createBlueprintSchema.safeParse({ ...base, slug: "good-slug" }).success).toBe(true);
    expect(createBlueprintSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
  });

  it("requires at least one section", () => {
    expect(createBlueprintSchema.safeParse({ name: "T", slug: "t", sections: [] }).success).toBe(false);
  });

  it("accepts every blueprint kind from the Phase-1 enum", () => {
    for (const kind of BLUEPRINT_KINDS) {
      expect(
        createBlueprintSchema.safeParse({ name: "T", slug: "t", kind, sections: [{ title: "S" }] }).success,
        `rejected kind ${kind}`
      ).toBe(true);
    }
  });

  it("exposes a stable relaxation order ending with the topic scope", () => {
    expect(RELAXATION_ORDER[0]).toBe("recent");
    expect(RELAXATION_ORDER[RELAXATION_ORDER.length - 1]).toBe("topic");
  });
});

});
