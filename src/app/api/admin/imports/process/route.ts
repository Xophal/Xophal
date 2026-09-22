import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

async function processJob(adminClient: ReturnType<typeof createAdminClient>, job: any) {
  const rows = job.preview_data ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No rows to process");
  }

  if (job.entity_type === "mock_tests") {
    const inserts = rows.map((r) => ({
      title: r.title || r.name || "Untitled",
      test_type_id: r.test_type_id || null,
      slug: r.slug || null,
      description: r.description || null,
      subject_id: r.subject_id || null,
      chapter_id: r.chapter_id || null,
      total_questions: r.total_questions ?? null,
      total_marks: r.total_marks ?? null,
      duration_minutes: r.duration_minutes ?? null,
      is_published: true,
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
      const questionType = r.question_type_id ? null : (await adminClient.from("question_types").select("id").ilike("code", String(r.question_type || "single_correct")).maybeSingle()).data;
      const difficulty = r.difficulty_level_id ? null : (r.difficulty ? (await adminClient.from("difficulty_levels").select("id").ilike("code", String(r.difficulty)).maybeSingle()).data : null);
      const payload = {
        topic_id: r.topic_id || null,
        question_type_id: r.question_type_id || questionType?.id || null,
        difficulty_level_id: r.difficulty_level_id || difficulty?.id || null,
        language_id: r.language_id || null,
        question_text: r.question_text || r.stem || "",
        explanation: r.explanation || null,
        tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === "string" ? r.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean) : [],
        status: r.status || "draft",
        marks: r.marks ? Number(r.marks) : 1,
        negative_marks: r.negative_marks ? Number(r.negative_marks) : 0,
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
          optionInserts.push({ question_id: qid, option_text: r[key], is_correct: (r.correct_option || "") === label, sort_order: i });
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
      chapter_id: r.chapter_id || null,
      code: r.code || null,
      name: r.name || r.title || "Untitled",
      description: r.description || null,
      sort_order: r.sort_order ? Number(r.sort_order) : 0,
      is_active: r.is_active === false || String(r.is_active) === "false" ? false : true,
      metadata: r.metadata ? (typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata) : null,
    }));

    const { error: tErr } = await adminClient.from("topics").insert(inserts);
    if (tErr) throw tErr;
    return inserts.length;
  }

  if (job.entity_type === "lessons") {
    const inserts = rows.map((r) => ({
      topic_id: r.topic_id || null,
      title: r.title || r.name || "Untitled Lesson",
      slug: r.slug || String(r.title || r.name || "untitled-lesson").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      content: r.content || r.body || "",
      content_html: r.content_html || null,
      duration_minutes: r.duration ? Number(r.duration) : null,
      created_by: job.user_id,
    }));

    const { error: lErr } = await adminClient.from("lessons").insert(inserts);
    if (lErr) throw lErr;
    return inserts.length;
  }

  if (job.entity_type === "notes") {
    const slugify = (s: any) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const inserts = rows.map((r) => ({
      topic_id: r.topic_id || null,
      chapter_id: r.chapter_id || null,
      title: r.title || r.name || "Untitled Note",
      slug: r.slug || slugify(r.title || r.name || "untitled"),
      content: r.content || r.body || "",
      language_id: r.language_id || null,
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
    const { user, profile } = await requireAdminAuth();
    const body = await request.json();
    const jobId = body?.jobId;
    if (!jobId) return apiError("jobId is required", 400, "MISSING_JOB_ID");

    const adminClient = createAdminClient();
    const { data: job, error: fetchErr } = await adminClient.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!job) return apiError("Import job not found", 404, "NOT_FOUND");
    if (job.user_id !== user.id && profile.roles?.[0]?.code !== "super_admin") {
      return apiError("You cannot process this import job", 403, "FORBIDDEN");
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
