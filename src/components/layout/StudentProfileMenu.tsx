"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, CircleHelp, Languages, UserRound } from "lucide-react";
import LogoutButton from "@/components/auth/LogoutButton";
import { createTranslator, LANGUAGE_OPTIONS } from "@/lib/i18n";

const t = createTranslator("en");

export default function StudentProfileMenu({ fullName, email, avatarUrl }: { fullName: string | null; email: string | null; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = fullName?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const itemClass = "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("menu.open")}
        aria-expanded={open}
        aria-controls="student-profile-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-1.5 text-slate-700 transition hover:border-emerald-300 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 sm:gap-2 sm:pl-2"
      >
        <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-emerald-200 text-xs font-bold text-emerald-950" aria-hidden="true">
          {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="28px" unoptimized className="object-cover" /> : initials}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-medium sm:block">{fullName || "Student"}</span>
        <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div id="student-profile-menu" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-white/10 bg-slate-950 p-2 shadow-2xl">
          <div className="border-b border-white/10 px-3 py-2">
            <p className="truncate text-sm font-semibold text-white">{fullName || "Student"}</p>
            {email ? <p className="truncate text-xs text-slate-400">{email}</p> : null}
          </div>
          <nav className="py-1" aria-label={t("menu.open")}>
            <Link href="/profile" onClick={() => setOpen(false)} className={itemClass}><UserRound className="h-4 w-4" aria-hidden="true" />{t("menu.myProfile")}</Link>
            <Link href="/subjects" onClick={() => setOpen(false)} className={itemClass}>{t("menu.myExams")}</Link>
            <Link href="/settings" onClick={() => setOpen(false)} className={itemClass}>{t("menu.settings")}</Link>
            <div className="flex min-h-10 items-center justify-between px-3 text-sm text-slate-300" aria-label={`${t("menu.language")}: English`}>
              <span className="flex items-center gap-2"><Languages className="h-4 w-4" aria-hidden="true" />{t("menu.language")}</span>
              <span className="text-xs text-slate-500">{LANGUAGE_OPTIONS[0].nativeLabel}</span>
            </div>
            <Link href="/notifications" onClick={() => setOpen(false)} className={itemClass}>{t("menu.notifications")}</Link>
            <Link href="/help-center" onClick={() => setOpen(false)} className={itemClass}><CircleHelp className="h-4 w-4" aria-hidden="true" />{t("menu.help")}</Link>
          </nav>
          <div className="border-t border-white/10 pt-1">
            <LogoutButton className="h-10 w-full justify-start border-0 bg-transparent px-3 text-sm text-rose-200 shadow-none hover:bg-rose-400/10 hover:text-rose-100" />
          </div>
        </div>
      ) : null}
    </div>
  );
}