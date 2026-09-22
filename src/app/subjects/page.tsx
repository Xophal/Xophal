import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Subjects - ${APP_NAME}`,
  description: `Explore subject-wise resources for Class 9 and 10 students on ${APP_NAME}.`,
};

const subjectGroups = [
  {
    className: "Class 9",
    slug: "class-9",
    subjects: [
      { name: "Science", slug: "science" },
      { name: "Maths", slug: "maths" },
      { name: "English", slug: "english" },
      { name: "Social Science", slug: "social-science" },
    ],
  },
  {
    className: "Class 10",
    slug: "class-10",
    subjects: [
      { name: "Science", slug: "science" },
      { name: "Maths", slug: "maths" },
      { name: "English", slug: "english" },
      { name: "Social Science", slug: "social-science" },
    ],
  },
];

export default function SubjectsPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Subjects</p>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Learn by class and subject.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Every subject is structured to help students move from concept understanding to notes, practice, and mock tests.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {subjectGroups.map((group) => (
            <article key={group.slug} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{group.className}</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {group.subjects.map((subject) => (
                  <Link
                    key={`${group.slug}-${subject.slug}`}
                    href={`/subjects/${group.slug}-${subject.slug}`}
                    className="rounded-2xl border border-border bg-muted/30 p-4 transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{subject.name}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
