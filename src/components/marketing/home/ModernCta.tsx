"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ROUTES } from "@/constants";
import { SUPPORT_EMAIL, SUPER_ADMIN_PHONE, ADMIN_PHONE, phoneHref } from "@/lib/legal";
import { Reveal } from "./Reveal";

export default function ModernCta() {
  return (
    <section className="hx-section" aria-labelledby="cta-title">
      <div className="hx-shell">
        <Reveal>
          <div className="hx-cta">
            <Sparkles className="mx-auto h-8 w-8" aria-hidden="true" />

            <h2 id="cta-title" className="hx-cta__title mt-5">
              Your next strong score <br className="hidden sm:block" />
              starts today.
            </h2>

            <p className="hx-cta__body">
              Join thousands of Class 9 and 10 students preparing with Xophal. Free forever for the core practice
              experience.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href={ROUTES.register} className="hx-cta__btn">
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={ROUTES.tests} className="text-sm font-semibold text-white/80 hover:text-white">
                Browse practice tests
              </Link>
            </div>

            <p className="mt-10 text-sm leading-relaxed text-white/70">
              Need help? Super Admin{" "}
              <a href={phoneHref(SUPER_ADMIN_PHONE)} className="hx-cta__link">
                {SUPER_ADMIN_PHONE}
              </a>{" "}
              or{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hx-cta__link">
                {SUPPORT_EMAIL}
              </a>
              . Admin support:{" "}
              <a href={phoneHref(ADMIN_PHONE)} className="hx-cta__link">
                {ADMIN_PHONE}
              </a>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
