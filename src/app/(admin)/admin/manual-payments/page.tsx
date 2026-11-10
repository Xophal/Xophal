import { redirect } from "next/navigation";
import ManualPaymentsPanel from "@/components/admin/ManualPaymentsPanel";
import { requireAdminAuth } from "@/lib/auth";
import { normalizeRoleCode } from "@/lib/roles";

const PAYMENT_PAGE_ROLES = [
  "admin",
  "super_admin",
  "payment_verifier",
  "subscription_admin",
  "refund_approver",
  "school_eligibility_reviewer",
];

export default async function ManualPaymentsPage() {
  const { profile } = await requireAdminAuth();
  const role = normalizeRoleCode(profile);
  if (!role || !PAYMENT_PAGE_ROLES.includes(role)) redirect("/admin");

  return (
    <ManualPaymentsPanel
      canConfigure={["admin", "super_admin", "subscription_admin"].includes(role)}
      canReview={["admin", "super_admin", "subscription_admin", "payment_verifier"].includes(role)}
    />
  );
}
