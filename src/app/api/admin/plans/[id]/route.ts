import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";

const accessLimitationsSchema = z.record(z.string(), z.unknown()).superRefine((limitations, context) => {
  const maxAttempts = limitations.max_attempts_per_test;
  if (maxAttempts !== undefined && (
    typeof maxAttempts !== "number" ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 1_000_000
  )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["max_attempts_per_test"],
      message: "Maximum attempts per test must be an integer between 1 and 1,000,000.",
    });
  }
});

const planPatchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.number().positive().max(21474836.47).optional(),
  duration_value: z.number().int().positive().optional(),
  duration_unit: z.enum(["days", "months", "years"]).optional(),
  duration_days: z.number().int().positive().optional(),
  features: z.array(z.string().max(200)).optional(),
  applicable_board_codes: z.array(z.string().trim().min(1).max(50).transform((code) => code.toLowerCase())).optional(),
  applicable_class_numbers: z.array(z.number().int().positive()).optional(),
  applicable_subject_ids: z.array(z.string().uuid()).optional(),
  included_mock_test_ids: z.array(z.string().uuid()).optional(),
  test_categories: z.array(z.string().trim().min(1).max(80)).optional(),
  access_limitations: accessLimitationsSchema.optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["admin", "super_admin", "subscription_admin"]);
    const { id } = await params;
    const payload = await validateBody(planPatchSchema, await request.json());

    const row: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.duration_value !== undefined || payload.duration_unit !== undefined) {
      const durationValue = payload.duration_value;
      const durationUnit = payload.duration_unit;
      if (durationValue === undefined || durationUnit === undefined) {
        return apiError("Update duration value and unit together.", 400, "INCOMPLETE_DURATION");
      }
      row.duration_days = payload.duration_days ?? (
        durationUnit === "days" ? durationValue : durationUnit === "months" ? durationValue * 30 : durationValue * 365
      );
    }
    if (payload.description === "") row.description = null;

    const { data, error } = await createAdminClient().from("subscription_plans").update(row).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Plan not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
