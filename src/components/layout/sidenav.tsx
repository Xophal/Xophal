"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import BrandWordmark from "@/components/brand/BrandWordmark";

type NavItem = { href: string; icon: string; label: string; group?: string };
type SideNavProfile = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  current_streak?: number | null;
  roles?: { name?: string | null; code?: string | null } | { name?: string | null; code?: string | null }[] | null;
};

export function Sidenav({ items, profile, variant = "student" }: { items: NavItem[]; profile?: SideNavProfile | null; variant?: "student" | "admin" }) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);
  const [currentHash, setCurrentHash] = useState("");
  const reduceMotion = useReducedMotion();
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

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
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
    <aside className={`relative z-10 ${collapsed ? "w-20" : "w-72"} transition-[width] duration-300 motion-reduce:transition-none`}>
      <motion.div
        initial={{ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.3 }}
        className="flex h-full min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(11,76,194,0.16),transparent_28%),linear-gradient(180deg,rgba(16,38,77,0.99),rgba(7,22,48,0.98))] text-slate-100 shadow-[0_24px_60px_rgba(16,38,77,0.22)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:px-5">
          <div className="flex items-center overflow-hidden">
            {!collapsed && (
              <div className="min-w-0">
                <BrandWordmark inverse />
                <div className="mt-1 text-[10px] uppercase text-slate-300">{variant === "admin" ? "Control room" : "Student"}</div>
              </div>
            )}
            {collapsed ? <BrandWordmark variant="compact" inverse /> : null}
          </div>

          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={toggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-200 transition hover:border-xophol-orange/60 hover:bg-xophol-blue/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xophol-orange focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((it, index) => {
            const [itemPath, itemHash] = it.href.split("#");
            const hasActiveSection = items.some((item) => {
              const [path, hash] = item.href.split("#");
              return Boolean(hash && path === pathname && currentHash === `#${hash}`);
            });
            const active = itemHash
              ? pathname === itemPath && currentHash === `#${itemHash}`
              : it.href === "/admin"
                ? pathname === it.href
                : (pathname === it.href || pathname.startsWith(`${it.href}/`)) && !(it.href === "/dashboard" && hasActiveSection);
            const Icon = (Icons as unknown as Record<string, typeof Icons.BookOpen>)[it.icon] || Icons.BookOpen;
            const showGroup = Boolean(it.group) && (index === 0 || items[index - 1].group !== it.group);

            return (
              <div key={it.href}>
                {showGroup && !collapsed && (
                  <p className="mt-4 mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 first:mt-0">
                    {it.group}
                  </p>
                )}
                <Link
                  href={it.href}
                  className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-[linear-gradient(90deg,rgba(11,76,194,0.38),rgba(255,138,0,0.14))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(11,76,194,0.2)]"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <motion.span whileHover={{ scale: 1.04 }} className={`flex h-8 w-8 items-center justify-center rounded-md text-xs ${active ? "bg-[linear-gradient(135deg,rgba(11,76,194,0.62),rgba(255,138,0,0.26))] text-white" : "bg-white/5"}`}>
                    <Icon className="h-4 w-4" />
                  </motion.span>
                  {!collapsed && <span className="truncate">{it.label}</span>}
                  {active && !collapsed && (
                    <motion.span layoutId="sidenav-active" className="ml-auto h-2.5 w-2.5 rounded-full bg-xophol-orange" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.8),rgba(30,41,59,0.7))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-xophol-lightBlue text-sm font-bold text-xophol-blue">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt="" fill sizes="44px" unoptimized className="object-cover" />
                  ) : profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{profile?.full_name || "Student"}</p>
                  <p className="truncate text-xs text-slate-400">{profile?.email || "student@xophol.com"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md border border-xophol-orange/25 bg-xophol-orange/10 px-2 py-1.5 text-[11px] font-medium text-orange-200">
                <span>{variant === "admin" ? "Access level" : "Learning streak"}</span>
                <span>{variant === "admin" ? profileRole?.name || profileRole?.code || "Admin" : `${profile?.current_streak || 0}d`}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-xophol-lightBlue text-sm font-bold text-xophol-blue">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt="" fill sizes="40px" unoptimized className="object-cover" />
                ) : profile?.full_name?.charAt(0)?.toUpperCase() || "S"}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </aside>
  );
}

export default Sidenav;
