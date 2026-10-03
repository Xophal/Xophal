import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { canAccessPremiumContent } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordLearningDiscoveryEvent } from "@/lib/ebooks/discovery-events";
import { getRecommendedMockTestsForEbook } from "@/lib/ebooks/data";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireAuth();
    if (!session?.profile) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const { slug } = await params;
    const adminClient = createAdminClient();
    const { data: test, error: testError } = await adminClient
      .from("mock_tests")
      .select("id, test_type_id, title, slug, description, subject_id, chapter_id, total_questions, total_marks, duration_minutes, passing_marks, negative_marking, negative_marks_ratio, shuffle_questions, shuffle_options, is_premium, is_published, year, instructions")
      .eq("slug", slug)
      .eq("is_published", true)
      .eq("is_active", true)
      .maybeSingle();

    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found", "TEST_NOT_FOUND");

    const sourceCandidate = new URL(request.url).searchParams.get("sourceEbookId");
    const parsedSource = sourceCandidate ? z.string().uuid().safeParse(sourceCandidate) : null;
    let sourceEbookId: string | null = null;
    if (parsedSource?.success) {
      const { data: sourceEbook, error: sourceEbookError } = await adminClient
        .from("ebook_listings")
        .select("id, exam_id, subject_id")
        .eq("id", parsedSource.data)
        .eq("status", "PUBLISHED")
        .maybeSingle();
      if (sourceEbookError) throw sourceEbookError;
      if (sourceEbook) {
        const recommendedTests = await getRecommendedMockTestsForEbook(sourceEbook);
        if (recommendedTests.some((candidate) => candidate.id === test.id)) sourceEbookId = parsedSource.data;
      }
    }

    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("id, status, expires_at, is_active")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    const { data: grant } = await adminClient
      .from("test_access_grants")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("mock_test_id", test.id)
      .maybeSingle();

    const premiumAccess = canAccessPremiumContent(session.profile, session.user, subscription);
    if (test.is_premium && !premiumAccess.allowed && !grant) {
      throw new ApiError(403, premiumAccess.reason || "Premium access required", "PREMIUM_REQUIRED");
    }

    const { data: questionRows, error: questionError } = await adminClient
      .from("mock_test_questions")
      .select("question_id, sort_order, marks_override, questions!inner(id, question_text, question_html, image_url, marks, negative_marks, time_seconds, topic_id, chapter_id, subject_id, status, is_active, question_types(code), question_options(id, option_text, option_html, image_url, sort_order, label, body, position))")
      .eq("mock_test_id", test.id)
      .eq("questions.status", "published")
      .eq("questions.is_active", true)
      .order("sort_order", { ascending: true });

    if (questionError) throw questionError;
    const questions = (questionRows || [])
      .map((row) => {
        const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        if (!question) return null;
        return {
          ...question,
          question_type: Array.isArray(question.question_types) ? question.question_types[0] : question.question_types,
          marks: row.marks_override ?? question.marks,
          options: (question.question_options || []).map((option) => ({
            ...option,
            is_correct: false,
          })),
        };
      })
      .filter((question) => question !== null);

    if (questions.length === 0) throw new ApiError(400, "This mock test has no questions yet", "TEST_EMPTY");

    const { data: existingAttempt } = await adminClient
      .from("test_attempts")
      .select("id, started_at, status, metadata")
      .eq("user_id", session.user.id)
      .eq("mock_test_id", test.id)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startingMetadata = existingAttempt?.metadata && typeof existingAttempt.metadata === "object"
      ? existingAttempt.metadata
      : {};
    const sourceAlreadyRecorded = Boolean(
      startingMetadata &&
      "source_ebook_id" in startingMetadata &&
      startingMetadata.source_ebook_id,
    );
    const attemptResult = existingAttempt
      ? sourceEbookId && !sourceAlreadyRecorded
        ? await adminClient
            .from("test_attempts")
            .update({ metadata: { ...startingMetadata, source_ebook_id: sourceEbookId } })
            .eq("id", existingAttempt.id)
            .select("id, started_at, status")
            .single()
        : { data: existingAttempt, error: null }
      : await adminClient
          .from("test_attempts")
          .insert({
            user_id: session.user.id,
            mock_test_id: test.id,
            status: "in_progress",
            total_questions: questions.length,
            total_marks: questions.reduce((total, question) => total + Number(question.marks || 0), 0),
            metadata: sourceEbookId ? { source_ebook_id: sourceEbookId } : {},
          })
          .select("id, started_at, status")
          .single();
    if (attemptResult.error) throw attemptResult.error;
    const attempt = attemptResult.data;

    if (!attempt) throw new ApiError(500, "Unable to start this mock test", "ATTEMPT_CREATE_FAILED");

    if (sourceEbookId && !sourceAlreadyRecorded) {
      await recordLearningDiscoveryEvent({
        eventName: "ebook_mock_test_started",
        ebookId: sourceEbookId,
        mockTestId: test.id,
        attemptId: attempt.id,
        userId: session.user.id,
        source: "test_attempt",
      });
    } else if (!existingAttempt) {
      await recordLearningDiscoveryEvent({
        eventName: "mock_test_started",
        mockTestId: test.id,
        attemptId: attempt.id,
        userId: session.user.id,
        source: "test_attempt",
      });
    }

    const { data: savedResponses } = await adminClient
      .from("test_responses")
      .select("question_id, selected_option_ids, text_answer, numerical_answer, time_spent_seconds, is_bookmarked, is_review_later, is_visited")
      .eq("attempt_id", attempt.id);

    return apiSuccess({
      attempt,
      test: { ...test, total_questions: questions.length, total_marks: questions.reduce((total, question) => total + Number(question.marks || 0), 0) },
      questions,
      responses: savedResponses ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}