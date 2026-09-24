"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import * as Icons from "lucide-react";

type NavItem = { href: string; icon: string; label: string };
type SideNavProfile = {
  full_name?: string | null;
  email?: string | null;
  current_streak?: number | null;
  roles?: { name?: string | null; code?: string | null } | { name?: string | null; code?: string | null }[] | null;
};

export function Sidenav({ items, profile, variant = "student" }: { items: NavItem[]; profile?: SideNavProfile | null; variant?: "student" | "admin" }) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);
  const profileRole = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidenav-collapsed");
      if (raw !== null) {
        const frame = window.requestAnimationFrame(() => setCollapsed(raw === "true"));
        return () => window.cancelAnimationFrame(frame);
      }
    } catch {
      // no-op
    }
  }, []);

  const toggle = () => {
    try {
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem("sidenav-collapsed", String(next));
    } catch {
      setCollapsed((v) => !v);
    }
  };

  return (
    <aside className={`relative z-10 ${collapsed ? "w-20" : "w-72"} transition-all duration-300`}>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex h-full min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(12,18,29,0.96),rgba(9,13,20,0.92))] text-slate-100 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-5">
          <div className="flex items-center overflow-hidden">
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-black tracking-[0.2em] text-white/90">XOPHAL</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{variant === "admin" ? "control room" : "student"}</div>
              </div>
            )}
          </div>

          <button
            aria-label="Toggle sidebar"
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
            const Icon = (Icons as unknown as Record<string, typeof Icons.BookOpen>)[it.icon] || Icons.BookOpen;

            return (
              <Link
                key={it.href}
                href={it.href}
                className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-[linear-gradient(90deg,rgba(16,185,129,0.2),rgba(59,130,246,0.12))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <motion.span whileHover={{ scale: 1.04 }} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-xs">
                  <Icon className="h-4 w-4" />
                </motion.span>
                {!collapsed && <span className="truncate">{it.label}</span>}
                {active && !collapsed && (
                  <motion.span layoutId="sidenav-active" className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d1fae5,#bfdbfe)] text-sm font-bold text-slate-900">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{profile?.full_name || "Student"}</p>
                  <p className="truncate text-xs text-slate-400">{profile?.email || "student@xophal.com"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-300">
                <span>{variant === "admin" ? "Access level" : "Learning streak"}</span>
                <span>{variant === "admin" ? profileRole?.name || profileRole?.code || "Admin" : `${profile?.current_streak || 0}d`}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d1fae5,#bfdbfe)] text-sm font-bold text-slate-900">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </aside>
  );
}

export default Sidenav;
