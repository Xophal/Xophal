import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, GraduationCap, Play, Sparkles, Target } from "lucide-react";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import HeroSection from "@/components/marketing/HeroSection";
import { ROUTES } from "@/constants";
import { SUPPORT_EMAIL, SUPER_ADMIN_PHONE, ADMIN_PHONE, phoneHref } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: "BookOpen",
    title: "Structured Learning",
    description: "Board → Class → Subject → Chapter → Topic hierarchy loaded dynamically from the database.",
  },
  {
    icon: "Target",
    title: "Mock Test Engine",
    description: "Chapter tests, unit tests, full syllabus mocks with negative marking, timer, and auto-save.",
  },
  {
    icon: "Brain",
    title: "AI Study Planner",
    description: "Personalized plans, weak topic detection, and smart recommendations powered by AI.",
  },
  {
    icon: "BarChart3",
    title: "Performance Analytics",
    description: "Track progress, streaks, accuracy by topic, and compare on leaderboards.",
  },
  {
    icon: "Sparkles",
    title: "Previous Year Papers",
    description: "PYQs, sample papers, and detailed solutions for exam-ready preparation.",
  },
  {
    icon: "Trophy",
    title: "Achievements & Certificates",
    description: "Earn XP, unlock badges, and download certificates for completed milestones.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: boards } = await supabase
    .from("boards")
    .select("id, code, name, slug, description")
    .eq("is_active", true)
    .order("sort_order");
  const boardList = boards ?? [];

  return (
    <main className="home-page">
      <HeroSection />

      <section id="boards" className="home-section home-board-section border-y py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="home-section-kicker">Start here</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Choose your board</h2><p className="mt-2 max-w-xl text-muted-foreground">Follow the syllabus that matches your classroom and keep every test in one place.</p></div>
            <Link href={ROUTES.learn} className="text-sm font-semibold text-primary">Explore all learning <ArrowRight className="ml-1 inline h-4 w-4" /></Link>
          </div>
          <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {boardList.length > 0 ? boardList.map((board) => (
              <Card key={board.id} className="home-board-card glass flex h-full flex-col transition-shadow hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="flex-1">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{board.name}</CardTitle>
                  <CardDescription className="text-sm">{board.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`${ROUTES.learn}?boardSlug=${encodeURIComponent(board.slug)}`}>
                      Explore {board.code.toUpperCase()} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )) : <Card className="home-empty-board glass sm:col-span-2 lg:col-span-3"><CardContent className="flex items-center gap-4 p-6"><GraduationCap className="h-7 w-7 text-primary" /><div><p className="font-semibold">Your board catalog is almost ready</p><p className="text-sm text-muted-foreground">Boards added by your administrator will appear here.</p></div></CardContent></Card>}
          </div>
        </div>
      </section>

      <section id="features" className="home-section container mx-auto px-4 py-20">
        <div className="mb-10 max-w-2xl"><p className="home-section-kicker">One focused workspace</p><h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Less hunting. More learning.</h2><p className="mt-3 text-muted-foreground">Everything you need to move from a chapter you have not started to a score you can trust.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="home-feature-card glass h-full transition-transform hover:-translate-y-1">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Icon name={feature.icon} className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="home-cta border-t py-20">
        <div className="container mx-auto px-4 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-amber-300" /><h2 className="mt-4 text-3xl font-bold text-white">Your next strong score starts today.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Need help? Contact the Super Admin at <a href={phoneHref(SUPER_ADMIN_PHONE)} className="font-semibold text-white underline">{SUPER_ADMIN_PHONE}</a> or <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-white underline">{SUPPORT_EMAIL}</a>. Admin support: <a href={phoneHref(ADMIN_PHONE)} className="font-semibold text-white underline">{ADMIN_PHONE}</a>.
          </p>
          <Button size="lg" className="mt-8 px-8 py-3" asChild>
            <Link href={ROUTES.register}>Create Free Account</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
