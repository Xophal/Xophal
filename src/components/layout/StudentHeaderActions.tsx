"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/layout/NotificationBell";

export default function StudentHeaderActions() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/mock-tests?search=${encodeURIComponent(value)}` : "/mock-tests");
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!searchOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  return (
    <div className="relative flex items-center gap-2 md:gap-3">
      {searchOpen ? (
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <label htmlFor="student-global-search" className="sr-only">Search mock tests</label>
          <input id="student-global-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mock tests" className="h-10 w-40 rounded-full border border-slate-200 bg-white/80 px-4 text-sm text-slate-900 outline-none ring-emerald-400 placeholder:text-slate-500 focus:ring-2 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:placeholder:text-slate-400 sm:w-56" />
          <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"><X className="h-4 w-4" /></button>
        </form>
      ) : (
        <button type="button" aria-label="Search mock tests" onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"><Search className="h-4 w-4" /></button>
      )}
      <NotificationBell />
    </div>
  );
}