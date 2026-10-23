import SubscriptionPlans from "@/components/subscriptions/SubscriptionPlans";

export const metadata = {
  title: "Subscriptions",
  description: "Choose a Xophol plan and manage your payment requests.",
};

export default function StudentSubscriptionsPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Subscriptions</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Choose your preparation plan</h1>
        <p className="mt-3 text-muted-foreground">
          Select a plan, pay using UPI, then submit the transaction reference for verification.
        </p>
      </header>
      <SubscriptionPlans isStudent />
    </div>
  );
}
