import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Sidenav from "@/components/layout/sidenav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { requireAdminAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";

const adminNavItems = [
  { href: "/admin", icon: "LayoutDashboard", label: "Overview" },
  { href: "/admin/boards", icon: "School", label: "Boards" },
  { href: "/admin/classes", icon: "GraduationCap", label: "Classes" },
  { href: "/admin/subjects", icon: "BookOpen", label: "Subjects" },
  { href: "/admin/chapters", icon: "ListTree", label: "Chapters & topics" },
  { href: "/admin/notes", icon: "FileText", label: "Notes" },
  { href: "/admin/mock-tests", icon: "ClipboardList", label: "Mock tests" },
  { href: "/admin/content", icon: "Newspaper", label: "Content" },
  { href: "/admin/users", icon: "Users", label: "Users" },
  { href: "/admin/admin-requests", icon: "UserCheck", label: "Admin requests" },
  { href: "/admin/analytics", icon: "BarChart3", label: "Analytics" },
  { href: "/admin/settings", icon: "Settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let session;

  try {
    session = await requireAdminAuth();
  } catch {
    redirect("/admin/login");
  }

  if (!session) return null;

  try {
    assertAccess(session.profile, session.user, {
      requireAuth: true,
      requireActive: true,
      requireEmailVerified: true,
      allowRoles: ["admin", "super_admin", "content_manager", "reviewer"],
    });
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      <Sidenav items={adminNavItems} profile={session.profile} variant="admin" />

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <Link href="/admin" className="font-semibold md:hidden">
            Xophal Admin
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                Log out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
