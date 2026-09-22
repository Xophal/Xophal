import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, GraduationCap, Play, Sparkles, Target } from "lucide-react";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, ROUTES } from "@/constants";
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
      <section className="home-hero">
        <div className="container mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-28 sm:gap-12 md:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.88fr)] md:pb-24 md:pt-36">
          <div className="home-hero-copy">
            <Badge variant="secondary" className="home-eyebrow mb-5">SEBA & CBSE preparation, made clear</Badge>
            <h1 aria-label={`Master Your Exams with ${APP_NAME}`} className="max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              Study with a plan. <span className="home-highlight">Test with purpose.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              {APP_NAME} brings your syllabus, practice tests, revision notes, and progress into one focused study space.
            </p>
            <div className="mt-8 grid max-w-md gap-3 sm:flex">
              <Button size="lg" asChild className="home-primary-action w-full px-7 sm:w-auto"><Link href={ROUTES.register}>Start free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" asChild className="home-secondary-action w-full px-7 sm:w-auto"><Link href={ROUTES.tests}><Play className="mr-2 h-4 w-4" /> Try a mock test</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {["11 question types", "Instant results", "Daily streaks"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</span>)}
            </div>
          </div>
          <div className="home-product-preview" aria-label="Xophal study dashboard preview">
            <div className="home-preview-topline"><span className="home-status-dot" />Today&apos;s study plan <span className="ml-auto text-xs text-white/60">Tuesday, 24 min</span></div>
            <div className="home-preview-heading"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Your momentum</p><p className="mt-2 text-3xl font-bold text-white">72% ready</p></div><div className="home-ring"><span>7</span><small>day streak</small></div></div>
            <div className="home-progress"><span style={{ width: "72%" }} /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="home-preview-card"><Target className="h-5 w-5 text-amber-300" /><div><p className="text-sm font-semibold text-white">Science revision</p><p className="mt-1 text-xs text-white/55">12 questions left</p></div></div><div className="home-preview-card"><BarChart3 className="h-5 w-5 text-cyan-300" /><div><p className="text-sm font-semibold text-white">Accuracy</p><p className="mt-1 text-xs text-white/55">+18% this week</p></div></div></div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center justify-between text-sm text-white/80"><span>Next up</span><Clock3 className="h-4 w-4 text-cyan-200" /></div><div className="mt-3 flex items-center justify-between"><p className="font-semibold text-white">Chemical Reactions</p><span className="text-xs text-cyan-200">15 min</span></div></div>
          </div>
        </div>
      </section>

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
            Build a consistent rhythm with structured learning, useful feedback, and practice that meets you where you are.
          </p>
          <Button size="lg" className="mt-8 px-8 py-3" asChild>
            <Link href={ROUTES.register}>Create Free Account</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
