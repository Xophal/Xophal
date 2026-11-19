import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST as recordRefund } from "@/app/api/admin/ebook-refunds/route";

function queryResult(data: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  query.insert = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data: { id: "refund-1" }, error: null });
  return query;
}

describe("manual ebook refunds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a confirmed refund greater than the original payment", async () => {
    mocks.requireAdminRole.mockResolvedValue({ user: { id: "admin-1" } });
    const orderQuery = queryResult({ id: "order-1", gross_amount: 99, status: "VERIFIED" });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => orderQuery) });

    const response = await recordRefund(new NextRequest("http://localhost/api/admin/ebook-refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "11111111-1111-4111-8111-111111111111",
        amountMinor: 10000,
        refundReference: "UPI-RF-1",
        refundDate: "2026-11-20T00:00:00.000Z",
        reason: "Duplicate payment refund",
        status: "confirmed",
      }),
    }));

    expect(response.status).toBe(400);
  });
});
