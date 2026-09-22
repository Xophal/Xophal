import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth";

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  let authorized = false;

  try {
    await requireAdminAuth();
    authorized = true;
  } catch {
    redirect("/admin/login");
  }

  return authorized ? <>{children}</> : null;
}
