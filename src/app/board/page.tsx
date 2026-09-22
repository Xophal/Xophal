import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, School } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Boards - ${APP_NAME}`,
  description: `Explore board, class, and subject paths for CBSE and Assam Board students on ${APP_NAME}.`,
};

const boardCards = [
  {
    name: "CBSE",
    description: "Class 9 and 10 note sets, chapter summaries, and practice tests aligned with the CBSE school system.",
    classes: ["Class 9", "Class 10"],
    subjects: ["Maths", "Science", "English", "Social Science"],
  },
  {
    name: "Assam Board (SEBA)",
    description: "Board-focused notes and tests for Assam Board students, designed around local exam preparation patterns.",
    classes: ["Class 9", "Class 10"],
    subjects: ["Maths", "Science", "English", "Assamese"],
  },
];

export default function BoardPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Boards</p>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Choose board, class, and subject.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Start with the boards we support now and build toward a wider study ecosystem for every student in India.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {boardCards.map((board) => (
            <article key={board.name} className="rounded-3xl border border-border bg-card p-7 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <School className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{board.name}</h2>
              </div>

              <p className="text-muted-foreground">{board.description}</p>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    <GraduationCap className="h-4 w-4" />
                    Classes
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {board.classes.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    <BookOpen className="h-4 w-4" />
                    Subjects
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {board.subjects.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link
                href="/notes"
                className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Explore resources <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
