import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Facebook,
  FileText,
  HelpCircle,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import BrandWordmark from "@/components/brand/BrandWordmark";
import { APP_NAME } from "@/constants";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPER_ADMIN_EMAIL, ADMIN_EMAIL, ADMIN_PHONE, phoneHref } from "@/lib/legal";

const SOCIALS = [
  { name: "Telegram", href: "https://t.me/xopholstudent", icon: MessageCircle },
  { name: "Instagram", href: "https://www.instagram.com/xopholofficial", icon: Instagram },
  { name: "Facebook", href: "https://www.facebook.com/share/195Xu881nV/", icon: Facebook },
];

const learningLinks = [
  { label: "Home", href: "/" },
  { label: "Courses", href: "/courses" },
  { label: "Subjects", href: "/subjects" },
  { label: "Notes", href: "/notes" },
  { label: "Mock Tests", href: "/mock-tests" },
  { label: "eBooks", href: "/ebooks" },
  { label: "PYQ Papers", href: "/previous-year-papers" },
];

const companyLinks = [
  { label: "About Us", href: "/about" },
  { label: "Board Prep", href: "/board" },
  { label: "FAQ", href: "/faq" },
  { label: "Help Center", href: "/help-center" },
  { label: "Contact", href: "/contact" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy", icon: ShieldCheck },
  { label: "Terms & Conditions", href: "/terms-and-conditions", icon: FileText },
  { label: "Cookie Policy", href: "/cookie-policy", icon: ShieldCheck },
  { label: "Help Center", href: "/help-center", icon: HelpCircle },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/15 bg-xophol-ink text-slate-50">

      <div className="container relative mx-auto px-4 py-12 md:py-16">
          <div className="border-b border-white/15 pb-8 md:pb-10">
          <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Smart learning ecosystem
              </div>
              <h3 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
                Study smarter with structured learning, tests, and past papers.
              </h3>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-200">
              {[
                "Board prep",
                "Mock tests",
                "PYQ practice",
                "Revision notes",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
            <div className="space-y-5">
              <BrandWordmark inverse />

              <p className="max-w-sm text-sm leading-6 text-slate-300">
                Empowering students with focused boards, revision notes, mock test practice,
                and previous year question mastery for better exam performance.
              </p>

              <div className="flex items-center gap-3">
                {SOCIALS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.name}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.name}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition duration-200 hover:border-xophol-orange/60 hover:bg-xophol-blue hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>

              <Link
                href="/mock-tests"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-xophol-orange px-4 py-2 text-sm font-semibold text-xophol-ink transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Start practice
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">Explore</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                {learningLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="inline-flex items-center gap-2 transition hover:text-white">
                      <BookOpen className="h-3.5 w-3.5 text-xophol-orange" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">Company</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">Legal</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                {legalLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.label}>
                      <Link href={link.href} className="inline-flex items-center gap-2 transition hover:text-white">
                        <Icon className="h-3.5 w-3.5 text-xophol-orange" />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">Support</h4>
              <div className="space-y-3 text-sm text-slate-300">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 transition hover:text-white">
                  <Mail className="h-4 w-4 text-xophol-orange" />
                  {SUPPORT_EMAIL}
                </a>
                <a href={phoneHref(SUPPORT_PHONE)} className="inline-flex items-center gap-2 transition hover:text-white">
                  <Phone className="h-4 w-4 text-xophol-orange" />
                  {SUPPORT_PHONE}
                </a>
                <a href={phoneHref(ADMIN_PHONE)} className="inline-flex items-center gap-2 transition hover:text-white">
                  <Phone className="h-4 w-4 text-xophol-orange" />
                  Admin: {ADMIN_PHONE}
                </a>
                <a href={`mailto:${SUPER_ADMIN_EMAIL}`} className="inline-flex items-center gap-2 transition hover:text-white">
                  <Mail className="h-4 w-4 text-xophol-orange" />
                  Super Admin: {SUPER_ADMIN_EMAIL}
                </a>
                <a href={`mailto:${ADMIN_EMAIL}`} className="inline-flex items-center gap-2 transition hover:text-white">
                  <Mail className="h-4 w-4 text-xophol-orange" />
                  Admin: {ADMIN_EMAIL}
                </a>
                <div className="pt-1 text-xs text-slate-400">Jorhat, Assam, India</div>
                <div className="flex items-center gap-2 pt-1">
                  <Trophy className="h-4 w-4 text-amber-300" />
                  <span className="text-slate-200">Exam-ready guidance for every stage</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-slate-400 md:flex-row">
          <div>© 2026 {APP_NAME}. All rights reserved.</div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            Study smarter, not harder.
          </div>
        </div>
      </div>
    </footer>
  );
}
