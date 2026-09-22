import { FileText } from "lucide-react";
import { APP_NAME } from "@/constants";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: `Terms & Conditions - ${APP_NAME}`,
  description: `Terms and conditions for ${APP_NAME}.`,
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Terms & Conditions</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Basic usage terms for {APP_NAME}.</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Platform usage terms</h2>
          </div>

          <p className="text-sm leading-7 text-muted-foreground">
            By using {APP_NAME}, you agree to use the platform for lawful educational purposes, maintain your account
            security, and respect other users and the platform’s content and features.
          </p>

          <h3 className="mt-6 text-lg font-semibold">1. Service purpose</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {APP_NAME} provides educational content, notes, mock tests, practice exercises, and study-support features.
            These services are intended for study and preparation, not as an official examination, government, or board
            authority.
          </p>

          <h3 className="mt-6 text-lg font-semibold">2. Account responsibility</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            You are responsible for maintaining the confidentiality of your login credentials and for the activity that takes
            place under your account. If you suspect unauthorized use, contact support immediately.
          </p>

          <h3 className="mt-6 text-lg font-semibold">3. Acceptable use</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-muted-foreground">
            <li>Use the platform for learning, revision, and practice in a lawful manner.</li>
            <li>Do not attempt to abuse, bypass, or interfere with tests, accounts, or platform access.</li>
            <li>Do not upload or share harmful, abusive, or unlawful content through the platform.</li>
          </ul>

          <h3 className="mt-6 text-lg font-semibold">4. Mock tests and results</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Mock tests are practice tools designed to help students review concepts and improve readiness. They are not the
            same as official examinations. Results may vary based on attempt conditions, question set, and preparation.
            The platform does not guarantee a particular rank, selection, admission, or score outcome.
          </p>

          <h3 className="mt-6 text-lg font-semibold">5. Content and intellectual property</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Educational material, platform design, branding, and supporting content are provided for learning use within the
            application. Unauthorised copying, redistribution, or commercial reuse is not permitted unless explicitly
            authorised by the platform owner.
          </p>

          <h3 className="mt-6 text-lg font-semibold">6. Service availability</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The platform may be updated, paused, or changed without notice. Access to features may depend on account status,
            configuration, or service availability.
          </p>

          <h3 className="mt-6 text-lg font-semibold">7. Changes to these terms</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            These terms may be changed when the platform evolves. Continued use of the site after an update indicates
            acceptance of the revised terms.
          </p>

          <h3 className="mt-6 text-lg font-semibold">8. Contact and legal placeholders</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            This app does not yet include a final legal registration, registered office, or dispute-resolution section in the
            codebase. Those details should be supplied by the business owner before full commercial deployment. Questions
            about the current terms can be sent to {SUPPORT_EMAIL}.
          </p>
        </div>
      </section>
    </main>
  );
}
