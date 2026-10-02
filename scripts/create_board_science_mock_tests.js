const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "science";
}

async function main() {
  const { data: boards, error: boardErr } = await supabase
    .from("boards")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");
  if (boardErr) throw boardErr;

  const { data: classes, error: classErr } = await supabase
    .from("classes")
    .select("id, name, slug, board_id, grade_number")
    .eq("is_active", true)
    .order("sort_order");
  if (classErr) throw classErr;

  const { data: subjects, error: subErr } = await supabase
    .from("subjects")
    .select("id, name, slug, class_id")
    .eq("is_active", true)
    .order("sort_order");
  if (subErr) throw subErr;

  const { data: testTypes, error: typeErr } = await supabase
    .from("test_types")
    .select("id, code, name")
    .order("name");
  if (typeErr) throw typeErr;

  const testTypeId =
    (testTypes || []).find((row) => row.code === "mock")?.id ||
    (testTypes || []).find((row) => row.code === "practice")?.id ||
    (testTypes || [])[0]?.id;

  if (!testTypeId) throw new Error("No test_types rows are available to create mock tests.");

  const matches = [];
  for (const board of boards || []) {
    const boardClasses = (classes || []).filter((entry) => entry.board_id === board.id && Number(entry.grade_number) === 10);
    for (const currentClass of boardClasses) {
      const scienceSubject = (subjects || []).find(
        (subject) => subject.class_id === currentClass.id && subject.name.toLowerCase().includes("science")
      );
      if (!scienceSubject) continue;
      matches.push({ board, currentClass, scienceSubject });
    }
  }

  if (!matches.length) {
    throw new Error("No Board/Class 10 Science subject rows were found in the database.");
  }

  console.log("MATCHES", JSON.stringify(matches.map((match) => ({
    board: match.board.name,
    className: match.currentClass.name,
    subject: match.scienceSubject.name,
    subjectId: match.scienceSubject.id,
  })), null, 2));

  for (const match of matches) {
    const { board, currentClass, scienceSubject } = match;

    const { data: questionRows, error: questionErr } = await supabase
      .from("questions")
      .select("id")
      .eq("subject_id", scienceSubject.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);

    if (questionErr) throw questionErr;

    const questionIds = (questionRows || []).map((row) => row.id);
    if (questionIds.length < 5) {
      console.log(`Skipping ${board.name}/${currentClass.name} Science because only ${questionIds.length} questions are available.`);
      continue;
    }

    const slug = `${toSlug(board.slug)}-${toSlug(currentClass.slug)}-${toSlug(scienceSubject.slug)}-mock-test`;
    const title = `${board.name} ${currentClass.name} Science Mock Test`;

    const existing = await supabase
      .from("mock_tests")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let mockTestId;
    if (existing.data) {
      mockTestId = existing.data.id;
      console.log(`Found existing mock test for ${title}: ${mockTestId}`);
      await supabase.from("mock_test_questions").delete().eq("mock_test_id", mockTestId);
      await supabase
        .from("mock_tests")
        .update({
          title,
          subject_id: scienceSubject.id,
          duration_minutes: 45,
          total_questions: questionIds.length,
          total_marks: questionIds.length,
          passing_marks: 30,
          is_published: true,
          is_active: true,
          is_premium: false,
          year: new Date().getFullYear(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mockTestId);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("mock_tests")
        .insert([
          {
            test_type_id: testTypeId,
            title,
            slug,
            description: `Board-aligned Science practice test for ${board.name} ${currentClass.name}.`,
            subject_id: scienceSubject.id,
            chapter_id: null,
            total_questions: questionIds.length,
            total_marks: questionIds.length,
            duration_minutes: 45,
            passing_marks: 30,
            negative_marking: false,
            negative_marks_ratio: 0.25,
            shuffle_questions: true,
            shuffle_options: true,
            show_solutions: true,
            allow_review: true,
            is_premium: false,
            is_active: true,
            is_published: true,
            year: new Date().getFullYear(),
            instructions: "Attempt all questions and submit your answer at the end.",
            metadata: { source: "seed-script", board_slug: board.slug, class_slug: currentClass.slug, subject_slug: scienceSubject.slug },
            created_by: null,
          },
        ])
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      mockTestId = inserted.id;
    }

    const rows = questionIds.map((questionId, index) => ({
      mock_test_id: mockTestId,
      question_id: questionId,
      section_id: null,
      sort_order: index,
      marks_override: 1,
    }));

    const { error: linkErr } = await supabase.from("mock_test_questions").insert(rows);
    if (linkErr) throw linkErr;

    console.log(`Created/updated mock test: ${title} (${mockTestId}) with ${questionIds.length} questions.`);
  }

  console.log("SCIENCE MOCK TEST SETUP COMPLETE");
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
