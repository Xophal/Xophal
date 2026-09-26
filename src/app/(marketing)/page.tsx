import HeroSection from "@/components/marketing/HeroSection";
import BentoFeatures from "@/components/marketing/home/BentoFeatures";
import BoardShowcase from "@/components/marketing/home/BoardShowcase";
import HowItWorks from "@/components/marketing/home/HowItWorks";
import ModernCta from "@/components/marketing/home/ModernCta";
import StatsBand from "@/components/marketing/home/StatsBand";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: boards } = await supabase
    .from("boards")
    .select("id, code, name, slug, description")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <main className="hx-root home-page">
      <HeroSection />
      <StatsBand />
      <BoardShowcase boards={boards ?? []} />
      <BentoFeatures />
      <HowItWorks />
      <ModernCta />
    </main>
  );
}


