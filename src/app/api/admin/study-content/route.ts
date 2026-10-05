import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { ApiError, apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DELETE_ALL_STUDY_CONTENT_CONFIRMATION,
  STUDY_CONTENT_RESOURCES,
  STUDY_CONTENT_RESOURCE_LABELS,
  type StudyContentResource,
} from "@/lib/study-content-admin";

const resourceKeys = STUDY_CONTENT_RESOURCES.map(({ key }) => key) as [
  StudyContentResource,
  ...StudyContentResource[],
];

const deleteSchema = z.object({
  scope: z.enum([...resourceKeys, "all"]),
  id: z.string().uuid().optional(),
  confirmation: z.string().optional(),
}).strict();

type StudyContentListRow = { id: string; name: string; is_active: boolean };

async function listResource(resource: StudyContentResource): Promise<StudyContentListRow[]> {
  const admin = createAdminClient();

  switch (resource) {
    case "boards": {
      const { data, error } = await admin.from("boards").select("id, name, is_active").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "classes": {
      const { data, error } = await admin.from("classes").select("id, name, is_active").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "subjects": {
      const { data, error } = await admin.from("subjects").select("id, name, is_active").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "chapters": {
      const { data, error } = await admin.from("chapters").select("id, name, is_active").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "topics": {
      const { data, error } = await admin.from("topics").select("id, name, is_active").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "questions": {
      const { data, error } = await admin.from("questions").select("id, question_text, is_active").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []).map(({ id, question_text, is_active }) => ({ id, name: question_text, is_active }));
    }
    case "mock_tests": {
      const { data, error } = await admin.from("mock_tests").select("id, title, is_active").order("title").limit(500);
      if (error) throw error;
      return (data ?? []).map(({ id, title, is_active }) => ({ id, name: title, is_active }));
    }
    case "notes": {
      const { data, error } = await admin.from("notes").select("id, title, is_active").order("title").limit(500);
      if (error) throw error;
      return (data ?? []).map(({ id, title, is_active }) => ({ id, name: title, is_active }));
    }
  }
}

async function archiveResource(resource: StudyContentResource, id?: string) {
  const admin = createAdminClient();
  const filterRows = (query: {
    eq: (column: "id", value: string) => {
      select: (columns: string) => PromiseLike<{ data: { id: string }[] | null; error: unknown; count: number | null }>;
    };
    not: (column: "id", operator: "is", value: null) => {
      select: (columns: string) => PromiseLike<{ data: { id: string }[] | null; error: unknown; count: number | null }>;
    };
  }) => id ? query.eq("id", id).select("id") : query.not("id", "is", null).select("id");

  switch (resource) {
    case "boards": {
      const result = await filterRows(admin.from("boards").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "classes": {
      const result = await filterRows(admin.from("classes").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "subjects": {
      const result = await filterRows(admin.from("subjects").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "chapters": {
      const result = await filterRows(admin.from("chapters").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "topics": {
      const result = await filterRows(admin.from("topics").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "questions": {
      const result = await filterRows(admin.from("questions").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "mock_tests": {
      const result = await filterRows(admin.from("mock_tests").update({ is_active: false, is_published: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
    case "notes": {
      const result = await filterRows(admin.from("notes").update({ is_active: false }, { count: "exact" }));
      return { data: result.data, error: result.error, count: result.count };
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin"]);
    const resource = request.nextUrl.searchParams.get("resource");
    if (!resource || !resourceKeys.includes(resource as StudyContentResource)) {
      throw new ApiError(400, "Choose a valid study-content section.", "INVALID_RESOURCE");
    }
    return apiSuccess(await listResource(resource as StudyContentResource));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin"]);
    const { scope, id, confirmation } = await validateBody(deleteSchema, await request.json());

    if (id && scope === "all") {
      throw new ApiError(400, "Choose a section before deleting an individual item.", "INVALID_SCOPE");
    }
    if (!id && !confirmation) {
      throw new ApiError(400, "Type the confirmation phrase to delete a section or all study content.", "CONFIRMATION_REQUIRED");
    }

    if (scope === "all") {
      if (id || confirmation !== DELETE_ALL_STUDY_CONTENT_CONFIRMATION) {
        throw new ApiError(400, `Type "${DELETE_ALL_STUDY_CONTENT_CONFIRMATION}" exactly to continue.`, "CONFIRMATION_MISMATCH");
      }
      const archived: Partial<Record<StudyContentResource, number>> = {};
      for (const { key } of STUDY_CONTENT_RESOURCES) {
        const result = await archiveResource(key);
        if (result.error) {
          console.error(`Failed to archive study-content section '${key}'`, result.error);
          return apiError(
            "The global archive stopped part-way through. Some sections may already have been archived; review the counts and retry.",
            500,
            "PARTIAL_STUDY_CONTENT_ARCHIVE",
            { archived }
          );
        }
        archived[key] = result.count ?? result.data?.length ?? 0;
      }
      return apiSuccess({ scope, archived });
    }

    if (!id && confirmation !== `DELETE ALL ${STUDY_CONTENT_RESOURCE_LABELS[scope as StudyContentResource].toUpperCase()}`) {
      throw new ApiError(
        400,
        `Type "DELETE ALL ${STUDY_CONTENT_RESOURCE_LABELS[scope as StudyContentResource].toUpperCase()}" exactly to continue.`,
        "CONFIRMATION_MISMATCH"
      );
    }

    const result = await archiveResource(scope as StudyContentResource, id);
    if (result.error) throw result.error;
    if (id && !result.data?.length) throw new ApiError(404, "Study-content item not found.", "NOT_FOUND");
    return apiSuccess({ scope, archived: result.count ?? result.data?.length ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
