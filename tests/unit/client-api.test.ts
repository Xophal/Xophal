import { describe, expect, it } from "vitest";
import { readApiData } from "@/lib/client-api";

describe("client API errors", () => {
  it("shows safe actionable server errors instead of replacing them with a generic message", async () => {
    const response = new Response(JSON.stringify({
      success: false,
      error: "A record with that code or slug already exists. Choose a unique value.",
      code: "DUPLICATE_VALUE",
    }), { status: 409, headers: { "Content-Type": "application/json" } });

    await expect(readApiData(response, "Could not save the record."))
      .rejects.toThrow("A record with that code or slug already exists. Choose a unique value.");
  });

  it("includes the server reference ID for unexpected 500 errors", async () => {
    const response = new Response(JSON.stringify({
      success: false,
      error: "Internal server error. Please contact support with the reference ID.",
      code: "INTERNAL_ERROR",
      requestId: "e9e9cd07-6211-4290-a32d-3cdd4ffb97b2",
    }), { status: 500, headers: { "Content-Type": "application/json" } });

    await expect(readApiData(response, "Could not save the record."))
      .rejects.toThrow("reference ID e9e9cd07-6211-4290-a32d-3cdd4ffb97b2");
  });
});
