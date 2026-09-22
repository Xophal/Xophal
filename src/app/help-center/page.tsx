import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { APP_NAME } from "@/constants";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: `Help Center - ${APP_NAME}`,
  description: `Help center and support resources for ${APP_NAME}.`,
};

const helpSections = [
  {
    title: "Creating an account",
    description: "Use the Sign up page to create a student account with name, email, password, and board/class selection if available.",
  },
  {
    title: "Logging in",
    description: "Use the Log in page with your registered email and password. If you are not signed in, protected student sections redirect you to the login flow.",
  },
  {
    title: "Finding mock tests",
    description: "From the student area, open the tests section to browse available mock tests by board, class, and subject.",
  },
  {
    title: "Starting a test",
    description: "Choose a test card, open it, and follow the on-screen timer and instructions. The timer is enforced during the attempt.",
  },
  {
    title: "Submitting and viewing results",
    description: "When you finish a test, submit it to record the result. Results and summary data are shown in the student analytics flow.",
  },
  {
    title: "Notifications and profile",
    description: "Notification alerts and profile settings are available after sign-in through the account menu and notification panel.",
  },
];

export default function HelpCenterPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="mb-10 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Help Center</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Support for every step of your study journey.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Use the guidance below for the platform features that exist in the current app.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Need help?</h2>
          </div>

          <p className="text-sm leading-7 text-muted-foreground">
            For account questions, technical issues, or platform support requests, email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">{SUPPORT_EMAIL}</a>.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {helpSections.map((item) => (
              <article key={item.title} className="rounded-2xl border bg-muted/30 p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Contact support
            </Link>
            <Link href="/faq" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              Read FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
