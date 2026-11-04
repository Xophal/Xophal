import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { recordEbookRefund } from "@/lib/ebooks/orders";

describe("recordEbookRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: {
        refund_total_minor: 2500,
        gross_amount_minor: 9900,
        fully_refunded: false,
        already_recorded: false,
      },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("records the provider refund id and exact minor-unit amount for transactional accounting", async () => {
    const result = await recordEbookRefund({
      orderId: "transaction-1",
      providerRefundId: "rfnd-1",
      amountMinor: 2500,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("record_ebook_refund", {
      p_transaction_id: "transaction-1",
      p_provider_refund_id: "rfnd-1",
      p_amount_minor: 2500,
    });
    expect(result.fully_refunded).toBe(false);
  });

  it("rejects fractional and non-positive minor-unit refund amounts", async () => {
    await expect(recordEbookRefund({
      orderId: "transaction-1",
      providerRefundId: "rfnd-invalid",
      amountMinor: 12.5,
    })).rejects.toThrow("Refund amount must be a positive number of minor currency units.");
    await expect(recordEbookRefund({
      orderId: "transaction-1",
      providerRefundId: "rfnd-invalid",
      amountMinor: 0,
    })).rejects.toThrow("Refund amount must be a positive number of minor currency units.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
