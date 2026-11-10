import { apiError } from "@/lib/api-utils";

export async function POST() {
  return apiError("Subscription checkout currently accepts manual UPI payments only.", 503, "MANUAL_UPI_REQUIRED");
}
