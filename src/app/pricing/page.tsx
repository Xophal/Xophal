import SubscriptionPlans from "@/components/subscriptions/SubscriptionPlans";

export const metadata = {
  title: "Pricing",
  description: "Explore Xophol student subscription plans and pricing.",
};

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Pricing</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Pick the plan that fits your prep journey.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Compare current plans from our product catalog. Payments are verified before subscription access is activated.
        </p>
      </div>
      <SubscriptionPlans />
    </div>
  );
}
