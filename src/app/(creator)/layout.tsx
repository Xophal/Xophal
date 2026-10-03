import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import { isAdminRole } from "@/lib/roles";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  if (session) {
    if (!session.profile) redirect("/verify-email");
    if (isAdminRole(session.profile)) redirect("/admin");
    if (!session.profile.email_verified && !session.user.email_confirmed_at) {
      redirect("/verify-email");
    }

    try {
      assertAccess(session.profile, session.user, {
        requireAuth: true,
        requireActive: true,
        requireEmailVerified: true,
        allowRoles: ["student", "author"],
      });
    } catch {
      notFound();
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <Link href="/dashboard/ebooks" className="text-sm font-semibold text-foreground">
            Xophol eBook publishing
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/ebooks" className="text-muted-foreground hover:text-foreground">
              Browse eBooks
            </Link>
            <Link href="/account/security" className="text-muted-foreground hover:text-foreground">
              Account security
            </Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Learning dashboard
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}