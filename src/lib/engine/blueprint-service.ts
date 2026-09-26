import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";

import type {
  BlueprintQuery,
  BlueprintSectionDefaults,
  BlueprintSectionInput,
  CreateBlueprintInput,
  SectionFilter,
  UpdateBlueprintInput,
} from "./blueprint-schema";
import { sectionFilterSchema, withSectionDefaults } from "./blueprint-schema";
import type { BlueprintKind } from "./blueprint-schema";
import type { Candidate } from "./generator";
import { matchesFilter, matchesTags, RELAXATION_ORDER } from "./generator";
import type { Relaxation } from "./generator";

type Admin = SupabaseClient;

const BP_SELECT =
  "id,name,slug,description,kind,duration_sec,total_marks,marking_scheme_json,shuffle_questions,shuffle_options,is_public,chapter_id,subject_id,created_at,updated_at";

export type BlueprintRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: BlueprintKind;
  duration_sec: number;
  total_marks: number;
  marking_scheme_json: Record<string, unknown> | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_public: boolean;
  chapter_id: string | null;
  subject_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BlueprintSectionRow = {
  id: string;
  blueprint_id: string;
  title: string;
  position: number;
  filter_json: Record<string, unknown> | null;
  count: number;
  marks_per_q: number;
  neg_marks: number;
  instructions: string | null;
  difficulty_mix?: Record<string, number> | null;
};

export type ResolvedSection = BlueprintSectionDefaults & { id: string };

/* ------------------------------------------------------------- shaping */

function parseFilter(raw: unknown): SectionFilter {
  const parsed = sectionFilterSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : sectionFilterSchema.parse({});
}

/** DB row -> a section with schema defaults applied. */
export function shapeSection(row: BlueprintSectionRow): ResolvedSection {
  const filled = withSectionDefaults({
    id: row.id,
    title: row.title,
    position: row.position,
    filter: parseFilter(row.filter_json),
    count: row.count,
    marks_per_q: Number(row.marks_per_q),
    neg_marks: Number(row.neg_marks),
    instructions: row.instructions ?? "",
    difficulty_mix: (row.difficulty_mix ?? {}) as Record<string, number>,
  });
  return { ...filled, id: row.id };
}

/* ---------------------------------------------------------------- read */

export async function listBlueprints(admin: Admin, q: BlueprintQuery) {
  let query = admin.from("blueprints").select(BP_SELECT, { count: "exact" });
  if (q.search) query = query.ilike("name", `%${q.search}%`);
  if (q.kind) query = query.eq("kind", q.kind as BlueprintKind);
  if (q.chapterId) query = query.eq("chapter_id", q.chapterId);
  if (q.isPublic === "true") query = query.eq("is_public", true);
  if (q.isPublic === "false") query = query.eq("is_public", false);
  const offset = (q.page - 1) * q.limit;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + q.limit - 1);
  if (error) throw error;
  return { rows: (data ?? []) as BlueprintRow[], total: count ?? 0, page: q.page, limit: q.limit };
}

export async function getBlueprint(admin: Admin, id: string) {
  const { data, error } = await admin
    .from("blueprints")
    .select(`${BP_SELECT},blueprint_sections(*)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Blueprint not found.", "NOT_FOUND");
  const bp = data as BlueprintRow & { blueprint_sections: BlueprintSectionRow[] | null };
  const sections = (bp.blueprint_sections ?? []).slice().sort((a, b) => a.position - b.position).map(shapeSection);
  return { ...bp, sections };
}

export type ResolvedBlueprint = Awaited<ReturnType<typeof getBlueprint>>;

/* --------------------------------------------------------------- write */

function sectionRows(blueprintId: string, sections: BlueprintSectionInput[]) {
  return sections.map((s, i) => {
    const filled = withSectionDefaults({ ...s, position: s.position ?? i });
    return {
      id: filled.id,
      blueprint_id: blueprintId,
      title: filled.title,
      position: i,
      filter_json: filled.filter,
      count: filled.count,
      marks_per_q: filled.marks_per_q,
      neg_marks: filled.neg_marks,
      instructions: filled.instructions,
      difficulty_mix: filled.difficulty_mix,
    };
  });
}

export async function createBlueprint(admin: Admin, userId: string | null, input: CreateBlueprintInput) {
  const { data, error } = await admin
    .from("blueprints")
    .insert([
      {
        name: input.name,
        slug: input.slug,
        description: input.description,
        kind: input.kind,
        duration_sec: input.duration_sec,
        total_marks: input.total_marks,
        marking_scheme_json: input.marking_scheme,
        shuffle_questions: input.shuffle_questions,
        shuffle_options: input.shuffle_options,
        is_public: input.is_public,
        chapter_id: input.chapter_id ?? null,
        subject_id: input.subject_id ?? null,
        created_by: userId,
      },
    ])
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "That slug is already in use.", "SLUG_TAKEN");
    throw error;
  }
  const id = (data as { id: string }).id;
  const rows = sectionRows(id, input.sections ?? []);
  if (rows.length) {
    const { error: se } = await admin.from("blueprint_sections").insert(rows);
    if (se) throw se;
  }
  return getBlueprint(admin, id);
}

/**
 * Updates the header and reconciles the section set. Sections carrying an `id`
 * present in the blueprint are updated in place, new ones are inserted, and any
 * existing section missing from the payload is deleted. Deleting a section is
 * safe: `test_instance_questions.section_id` is ON DELETE SET NULL, so instances
 * already generated keep their frozen question list.
 */
export async function updateBlueprint(admin: Admin, id: string, input: UpdateBlueprintInput) {
  const { data: existing, error: exErr } = await admin.from("blueprints").select("id").eq("id", id).maybeSingle();
  if (exErr) throw exErr;
  if (!existing) throw new ApiError(404, "Blueprint not found.", "NOT_FOUND");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.duration_sec !== undefined) patch.duration_sec = input.duration_sec;
  if (input.total_marks !== undefined) patch.total_marks = input.total_marks;
  if (input.marking_scheme !== undefined) patch.marking_scheme_json = input.marking_scheme;
  if (input.shuffle_questions !== undefined) patch.shuffle_questions = input.shuffle_questions;
  if (input.shuffle_options !== undefined) patch.shuffle_options = input.shuffle_options;
  if (input.is_public !== undefined) patch.is_public = input.is_public;
  if (input.chapter_id !== undefined) patch.chapter_id = input.chapter_id;
  if (input.subject_id !== undefined) patch.subject_id = input.subject_id;

  const { error: ue } = await admin.from("blueprints").update(patch).eq("id", id);
  if (ue) {
    if (ue.code === "23505") throw new ApiError(409, "That slug is already in use.", "SLUG_TAKEN");
    throw ue;
  }

  if (input.sections !== undefined) {
    const { data: current } = await admin.from("blueprint_sections").select("id").eq("blueprint_id", id);
    const currentIds = new Set(((current ?? []) as Array<{ id: string }>).map((r) => r.id));
    const keep = new Set<string>();
    for (const s of input.sections) {
      const filled = withSectionDefaults(s);
      if (filled.id && currentIds.has(filled.id)) keep.add(filled.id);
    }
    const stale = [...currentIds].filter((cid) => !keep.has(cid));
    if (stale.length) {
      const { error: de } = await admin.from("blueprint_sections").delete().in("id", stale);
      if (de) throw de;
    }
    const rows = sectionRows(id, input.sections);
    const inserts = rows.filter((r) => !r.id || !currentIds.has(r.id));
    const updates = rows.filter((r) => r.id && currentIds.has(r.id));
    if (inserts.length) {
      const { error: ie } = await admin.from("blueprint_sections").insert(inserts);
      if (ie) throw ie;
    }
    for (const r of updates) {
      const { blueprint_id: _ignored, ...rest } = r;
      const { error: se } = await admin.from("blueprint_sections").update(rest).eq("id", r.id as string);
      if (se) throw se;
    }
  }

  return getBlueprint(admin, id);
}

export async function deleteBlueprint(admin: Admin, id: string) {
  const { error } = await admin.from("blueprints").delete().eq("id", id);
  if (error) throw error;
  return { id, deleted: true };
}

/* -------------------------------------------------- availability check */

export type SectionAvailability = {
  sectionId: string | null;
  title: string;
  requested: number;
  /** Published questions matching the filter with no relaxation at all. */
  exact: number;
  /** Best reachable count once constraints are dropped in RELAXATION_ORDER. */
  reachable: number;
  canFill: boolean;
  /** Which constraint levels would have to be dropped, in order. */
  wouldRelax: string[];
  shortfall: number;
};

/**
 * Loads the published question pool used by both the availability check and the
 * generator. Only published questions are ever eligible, which is what keeps a
 * draft or AI-generated question out of a live paper.
 *
 * The result is sorted by id and the query is explicitly ordered, because the
 * generator's whole reproducibility guarantee rests on this: `seededShuffle`
 * permutes the pool in whatever order it arrives, so an unstable row order from
 * Postgres (heap order changes after any update/vacuum) would give the same seed
 * two different papers. An appeal against a generated test has to be able to
 * rebuild the exact paper.
 */
export async function loadPool(admin: Admin, limit = 2000): Promise<Candidate[]> {
  const { data, error } = await admin
    .from("questions")
    .select(
      "id,engine_type,topic_id,subtopic_id,parent_id,difficulty,skill,board_pattern,pyq_year,lang,est_time_sec,question_tags(tag)"
    )
    .eq("engine_status", "published")
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ question_tags?: Array<{ tag: string }> | null }>;
  return rows.map((r) => ({
    question: r as unknown as Candidate["question"],
    tags: (r.question_tags ?? []).map((t) => t.tag),
  }));
}

function countAt(pool: readonly Candidate[], filter: SectionFilter, relaxed: Relaxation): number {
  let n = 0;
  for (const c of pool) {
    if (!matchesFilter(c.question, filter, relaxed)) continue;
    if (!matchesTags(c.tags, filter, relaxed)) continue;
    n += 1;
  }
  return n;
}

/**
 * The admin builder's live "can this be filled?" check. Reports per section the
 * exact match count, the best reachable count, and which constraints would have
 * to be dropped — so an admin sees *why* a section is short, not just that it is.
 */
export function checkAvailability(
  sections: readonly (BlueprintSectionDefaults & { id?: string | null })[],
  pool: readonly Candidate[]
): SectionAvailability[] {
  const everything: Relaxation = new Set(RELAXATION_ORDER);
  return sections.map((s) => {
    const exact = countAt(pool, s.filter, new Set());
    const reachable = countAt(pool, s.filter, everything);

    const wouldRelax: string[] = [];
    if (exact < s.count) {
      const acc: Relaxation = new Set();
      for (const level of RELAXATION_ORDER) {
        acc.add(level);
        // Record the level even when it is the one that finally makes the section
        // fillable: the admin needs to see WHICH constraint has to go, not just
        // the ones that turned out to be insufficient.
        wouldRelax.push(level);
        if (countAt(pool, s.filter, acc) >= s.count) break;
      }
    }

    return {
      sectionId: s.id ?? null,
      title: s.title,
      requested: s.count,
      exact,
      reachable,
      canFill: reachable >= s.count,
      wouldRelax,
      shortfall: Math.max(0, s.count - reachable),
    };
  });
}
