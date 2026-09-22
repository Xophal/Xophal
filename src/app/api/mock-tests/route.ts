import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPaginationParams, paginatedResponse, apiSuccess, apiError, handleApiError, validateBody, ApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const mockTestCreateSchema = z.object({
  test_type_id: z.string().uuid().optional(),
  title: z.string().min(2).max(500),
  slug: z.string().min(2).max(500),
  description: z.string().optional().or(z.literal("")),
  subject_id: z.string().uuid().nullable().optional(),
  chapter_id: z.string().uuid().nullable().optional(),
  duration_minutes: z.number().int().positive().optional().default(45),
  passing_marks: z.number().optional(),
  negative_marking: z.boolean().optional().default(false),
  negative_marks_ratio: z.number().min(0).max(1).optional().default(0.25),
  shuffle_questions: z.boolean().optional().default(true),
  shuffle_options: z.boolean().optional().default(true),
  is_premium: z.boolean().optional().default(false),
  is_published: z.boolean().optional().default(false),
  year: z.number().int().optional(),
  instructions: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const boardSlug = searchParams.get("boardSlug");
    const classSlug = searchParams.get("classSlug");
    const subjectSlug = searchParams.get("subjectSlug");
    const testTypeCode = searchParams.get("testType");
    const search = searchParams.get("search")?.trim().replace(/[%_,()]/g, "") || "";
    const sort = searchParams.get("sort") || "newest";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let hasPremiumAccess = false;

    if (user?.email_confirmed_at) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      hasPremiumAccess = !!subscription;
    }

    let query = supabase
      .from("mock_tests")
      .select(
        "id, test_type_id, title, slug, description, subject_id, chapter_id, total_questions, total_marks, duration_minutes, is_premium, year, test_types(code, name), subjects(name), chapters(name)",
        { count: "exact" }
      )
      .eq("is_published", true)
      .eq("is_active", true)
      .gt("total_questions", 0)
      .gt("duration_minutes", 0);

    if (!hasPremiumAccess) query = query.eq("is_premium", false);

    if (testTypeCode) {
      const { data: testType } = await supabase
        .from("test_types")
        .select("id")
        .eq("code", testTypeCode)
        .single();
      if (testType) query = query.eq("test_type_id", testType.id);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (subjectSlug && boardSlug && classSlug) {
      const { data: subject } = await supabase
        .from("subjects")
        .select("id, classes!inner(slug, boards!inner(slug))")
        .eq("slug", subjectSlug)
        .eq("classes.slug", classSlug)
        .eq("classes.boards.slug", boardSlug)
        .single();
      if (subject) query = query.eq("subject_id", subject.id);
    }

    const sortColumn = sort === "oldest" ? "created_at" : sort === "alphabetical" ? "title" : "created_at";
    const { data, error, count } = await query
      .order(sortColumn, { ascending: sort === "oldest" || sort === "alphabetical" })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return apiSuccess(paginatedResponse(data || [], count || 0, page, limit));
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(mockTestCreateSchema, body);
    const adminClient = createAdminClient();

    const { data: duplicateSlug } = await adminClient
      .from("mock_tests")
      .select("id")
      .eq("slug", payload.slug)
      .maybeSingle();
    if (duplicateSlug) {
      throw new ApiError(409, "A mock test with this slug already exists.", "DUPLICATE_SLUG");
    }

    const testTypeId = payload.test_type_id || (await adminClient.from("test_types").select("id").eq("code", "mock").maybeSingle())?.data?.id;
    if (!testTypeId) {
      throw new Error("No test type configured for mock tests.");
    }

    const { data, error } = await adminClient
      .from("mock_tests")
      .insert([
        {
          test_type_id: testTypeId,
          title: payload.title,
          slug: payload.slug,
          description: payload.description || null,
          subject_id: payload.subject_id || null,
          chapter_id: payload.chapter_id || null,
          total_questions: 0,
          total_marks: 0,
          duration_minutes: payload.duration_minutes,
          passing_marks: payload.passing_marks ?? 0,
          negative_marking: payload.negative_marking,
          negative_marks_ratio: payload.negative_marks_ratio,
          shuffle_questions: payload.shuffle_questions,
          shuffle_options: payload.shuffle_options,
          is_premium: payload.is_premium,
          is_active: payload.is_active,
          is_published: payload.is_published,
          year: payload.year ?? new Date().getFullYear(),
          instructions: payload.instructions || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
