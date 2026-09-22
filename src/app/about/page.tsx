import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Sparkles } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `About ${APP_NAME}`,
  description: `Discover the mission and vision behind ${APP_NAME}.`,
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20 lg:px-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">About Xophal</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Empowering every learner with smart, affordable education.</h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            {APP_NAME} brings together live-ready learning content, practice questions, mock tests, notes, and AI-guided study tools in one modern platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <Brain className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-xl font-semibold">AI-powered learning</h2>
            <p className="text-sm text-muted-foreground">Structured study paths, practice sets, and intelligent insights help students learn faster.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <BookOpen className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-xl font-semibold">Board-ready content</h2>
            <p className="text-sm text-muted-foreground">SEBA, CBSE, and future boards are supported through a dynamic content system.</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <Sparkles className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-xl font-semibold">Accessible everywhere</h2>
            <p className="text-sm text-muted-foreground">Mobile-first design keeps learning smooth on every device.</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-primary/5 p-8">
          <h2 className="mb-3 text-2xl font-semibold">Our mission</h2>
          <p className="text-muted-foreground">
            To make high-quality exam preparation affordable, accessible, and modern for students across India.
          </p>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Contact the team <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
