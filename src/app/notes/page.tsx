import Link from "next/link";
import { ArrowRight, BookText, Download, FileText, NotebookPen } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Notes - ${APP_NAME}`,
  description: `Browse smart notes, chapter summaries, and revision material on ${APP_NAME}.`,
};

const filters = ["All", "CBSE", "SEBA", "Science", "Maths", "English"];

const notes = [
  {
    title: "Class 10 Science Quick Notes",
    board: "CBSE",
    subject: "Science",
    chapters: "Chemical Reactions, Life Processes, Light",
    format: "PDF + revision summary",
  },
  {
    title: "Class 9 Maths Formula Sheet",
    board: "CBSE",
    subject: "Mathematics",
    chapters: "Algebra, Geometry, Polynomials",
    format: "Formula guide",
  },
  {
    title: "SEBA English Grammar Notes",
    board: "SEBA",
    subject: "English",
    chapters: "Tenses, Grammar, Writing Skills",
    format: "Short notes + examples",
  },
  {
    title: "Class 10 Social Science Summary",
    board: "CBSE",
    subject: "Social Science",
    chapters: "Nationalism, Resources, Economics",
    format: "Chapter recap",
  },
  {
    title: "Class 9 Science Concept Map",
    board: "SEBA",
    subject: "Science",
    chapters: "Motion, Matter, Force, Energy",
    format: "Visual notes",
  },
  {
    title: "Board Exam Revision Pack",
    board: "CBSE + SEBA",
    subject: "All Subjects",
    chapters: "High-weight chapters and key definitions",
    format: "All-in-one revision",
  },
];

export default function NotesPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Notes</p>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Notes that help students revise faster.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Access chapter-wise summaries, formula sheets, and quick revision material designed for Class 9 and 10 board prep.
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
          {notes.map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {item.board}
                </span>
                <NotebookPen className="h-5 w-5 text-muted-foreground" />
              </div>

              <h2 className="text-xl font-bold text-foreground">{item.title}</h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <BookText className="h-4 w-4" />
                <span>{item.subject}</span>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">{item.chapters}</p>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                  <FileText className="h-4 w-4" />
                  {item.format}
                </span>
                <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Open <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] border border-border bg-gradient-to-r from-primary/10 via-background to-accent/10 p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Revision pack</p>
              <h2 className="mt-3 text-2xl font-bold text-foreground">Need quick exam-ready support?</h2>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download starter pack
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
