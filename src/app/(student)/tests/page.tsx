import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock3, FileCheck2, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Mock Tests" };

const filters = ["All", "CBSE", "SEBA", "Science", "Maths", "English"];

const tests = [
  {
    id: 1,
    title: "Class 10 Science Full Test",
    board: "CBSE",
    subject: "Science",
    duration: "45 mins",
    questions: 40,
    level: "Board pattern",
  },
  {
    id: 2,
    title: "Class 9 Maths Unit Test",
    board: "CBSE",
    subject: "Mathematics",
    duration: "30 mins",
    questions: 25,
    level: "Quick practice",
  },
  {
    id: 3,
    title: "SEBA English Proficiency Test",
    board: "SEBA",
    subject: "English",
    duration: "35 mins",
    questions: 30,
    level: "Grammar + writing",
  },
  {
    id: 4,
    title: "Class 10 Social Science Revision",
    board: "CBSE",
    subject: "Social Science",
    duration: "40 mins",
    questions: 35,
    level: "Revision mode",
  },
];

export default async function StudentTestsPage() {
  redirect("/mock-tests");
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to access tests.</div>;
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Mock tests</p>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Practice better before the board exam.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Choose your board, class, and subject. Take timed tests, improve weak areas, and build exam confidence.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                filter === "All"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              ].join(" ")}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => (
            <Card key={test.id} className="h-full rounded-3xl border border-border bg-card shadow-sm">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {test.board}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{test.level}</span>
                </div>
                <CardTitle className="text-xl text-foreground">{test.title}</CardTitle>
                <CardDescription>{test.subject}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4" />
                    {test.duration}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4" />
                    {test.questions} questions
                  </span>
                </div>

                <Link
                  href="/tests"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Start test <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] border border-border bg-gradient-to-r from-primary/10 via-background to-accent/10 p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Performance focus</p>
              <h2 className="mt-3 text-2xl font-bold text-foreground">Track your weak areas after every test.</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
              <Target className="h-4 w-4 text-primary" />
              Accurate improvement insights
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
