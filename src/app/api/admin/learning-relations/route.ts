import { NextRequest } from "next/server";
import { z } from "zod";
import {
  ApiError,
  apiSuccess,
  assertTrustedOrigin,
  handleApiError,
  validateBody,
} from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const relationType = z.enum(["RELATED", "RECOMMENDED", "PRIMARY", "EXCLUDED"]);
const writeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert"),
    ebookId: uuid,
    mockTestId: uuid,
    relationType,
    priority: z.number().int().min(0).max(10000),
  }),
  z.object({
    action: z.literal("remove"),
    ebookId: uuid,
    mockTestId: uuid,
  }),
]);

function cleanSearch(value: string) {
  return value.trim().replace(/[%,_()]/g, " ").slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin"]);
    const query = request.nextUrl.searchParams;
    const ebookId = query.get("ebookId");
    const mockTestId = query.get("mockTestId");
    const search = cleanSearch(query.get("q") ?? "");
    if (Boolean(ebookId) === Boolean(mockTestId)) {
      throw new ApiError(400, "Provide exactly one resource id.", "INVALID_RESOURCE");
    }
    if ((ebookId && !uuid.safeParse(ebookId).success) || (mockTestId && !uuid.safeParse(mockTestId).success)) {
      throw new ApiError(400, "Resource id is invalid.", "INVALID_RESOURCE");
    }

    const admin = createAdminClient();
    if (ebookId) {
      const [{ data: rows, error }, { data: candidates, error: candidateError }] = await Promise.all([
        admin.from("ebook_mock_test_relations").select("id, mock_test_id, relation_type, priority").eq("ebook_id", ebookId).order("priority"),
        (() => {
          let candidateQuery = admin.from("mock_tests").select("id, title, slug, is_published, is_active").order("title").limit(25);
          if (search) candidateQuery = candidateQuery.ilike("title", `%${search}%`);
          return candidateQuery;
        })(),
      ]);
      if (error) throw error;
      if (candidateError) throw candidateError;
      const relationRows = rows ?? [];
      const targetIds = relationRows.map((relation) => relation.mock_test_id);
      const { data: relatedTests, error: relatedTestsError } = targetIds.length
        ? await admin.from("mock_tests").select("id, title, slug, is_published, is_active").in("id", targetIds)
        : { data: [], error: null };
      if (relatedTestsError) throw relatedTestsError;
      const allCandidates = new Map([...(relatedTests ?? []), ...(candidates ?? [])].map((item) => [item.id, item]));
      return apiSuccess({ relations: relationRows, candidates: [...allCandidates.values()] });
    }

    const [{ data: rows, error }, { data: candidates, error: candidateError }] = await Promise.all([
      admin.from("ebook_mock_test_relations").select("id, ebook_id, relation_type, priority").eq("mock_test_id", mockTestId).order("priority"),
      (() => {
        let candidateQuery = admin.from("ebook_listings").select("id, title, slug, author_name, status").eq("status", "PUBLISHED").order("title").limit(25);
        if (search) candidateQuery = candidateQuery.or(`title.ilike.%${search}%,author_name.ilike.%${search}%`);
        return candidateQuery;
      })(),
    ]);
    if (error) throw error;
    if (candidateError) throw candidateError;
    const relationRows = rows ?? [];
    const targetIds = relationRows.map((relation) => relation.ebook_id);
    const { data: relatedBooks, error: relatedBooksError } = targetIds.length
      ? await admin.from("ebook_listings").select("id, title, slug, author_name, status").in("id", targetIds)
      : { data: [], error: null };
    if (relatedBooksError) throw relatedBooksError;
    const allCandidates = new Map([...(relatedBooks ?? []), ...(candidates ?? [])].map((item) => [item.id, item]));
    return apiSuccess({ relations: relationRows, candidates: [...allCandidates.values()] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["super_admin", "admin"]);
    const input = await validateBody(writeSchema, await request.json());
    const admin = createAdminClient();

    if (input.action === "remove") {
      const { error } = await admin
        .from("ebook_mock_test_relations")
        .delete()
        .eq("ebook_id", input.ebookId)
        .eq("mock_test_id", input.mockTestId);
      if (error) throw error;
      return apiSuccess({ removed: true });
    }

    const [{ data: ebook, error: ebookError }, { data: test, error: testError }] = await Promise.all([
      admin.from("ebook_listings").select("id, exam_id, subject_id").eq("id", input.ebookId).maybeSingle(),
      admin.from("mock_tests").select("id, exam_id, subject_id").eq("id", input.mockTestId).maybeSingle(),
    ]);
    if (ebookError) throw ebookError;
    if (testError) throw testError;
    if (!ebook || !test) throw new ApiError(404, "eBook or mock test not found.", "RESOURCE_NOT_FOUND");

    const sharesTaxonomy =
      Boolean(ebook.exam_id && ebook.exam_id === test.exam_id) ||
      Boolean(ebook.subject_id && ebook.subject_id === test.subject_id);
    if (!sharesTaxonomy && input.relationType !== "PRIMARY" && input.relationType !== "EXCLUDED") {
      throw new ApiError(400, "A related recommendation must share an exam or subject. Use Primary only for an intentional override.", "UNRELATED_RESOURCES");
    }

    const relationPatch = {
      relation_type: input.relationType,
      priority: input.priority,
      updated_at: new Date().toISOString(),
    };
    const { data: existingRelation, error: lookupError } = await admin
      .from("ebook_mock_test_relations")
      .select("id")
      .eq("ebook_id", input.ebookId)
      .eq("mock_test_id", input.mockTestId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const write = existingRelation
      ? await admin.from("ebook_mock_test_relations").update(relationPatch).eq("id", existingRelation.id)
      : await admin.from("ebook_mock_test_relations").insert({
        ebook_id: input.ebookId,
        mock_test_id: input.mockTestId,
        created_by: session.user.id,
        ...relationPatch,
      });
    if (write.error) throw write.error;
    return apiSuccess({ saved: true }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
