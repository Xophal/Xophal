import { Cookie } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Cookie Policy - ${APP_NAME}`,
  description: `Cookie policy for ${APP_NAME}.`,
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Cookie Policy</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">We use cookies to improve experience.</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Cookie className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Cookie usage</h2>
          </div>
          <p className="text-muted-foreground">{APP_NAME} uses cookies and similar technologies to remember your preferences, maintain sessions, and improve performance.</p>

          <h3 className="mt-6 text-lg font-semibold">Types of cookies</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            <li><strong>Essential:</strong> Required for authentication and secure sessions.</li>
            <li><strong>Preferences:</strong> Store language and display preferences.</li>
            <li><strong>Analytics:</strong> Collect anonymized usage data to improve the product.</li>
          </ul>

          <h3 className="mt-4 text-lg font-semibold">Managing cookies</h3>
          <p className="text-sm text-muted-foreground">You can control cookies via your browser settings. Disabling some cookies may affect the functionality of the site.</p>

          <h3 className="mt-4 text-lg font-semibold">Third-party cookies</h3>
          <p className="text-sm text-muted-foreground">Third-party providers used for analytics or payments may set their own cookies. Please refer to their privacy policies for details.</p>
        </div>
      </section>
    </main>
  );
}
