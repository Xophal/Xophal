import Link from "next/link";
import { BookOpen, Facebook, Instagram, Mail, MessageCircle, Phone, ShieldCheck, FileText, HelpCircle } from "lucide-react";
import { APP_NAME, ROUTES } from "@/constants";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/legal";

const SOCIALS = [
  { name: "Telegram", href: "https://t.me/xopholstudent", icon: MessageCircle },
  { name: "Instagram", href: "https://www.instagram.com/xopholofficial", icon: Instagram },
  { name: "Facebook", href: "https://www.facebook.com/share/195Xu881nV/", icon: Facebook },
];

export function Footer() {
  return (
    <footer className="border-t bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="h-4 w-4" />
              </div>
              {APP_NAME}
            </div>
            <p className="text-sm text-muted-foreground">Empowering students through smart learning and mock practice.</p>
            <p className="text-sm text-muted-foreground">Learn • Practice • Improve</p>

            <div className="mt-3 flex items-center gap-3">
              {SOCIALS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.name}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-transparent text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li><Link href="/mock-tests" className="hover:text-foreground">Mock Tests</Link></li>
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Legal & Help</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy-policy" className="inline-flex items-center gap-2 hover:text-foreground"><ShieldCheck className="h-3.5 w-3.5" />Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions" className="inline-flex items-center gap-2 hover:text-foreground"><FileText className="h-3.5 w-3.5" />Terms</Link></li>
              <li><Link href="/cookie-policy" className="inline-flex items-center gap-2 hover:text-foreground"><ShieldCheck className="h-3.5 w-3.5" />Cookies</Link></li>
              <li><Link href="/help-center" className="inline-flex items-center gap-2 hover:text-foreground"><HelpCircle className="h-3.5 w-3.5" />Help Center</Link></li>
              <li><Link href="/faq" className="inline-flex items-center gap-2 hover:text-foreground"><HelpCircle className="h-3.5 w-3.5" />FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Support</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Mail className="h-4 w-4" />
                {SUPPORT_EMAIL}
              </a>
              <div className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {SUPPORT_PHONE}
              </div>
              <Link href="/contact" className="inline-flex items-center gap-2 hover:text-foreground">
                Contact page
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row">
          <div className="text-sm text-muted-foreground">© 2026 {APP_NAME}. All rights reserved.</div>
          <div className="text-sm text-muted-foreground">Study smarter, not harder.</div>
        </div>
      </div>
    </footer>
  );
}
