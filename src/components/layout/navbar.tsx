"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, ShieldCheck, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/constants";
import NotificationBell from "@/components/layout/NotificationBell";
import { createClient } from "@/lib/supabase/client";

type SessionUser = { id: string; email?: string; full_name?: string | null };
type AuthState = { user: SessionUser | null; isAdmin: boolean };
type AuthResponse = { success: boolean; data?: AuthState };

const publicLinks = [
  { label: "Home", href: "/" },
  { label: "Tests", href: "/mock-tests" },
  { label: "Features", href: "/#features" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { signal: controller.signal, cache: "no-store" });
        const payload = (await response.json()) as AuthResponse;
        setAuth(payload.success && payload.data ? payload.data : { user: null, isAdmin: false });
      } catch {
        if (!controller.signal.aborted) setAuth({ user: null, isAdmin: false });
      }
    }
    loadAuth();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // fallback to client sign out if server route fails
      try {
        await createClient().auth.signOut();
      } catch {}
    }
    setAuth({ user: null, isAdmin: false });
    setProfileOpen(false);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const userName = auth?.user?.full_name || auth?.user?.email || "Account";
  const navLinkClass = (href: string) => [
    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive(pathname, href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
  ].join(" ");

  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 px-3 py-3 sm:px-4" data-testid="site-header">
      <nav aria-label="Primary navigation" className="site-navbar mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 py-2 shadow-lg shadow-primary/5 glass-panel sm:px-4">
          <Link href="/" className="flex min-h-10 shrink-0 items-center rounded-md px-2 text-base font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${APP_NAME} home`}>
            {APP_NAME}
          </Link>

        <div className="hidden items-center gap-1 md:flex">{publicLinks.map((link) => <Link key={link.href} href={link.href} aria-current={isActive(pathname, link.href) ? "page" : undefined} className={navLinkClass(link.href)}>{link.label}</Link>)}{auth?.user && <Link href="/dashboard" aria-current={isActive(pathname, "/dashboard") ? "page" : undefined} className={navLinkClass("/dashboard")}>Dashboard</Link>}{auth?.user && auth.isAdmin && <Link href="/admin" aria-current={isActive(pathname, "/admin") ? "page" : undefined} className={navLinkClass("/admin")}>Admin Dashboard</Link>}</div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell />
          {auth === null ? <div aria-label="Checking account status" className="h-10 w-24 animate-pulse rounded-md bg-muted" /> : auth.user ? (
            <div ref={profileMenuRef} className="relative"><button type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((open) => !open)} className="inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></span><span className="max-w-32 truncate">{userName}</span></button>{profileOpen && <div role="menu" className="absolute right-0 mt-2 w-52 rounded-xl border bg-card p-1 shadow-lg"><Link role="menuitem" href="/profile" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><User className="h-4 w-4" />Profile</Link>{auth.isAdmin && <Link role="menuitem" href="/admin" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ShieldCheck className="h-4 w-4" />Admin Dashboard</Link>}<button role="menuitem" type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><LogOut className="h-4 w-4" />Log out</button></div>}</div>
          ) : <><Link href="/login" className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Login</Link><Link href="/register" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Sign Up</Link></>}
        </div>

        <button type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className="site-menu-button inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </nav>

      {menuOpen && (
        <div id="mobile-navigation" className="site-mobile-navigation mx-auto mt-2 max-w-7xl rounded-2xl border border-border bg-card p-3 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                className={navLinkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}

            {auth?.user && (
              <>
                <Link href="/dashboard" className={navLinkClass("/dashboard")}>Dashboard</Link>
                <Link href="/profile" className={navLinkClass("/profile")}>Profile</Link>
                {auth.isAdmin && <Link href="/admin" className={navLinkClass("/admin")}>Admin Dashboard</Link>}
                <button type="button" onClick={logout} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <LogOut className="h-4 w-4" />Log out
                </button>
              </>
            )}

            {auth === null && <div className="h-11 animate-pulse rounded-md bg-muted" aria-label="Checking account status" />}

            {auth && !auth.user && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3">
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-md border font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Login</Link>
                <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
