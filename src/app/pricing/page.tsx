import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "₹0",
    description: "Perfect for exploring fundamentals and getting started.",
    features: ["Limited practice tests", "Basic analytics", "Community access"],
    cta: "Start free",
    href: "/register",
  },
  {
    name: "Premium Monthly",
    price: "₹299",
    description: "Unlock full mock tests, detailed analytics, and AI planner support.",
    features: ["Unlimited mock tests", "Detailed analytics", "AI study planner", "Previous year papers"],
    cta: "Choose monthly",
    href: "/login",
    featured: true,
  },
  {
    name: "Premium Yearly",
    price: "₹2,499",
    description: "Best value for long-term preparation with year-round access.",
    features: ["Everything in monthly", "Priority support", "Certificates", "Discounted annual access"],
    cta: "Choose yearly",
    href: "/login",
  },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Pricing</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Pick the plan that fits your prep journey.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Choose a plan to unlock more practice, richer insights, and a more personalized study experience.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.featured ? "border-primary shadow-lg" : ""}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-semibold">{plan.price}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Button asChild className="w-full">
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
