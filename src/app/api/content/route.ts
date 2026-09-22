import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { validateContentSubmission } from "@/lib/content";
import { z } from "zod";

const contentSubmissionSchema = z.object({
  type: z.string().min(1, "Content type is required"),
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Content body is required"),
  status: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = await validateBody(contentSubmissionSchema, body);
    const record = validateContentSubmission({
      ...payload,
      tags: payload.tags ?? [],
    });

    return apiSuccess({
      record: {
        id: `content-${Date.now()}`,
        type: record.type,
        title: record.title,
        slug: record.slug,
        status: record.status,
        createdAt: "Just now",
      },
      message: "Content draft saved successfully.",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      return apiError(error.message, 400, "VALIDATION_ERROR");
    }
    return handleApiError(error);
  }
}
