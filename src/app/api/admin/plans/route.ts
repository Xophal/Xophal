import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

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

const planSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.number().positive().max(21474836.47),
  currency: z.literal("INR").optional().default("INR"),
  duration_value: z.number().int().positive().optional().default(30),
  duration_unit: z.enum(["days", "months", "years"]).optional().default("days"),
  duration_days: z.number().int().positive().optional(),
  features: z.array(z.string().max(200)).optional().default([]),
  applicable_board_codes: z.array(z.string().trim().min(1).max(50).transform((code) => code.toLowerCase())).optional().default([]),
  applicable_class_numbers: z.array(z.number().int().positive()).optional().default([]),
  applicable_subject_ids: z.array(z.string().uuid()).optional().default([]),
  included_mock_test_ids: z.array(z.string().uuid()).optional().default([]),
  test_categories: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  access_limitations: accessLimitationsSchema.optional().default({}),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    await requireAdminRole(["admin", "super_admin", "subscription_admin"]);
    const { data, error } = await createAdminClient()
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRole(["admin", "super_admin", "subscription_admin"]);
    const payload = await validateBody(planSchema, await request.json());
    const durationDays = payload.duration_days ?? (
      payload.duration_unit === "days"
        ? payload.duration_value
        : payload.duration_unit === "months"
          ? payload.duration_value * 30
          : payload.duration_value * 365
    );
    const { data, error } = await createAdminClient()
      .from("subscription_plans")
      .insert([
        {
          ...payload,
          duration_days: durationDays,
          description: payload.description || null,
          features: payload.features,
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
