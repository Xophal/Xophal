const { createClient } = require("@supabase/supabase-js");

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error("Usage: node scripts/apply-import.js <IMPORT_JOB_ID>");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in environment");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: jobs, error: fetchErr } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    console.error("Failed to fetch import job:", fetchErr);
    process.exit(1);
  }

  const job = jobs;
  if (!job) {
    console.error("Import job not found:", jobId);
    process.exit(1);
  }

  if (!job.preview_data || !Array.isArray(job.preview_data) || job.preview_data.length === 0) {
    console.error("No rows found in import job preview_data");
    process.exit(1);
  }

  const rows = job.preview_data;

  try {
    if (job.entity_type === "mock_tests") {
      // Insert mock tests
      const inserts = rows.map((r) => ({
        title: r.title || r.name || "Untitled",
        test_type_id: null,
        slug: (r.slug) || null,
        description: r.description || null,
        subject_id: r.subject_id || null,
        chapter_id: r.chapter_id || null,
        total_questions: r.total_questions ?? null,
        total_marks: r.total_marks ?? null,
        duration_minutes: r.duration_minutes ?? null,
        is_published: true,
        is_active: true,
        year: r.year ?? null,
        created_at: new Date().toISOString(),
      }));

      const { data: inserted, error: insertErr } = await supabase.from("mock_tests").insert(inserts).select();
      if (insertErr) throw insertErr;
      console.log(`Inserted ${inserted.length} mock_tests`);
    } else if (job.entity_type === "questions") {
      for (const r of rows) {
        const payload = {
          topic_id: r.topic_id || null,
          type: r.question_type || r.type || "MCQ",
          difficulty: r.difficulty || "MEDIUM",
          language_id: r.language_id || null,
          stem: r.question_text || r.stem || "",
          explanation: r.explanation || null,
          marks: r.marks ? Number(r.marks) : 1,
          negative_marks: r.negative_marks ? Number(r.negative_marks) : 0,
          status: r.status || "PUBLISHED",
          year: r.year ? Number(r.year) : null,
          source: r.source || null,
          author_id: r.author_id || job.user_id || null,
          created_at: new Date().toISOString(),
        };

        const { data: qdata, error: qerr } = await supabase.from("questions").insert([payload]).select().maybeSingle();
        if (qerr) {
          console.error("Failed to insert question:", qerr, "row:", r);
          continue;
        }

        const qid = qdata?.id;
        // Insert options if provided (option_a, option_b, option_c, option_d, correct_option)
        const optionKeys = ["option_a", "option_b", "option_c", "option_d"];
        const optionInserts = [];
        for (let i = 0; i < optionKeys.length; i++) {
          const key = optionKeys[i];
          if (r[key]) {
            const label = String.fromCharCode(65 + i); // A, B, C, D
            optionInserts.push({ question_id: qid, label, text: r[key], is_correct: (r.correct_option || "") === label, sort_order: i });
          }
        }

        if (optionInserts.length) {
          const { error: optErr } = await supabase.from("question_options").insert(optionInserts);
          if (optErr) console.error("Failed to insert options for question", qid, optErr);
        }
      }
      console.log(`Processed ${rows.length} questions`);
    } else {
      console.error("Entity type not supported by script:", job.entity_type);
      process.exit(1);
    }

    // Additional entity mappings
    if (job.entity_type === "topics") {
      const inserts = rows.map((r) => ({
        chapter_id: r.chapter_id || null,
        code: r.code || null,
        name: r.name || (r.title || "Untitled"),
        description: r.description || null,
        sort_order: r.sort_order ? Number(r.sort_order) : 0,
        is_active: r.is_active === "false" ? false : true,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        created_at: new Date().toISOString(),
      }));

      const { data: insertedTopics, error: tErr } = await supabase.from("topics").insert(inserts).select();
      if (tErr) throw tErr;
      console.log(`Inserted ${insertedTopics.length} topics`);
    }

    if (job.entity_type === "lessons") {
      const inserts = rows.map((r) => ({
        topic_id: r.topic_id || null,
        code: r.code || null,
        title: r.title || (r.name || "Untitled Lesson"),
        content: r.content || r.body || "",
        content_html: r.content_html || null,
        status: r.status || "DRAFT",
        duration: r.duration ? Number(r.duration) : null,
        author_id: r.author_id || job.user_id || null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        created_at: new Date().toISOString(),
      }));

      const { data: insertedLessons, error: lErr } = await supabase.from("lessons").insert(inserts).select();
      if (lErr) throw lErr;
      console.log(`Inserted ${insertedLessons.length} lessons`);
    }

    if (job.entity_type === "notes") {
      const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const inserts = rows.map((r) => ({
        topic_id: r.topic_id || null,
        chapter_id: r.chapter_id || null,
        title: r.title || (r.name || "Untitled Note"),
        slug: r.slug || slugify(r.title || r.name || "untitled"),
        content: r.content || r.body || "",
        summary: r.summary || null,
        status: r.status || "DRAFT",
        language_id: r.language_id || null,
        author_id: r.author_id || job.user_id || null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        created_at: new Date().toISOString(),
      }));

      const { data: insertedNotes, error: nErr } = await supabase.from("notes").insert(inserts).select();
      if (nErr) throw nErr;
      console.log(`Inserted ${insertedNotes.length} notes`);
    }

    // mark job completed
    await supabase.from("import_jobs").update({ status: "COMPLETED", imported_rows: rows.length }).eq("id", jobId);
    console.log("Import applied successfully");
  } catch (err) {
    console.error("Error applying import:", err);
    await supabase.from("import_jobs").update({ status: "FAILED" }).eq("id", jobId);
    process.exit(1);
  }
}

main();
