import { describe, expect, it } from "vitest";
import { sanitizeContactInput, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/legal";

describe("legal and support helpers", () => {
  it("strips script content and trims unsafe whitespace from contact messages", () => {
    const value = "  <script>alert('x')</script> Hello there   ";

    expect(sanitizeContactInput(value, 140)).toBe("Hello there");
  });

  it("exposes a real support contact and phone number for the deployed app", () => {
    expect(SUPPORT_EMAIL).toBe("support@xophal.in");
    expect(SUPPORT_PHONE).toBe("+91 98765 43210");
  });
});
