import { ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/constants";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: `Privacy Policy - ${APP_NAME}`,
  description: `Privacy policy for ${APP_NAME}.`,
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Privacy Policy</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">How {APP_NAME} handles student data.</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">What this app actually collects</h2>
          </div>

          <p className="text-sm leading-7 text-muted-foreground">
            {APP_NAME} is a learning and mock-test platform. We collect only the information needed to create and maintain
            an account, provide study features, and keep the platform secure and usable.
          </p>

          <h3 className="mt-6 text-lg font-semibold">1. Account and profile information</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-muted-foreground">
            <li>Name and email address used for sign-in and account communication.</li>
            <li>Phone number if entered in profile or admin workflows.</li>
            <li>Board and class selections used to personalise learning and mock-test access.</li>
            <li>Role and account status used to manage student and admin access.</li>
          </ul>

          <h3 className="mt-6 text-lg font-semibold">2. Test and learning data</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-muted-foreground">
            <li>Test attempts, started and submitted timestamps, and timing metadata.</li>
            <li>Responses, bookmarks, review flags, and score details for result tracking.</li>
            <li>Notifications and message history related to test results, reminders, and platform updates.</li>
          </ul>

          <h3 className="mt-6 text-lg font-semibold">3. Authentication and technical data</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-muted-foreground">
            <li>Authentication data managed by Supabase Auth, including email verification and session state.</li>
            <li>Server and application logs used for reliability, security, and abuse prevention.</li>
            <li>Rate-limiting and cache data used by the platform to protect endpoints and reduce abuse.</li>
          </ul>

          <h3 className="mt-6 text-lg font-semibold">4. How the data is used</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            We use this data to sign users in, keep profiles accurate, show personalised study paths, record mock-test
            performance, send notifications, and protect the platform from misuse. This site does not sell personal
            information for advertising purposes.
          </p>

          <h3 className="mt-6 text-lg font-semibold">5. Third-party services used by the platform</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-7 text-muted-foreground">
            <li>Supabase is used for authentication, database storage, and session-related services.</li>
            <li>Upstash Redis is used for rate limiting and short-lived cache data when configured.</li>
            <li>When payment workflows are enabled, a configured payment provider such as Razorpay may process payment-related records.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            This project does not currently use a separate web analytics provider for public website analytics.
          </p>

          <h3 className="mt-6 text-lg font-semibold">6. Cookies and session handling</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            The site uses authentication cookies and session state to keep users signed in and to support secure access to
            protected pages. Browser settings can disable or restrict cookies, but some platform features may not work
            correctly without them.
          </p>

          <h3 className="mt-6 text-lg font-semibold">7. Retention and deletion</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Account and test data are stored in the application database as long as the account remains active or until an
            administrator removes records. The codebase does not currently include an automated self-service account
            deletion workflow, so deletion requests should be handled manually through support.
          </p>

          <h3 className="mt-6 text-lg font-semibold">8. Your rights and requests</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            You can review and update profile details from the account profile area. If you need help with account access,
            a data question, or a support request, contact {SUPPORT_EMAIL}. We will respond as needed and can explain the
            limits of the current implementation without promising automated deletion or bulk export features that are not
            yet built.
          </p>

          <h3 className="mt-6 text-lg font-semibold">9. Security</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            We use standard application and platform safeguards to protect user accounts and stored data. No system is
            completely immune to compromise, which is why users should use a strong password and avoid sharing credentials.
          </p>
        </div>
      </section>
    </main>
  );
}
