import Link from "next/link";
import XophalLogo from "@/components/shared/xophal-logo";

export function AuthFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/50 bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-4 mb-8">
          {/* Brand Column */}
          <div className="flex flex-col gap-3">
            <XophalLogo variant="horizontal" size="sm" alt="Xophal" className="w-[170px]" />
            <p className="text-sm text-slate-600">
              Premium online learning platform for competitive exams and mock tests
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-slate-900">Quick Links</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Home
              </Link>
              <Link href="/courses" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Courses
              </Link>
              <Link href="/mock-tests" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Mock Tests
              </Link>
              <Link href="/notes" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Study Notes
              </Link>
            </nav>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-slate-900">Resources</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/help-center" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Help Center
              </Link>
              <Link href="/faq" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                FAQ
              </Link>
              <Link href="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Blog
              </Link>
              <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Contact Us
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-slate-900">Legal</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/privacy-policy" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms-and-conditions" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/cookie-policy" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Cookie Policy
              </Link>
              <Link href="/refund-policy" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Refund Policy
              </Link>
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200/50 pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Copyright */}
            <p className="text-sm text-slate-600">
              &copy; {currentYear} Xophal. All rights reserved.
            </p>

            {/* Social/Contact Links */}
            <div className="flex gap-6">
              <a 
                href="https://twitter.com" 
                aria-label="Twitter"
                className="text-slate-600 hover:text-slate-900 transition-colors"
                rel="noreferrer"
                target="_blank"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7a10.6 10.6 0 01-9.5-9.64z" />
                </svg>
              </a>
              <a 
                href="https://linkedin.com" 
                aria-label="LinkedIn"
                className="text-slate-600 hover:text-slate-900 transition-colors"
                rel="noreferrer"
                target="_blank"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a 
                href="https://facebook.com" 
                aria-label="Facebook"
                className="text-slate-600 hover:text-slate-900 transition-colors"
                rel="noreferrer"
                target="_blank"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
