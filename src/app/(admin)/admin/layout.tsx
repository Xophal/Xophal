import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Sidenav from "@/components/layout/sidenav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { normalizeRoleCode, requireAdminAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import StudyContentDeleteControl from "@/components/admin/StudyContentDeleteControl";

const adminNavItems = [
  // Command center
  { href: "/admin", icon: "LayoutDashboard", label: "Overview", group: "Command center" },
  { href: "/admin/analytics", icon: "BarChart3", label: "Analytics", group: "Command center" },
  { href: "/admin/reports", icon: "PieChart", label: "Reports", group: "Command center" },

  // Academics
  { href: "/admin/boards", icon: "School", label: "Boards", group: "Academics" },
  { href: "/admin/classes", icon: "GraduationCap", label: "Classes", group: "Academics" },
  { href: "/admin/subjects", icon: "BookOpen", label: "Subjects", group: "Academics" },
  { href: "/admin/chapters", icon: "ListTree", label: "Chapters", group: "Academics" },
  { href: "/admin/topics", icon: "Boxes", label: "Topics", group: "Academics" },

  // Assessments
  { href: "/admin/questions", icon: "ShieldQuestion", label: "Questions", group: "Assessments" },
  { href: "/admin/mock-tests", icon: "ClipboardList", label: "Mock tests", group: "Assessments" },
  { href: "/admin/results", icon: "Trophy", label: "Results", group: "Assessments" },

  // Content
  { href: "/admin/content", icon: "Newspaper", label: "Content hub", group: "Content" },
  { href: "/admin/blogs", icon: "PenLine", label: "Blogs", group: "Content" },
  { href: "/admin/notes", icon: "FileText", label: "Notes", group: "Content" },
  { href: "/admin/ebooks", icon: "BookOpen", label: "eBooks", group: "Content" },
  { href: "/admin/content/imports", icon: "UploadCloud", label: "Imports", group: "Content" },

  // People
  { href: "/admin/users", icon: "Users", label: "Users", group: "People" },
  { href: "/admin/admin-requests", icon: "UserCheck", label: "Admin requests", group: "People" },
  { href: "/admin/roles", icon: "ShieldCheck", label: "Roles", group: "People" },
  { href: "/admin/create-admin", icon: "UserCog", label: "Create admin", group: "People" },

  // Commerce
  { href: "/admin/payments", icon: "Wallet", label: "Payments", group: "Commerce" },
  { href: "/admin/subscriptions", icon: "CreditCard", label: "Subscriptions", group: "Commerce" },
  { href: "/admin/coupons", icon: "Ticket", label: "Coupons", group: "Commerce" },

  // Engagement
  { href: "/admin/notifications", icon: "BellRing", label: "Notifications", group: "Engagement" },

  // System
  { href: "/admin/settings", icon: "Settings", label: "Settings", group: "System" },
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
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_20%),hsl(var(--background))]">
      <Sidenav items={adminNavItems} profile={session.profile} variant="admin" />

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(15,23,42,0.68))] px-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl md:px-6">
          <Link href="/admin" className="font-semibold text-white md:hidden">
            Xophol Admin
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
                Log out
              </button>
            </form>
            <ThemeToggle />
          </div>
        </header>

        <main className="relative flex-1">
          <StudyContentDeleteControl canDelete={normalizeRoleCode(session.profile) === "super_admin"} />
          {children}
        </main>
      </div>
    </div>
  );
}
