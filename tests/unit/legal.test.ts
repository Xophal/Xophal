import { describe, expect, it } from "vitest";
import { sanitizeContactInput, SUPPORT_ADDRESS, SUPPORT_EMAIL, SUPPORT_PHONE, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PHONE, CONTACT_DETAILS, phoneHref } from "@/lib/legal";

describe("legal and support helpers", () => {
  it("strips script content and trims unsafe whitespace from contact messages", () => {
    const value = "  <script>alert('x')</script> Hello there   ";

    expect(sanitizeContactInput(value, 140)).toBe("Hello there");
  });

  it("exposes the deployed company and administrator contacts", () => {
    expect(SUPPORT_EMAIL).toBe("xophal123@gmail.com");
    expect(SUPPORT_PHONE).toBe(SUPER_ADMIN_PHONE);
    expect(SUPPORT_ADDRESS).toBe("Jorhat, Assam, India");
    expect(SUPER_ADMIN_EMAIL).toBe("borahjayanta840@gmail.com");
    expect(ADMIN_EMAIL).toBe("biplopdasofficial1999@gmail.com");
    expect(CONTACT_DETAILS).toHaveLength(2);
    expect(phoneHref(SUPER_ADMIN_PHONE)).toBe("tel:+918876886919");
  });
});
