import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

type ImportRow = Record<string, unknown>;
type ImportJob = { preview_data: unknown; entity_type: string; user_id: string; status: string; invalid_rows: number; valid_rows: number };

function text(row: ImportRow, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function rowsOf(value: unknown): ImportRow[] {
  return Array.isArray(value) ? value.filter((row): row is ImportRow => typeof row === "object" && row !== null && !Array.isArray(row)) : [];
}

async function processJob(adminClient: ReturnType<typeof createAdminClient>, job: ImportJob) {
  const rows = rowsOf(job.preview_data);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No rows to process");
  }

  if (job.entity_type === "mock_tests") {
    const inserts = rows.map((r) => ({
      title: text(r, "title", text(r, "name", "Untitled")),
      test_type_id: text(r, "test_type_id") || null,
      slug: text(r, "slug") || null,
      description: text(r, "description") || null,
      subject_id: text(r, "subject_id") || null,
      chapter_id: text(r, "chapter_id") || null,
      total_questions: Number(r.total_questions) || 0,
      total_marks: Number(r.total_marks) || 0,
      duration_minutes: Number(r.duration_minutes) || 45,
      is_published: false,
      is_active: true,
      year: r.year ?? null,
    }));

    const { error: insertErr } = await adminClient.from("mock_tests").insert(inserts);
    if (insertErr) throw insertErr;
    return inserts.length;
  }

  if (job.entity_type === "questions") {
    let processed = 0;
    for (const r of rows) {
      const questionTypeId = text(r, "question_type_id");
      const difficultyLevelId = text(r, "difficulty_level_id");
      const difficultyValue = text(r, "difficulty");
      const questionType = questionTypeId ? null : (await adminClient.from("question_types").select("id").ilike("code", text(r, "question_type", "single_correct")).maybeSingle()).data;
      const difficulty = difficultyLevelId ? null : (difficultyValue ? (await adminClient.from("difficulty_levels").select("id").ilike("code", difficultyValue).maybeSingle()).data : null);
      const tags = r.tags;
      const payload = {
        topic_id: text(r, "topic_id") || null,
        question_type_id: questionTypeId || questionType?.id || null,
        difficulty_level_id: difficultyLevelId || difficulty?.id || null,
        language_id: text(r, "language_id") || null,
        question_text: text(r, "question_text", text(r, "stem")),
        explanation: text(r, "explanation") || null,
        tags: Array.isArray(tags) ? tags.map(String) : typeof tags === "string" ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
        status: text(r, "status", "draft"),
        marks: Number(r.marks) || 1,
        negative_marks: Number(r.negative_marks) || 0,
        created_by: job.user_id,
      };

      const { data: qdata, error: qerr } = await adminClient.from("questions").insert([payload]).select().maybeSingle();
      if (qerr) {
        console.error("Failed to insert question:", qerr, "row:", r);
        continue;
      }

      const qid = qdata?.id;
      const optionKeys = ["option_a", "option_b", "option_c", "option_d"];
      const optionInserts = [];
      for (let i = 0; i < optionKeys.length; i++) {
        const key = optionKeys[i];
        if (r[key]) {
          const label = String.fromCharCode(65 + i);
          optionInserts.push({ question_id: qid, option_text: String(r[key]), is_correct: text(r, "correct_option") === label, sort_order: i });
        }
      }

      if (optionInserts.length) {
        const { error: optErr } = await adminClient.from("question_options").insert(optionInserts);
        if (optErr) console.error("Failed to insert options for question", qid, optErr);
      }

      processed++;
    }

    return processed;
  }

  if (job.entity_type === "topics") {
    const inserts = rows.map((r) => ({
      chapter_id: text(r, "chapter_id") || null,
      code: text(r, "code") || null,
      name: text(r, "name", text(r, "title", "Untitled")),
      description: text(r, "description") || null,
      sort_order: Number(r.sort_order) || 0,
      is_active: r.is_active === false || String(r.is_active) === "false" ? false : true,
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
    }));

    const { error: tErr } = await adminClient.from("topics").insert(inserts);
    if (tErr) throw tErr;
    return inserts.length;
  }

  if (job.entity_type === "lessons") {
    const inserts = rows.map((r) => ({
      topic_id: text(r, "topic_id") || null,
      title: text(r, "title", text(r, "name", "Untitled Lesson")),
      slug: text(r, "slug") || text(r, "title", text(r, "name", "untitled-lesson")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      content: text(r, "content", text(r, "body")),
      content_html: text(r, "content_html") || null,
      duration_minutes: Number(r.duration) || null,
      created_by: job.user_id,
    }));

    const { error: lErr } = await adminClient.from("lessons").insert(inserts);
    if (lErr) throw lErr;
    return inserts.length;
  }

  if (job.entity_type === "notes") {
    const slugify = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const inserts = rows.map((r) => ({
      topic_id: text(r, "topic_id") || null,
      chapter_id: text(r, "chapter_id") || null,
      title: text(r, "title", text(r, "name", "Untitled Note")),
      slug: text(r, "slug") || slugify(text(r, "title", text(r, "name", "untitled"))),
      content: text(r, "content", text(r, "body")),
      language_id: text(r, "language_id") || null,
      is_active: r.is_active !== false && String(r.is_active) !== "false",
    }));

    const { error: nErr } = await adminClient.from("notes").insert(inserts);
    if (nErr) throw nErr;
    return inserts.length;
  }

  throw new Error(`Unsupported entity type: ${job.entity_type}`);
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const body = await request.json();
    const jobId = body?.jobId;
    if (!jobId) return apiError("jobId is required", 400, "MISSING_JOB_ID");

    const adminClient = createAdminClient();
    const { data: jobData, error: fetchErr } = await adminClient.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!jobData) return apiError("Import job not found", 404, "NOT_FOUND");
    const job = jobData as unknown as ImportJob;
    if (job.user_id !== user.id && profile.roles?.[0]?.code !== "super_admin") {
      return apiError("You cannot process this import job", 403, "FORBIDDEN");
    }
    if (job.status !== "VALIDATED") return apiError("Only validated import jobs can be processed.", 409, "INVALID_JOB_STATE");
    if (job.invalid_rows > 0 || job.valid_rows === 0) {
      return apiError("Fix all validation errors before processing this import.", 400, "IMPORT_VALIDATION_FAILED");
    }

    // update status to IMPORTING
    await adminClient.from("import_jobs").update({ status: "IMPORTING" }).eq("id", jobId);

    try {
      const processed = await processJob(adminClient, job);
      await adminClient.from("import_jobs").update({ status: "COMPLETED", imported_rows: processed }).eq("id", jobId);
      return apiSuccess({ imported: processed });
    } catch (err) {
      console.error("Import processing failed:", err);
      await adminClient.from("import_jobs").update({ status: "FAILED" }).eq("id", jobId);
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
