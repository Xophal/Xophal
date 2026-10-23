import { describe, expect, it } from "vitest";
import { resolveProductPrice, validateProductScope } from "@/lib/subscription-pricing";

describe("subscription pricing", () => {
  it("uses school pricing before early-bird pricing when both are eligible", () => {
    const product: Parameters<typeof resolveProductPrice>[0] = {
      code: "seba_class_10_season_pass",
      product_type: "class_10_season_pass",
      board_code: "seba",
      class_number: 10,
      name: "SEBA Class 10 Season Pass",
      description: "Season pass",
      price_paise: 29900,
      early_bird_price_paise: 24900,
      school_price_paise: 19900,
      duration_days: 365,
    };

    const result = resolveProductPrice(product, {
      now: new Date("2026-11-10T12:00:00+05:30"),
      isSchoolEligible: true,
    });

    expect(result.pricePaise).toBe(19900);
    expect(result.appliedRule).toBe("school_pricing");
    expect(result.discountPaise).toBe(10000);
  });

  it("applies early-bird pricing during the approved window", () => {
    const product: Parameters<typeof resolveProductPrice>[0] = {
      code: "seba_class_10_season_pass",
      product_type: "class_10_season_pass",
      board_code: "seba",
      class_number: 10,
      name: "SEBA Class 10 Season Pass",
      description: "Season pass",
      price_paise: 29900,
      early_bird_price_paise: 24900,
      school_price_paise: null,
      duration_days: 365,
    };

    const result = resolveProductPrice(product, {
      now: new Date("2026-11-08T12:00:00+05:30"),
      isSchoolEligible: false,
    });

    expect(result.pricePaise).toBe(24900);
    expect(result.appliedRule).toBe("early_bird");
  });

  it("keeps the regular price outside the early-bird window", () => {
    const product: Parameters<typeof resolveProductPrice>[0] = {
      code: "seba_class_9_monthly",
      product_type: "class_9_monthly",
      board_code: "seba",
      class_number: 9,
      name: "SEBA Class 9 Monthly",
      description: "Monthly pass",
      price_paise: 14900,
      early_bird_price_paise: 12900,
      school_price_paise: null,
      duration_days: 30,
    };

    const result = resolveProductPrice(product, {
      now: new Date("2026-11-20T12:00:00+05:30"),
      isSchoolEligible: false,
    });

    expect(result.pricePaise).toBe(14900);
    expect(result.appliedRule).toBe("regular");
  });

  it("rejects unsupported board or class combinations", () => {
    expect(
      validateProductScope({
        code: "cbse_class_9_monthly",
        product_type: "class_9_monthly",
        board_code: "cbse",
        class_number: 9,
        name: "CBSE Class 9 Monthly",
        description: "Not allowed",
        price_paise: 14900,
      })
    ).toBe(false);

    expect(
      validateProductScope({
        code: "seba_class_11_monthly",
        product_type: "class_9_monthly",
        board_code: "seba",
        class_number: 11 as never,
        name: "SEBA Class 11 Monthly",
        description: "Not allowed",
        price_paise: 14900,
      })
    ).toBe(false);
  });
});
