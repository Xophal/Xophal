import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Sidenav from "@/components/layout/sidenav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { requireAdminAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";

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
    <div className="flex min-h-screen bg-background">
      <Sidenav items={adminNavItems} profile={session.profile} variant="admin" />

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-white/15 bg-xophol-ink px-4 text-white shadow-md md:px-6">
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

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
