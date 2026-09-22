import { RotateCcw } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Refund Policy - ${APP_NAME}`,
  description: `Refund policy for ${APP_NAME}.`,
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Refund Policy</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Fair and transparent refunds.</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <RotateCcw className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Refund terms</h2>
          </div>
          <p className="text-muted-foreground">Refund eligibility depends on the subscription or purchase terms. Requests should be submitted within the refund window defined at checkout.</p>

          <h3 className="mt-6 text-lg font-semibold">Eligibility</h3>
          <p className="text-sm text-muted-foreground">Refunds are available for purchases that meet the specific policy terms (e.g., within a 7-day window for single-course purchases). Subscriptions may have prorated refunds as described at checkout.</p>

          <h3 className="mt-4 text-lg font-semibold">How to request a refund</h3>
          <ol className="list-inside list-decimal text-sm text-muted-foreground">
            <li>Contact support at support@xophal.example (demo address) with your order details.</li>
            <li>Provide a brief reason and any supporting evidence.</li>
            <li>We will review and respond within 5–10 business days.</li>
          </ol>

          <h3 className="mt-4 text-lg font-semibold">Exceptions</h3>
          <p className="text-sm text-muted-foreground">Some purchases (promotional items, gift credits) may be non-refundable. Digital content that has been fully downloaded or accessed may not be refundable.</p>
        </div>
      </section>
    </main>
  );
}
