import { apiError } from "@/lib/api-utils";

export async function POST() {
  return apiError("This endpoint no longer saves content. Use the authenticated admin content API.", 410, "ENDPOINT_RETIRED");
}
