"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, LayoutDashboard, Target, UserRound } from "lucide-react";
import { createTranslator } from "@/lib/i18n";

const t = createTranslator("en");
const ITEMS = [
  { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
  { href: "/learn", label: t("nav.practice"), icon: BookOpen },
  { href: "/mock-tests", label: t("nav.mockTests"), icon: Target },
  { href: "/analytics", label: t("nav.performance"), icon: BarChart3 },
  { href: "/profile", label: t("nav.profile"), icon: UserRound },
];

/**
 * Primary mobile navigation for the student app. Uses existing routes only.
 */
export default function StudentBottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="exam-bottom-nav lg:hidden" aria-label={t("nav.primary")}>
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="exam-bottom-nav__item"
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
