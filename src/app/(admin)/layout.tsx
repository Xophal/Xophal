import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/auth";

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  let authorized = false;

  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    authorized = true;
  } catch {
    redirect("/admin/login");
  }

  return authorized ? <>{children}</> : null;
}
