import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { buildLearnPath } from "@/lib/learning";

export const metadata = { title: "Learn" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await requireAuth();
  if (!session?.profile) {
    return null;
  }

  const params = await searchParams;
  const boardSlug = typeof params.boardSlug === "string" ? params.boardSlug : null;
  const classSlug = typeof params.classSlug === "string" ? params.classSlug : null;
  const subjectSlug = typeof params.subjectSlug === "string" ? params.subjectSlug : null;
  const chapterSlug = typeof params.chapterSlug === "string" ? params.chapterSlug : null;

  const supabase = await createClient();
  const { data: boards } = await supabase
    .from("boards")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order");

  if (!boards?.length) notFound();

  const selectedBoard = boards.find((board) => board.slug === boardSlug) ?? boards[0];

  const { data: classes } = await supabase
    .from("classes")
    .select("id, slug, name")
    .eq("board_id", selectedBoard.id)
    .eq("is_active", true)
    .order("sort_order");

  const selectedClass = classes?.find((item) => item.slug === classSlug) ?? classes?.[0];

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, slug, name, description")
    .eq("class_id", selectedClass?.id ?? "")
    .eq("is_active", true)
    .order("sort_order");

  const selectedSubject = subjects?.find((item) => item.slug === subjectSlug) ?? subjects?.[0];

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, slug, name, chapter_number")
    .eq("subject_id", selectedSubject?.id ?? "")
    .eq("is_active", true)
    .order("sort_order");

  const selectedChapter = chapters?.find((item) => item.slug === chapterSlug) ?? chapters?.[0];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">Learning Hub</p>
          <h1 className="text-3xl font-bold">Choose your path and start learning</h1>
          <p className="mt-2 text-muted-foreground">Browse SEBA and CBSE content dynamically from the database.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/study-planner">Generate AI study plan</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Learning catalog
            </CardTitle>
            <CardDescription>Select a board, class, subject, and chapter to continue learning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {boards.map((board) => (
                <Link key={board.id} href={buildLearnPath({ boardSlug: board.slug, classSlug: selectedClass?.slug, subjectSlug: selectedSubject?.slug, chapterSlug: selectedChapter?.slug })} className={`rounded-full border px-3 py-1 text-sm ${selectedBoard.slug === board.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {board.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {classes?.map((item) => (
                <Link key={item.id} href={buildLearnPath({ boardSlug: selectedBoard.slug, classSlug: item.slug, subjectSlug: selectedSubject?.slug, chapterSlug: selectedChapter?.slug })} className={`rounded-full border px-3 py-1 text-sm ${selectedClass?.slug === item.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {subjects?.map((item) => (
                <Link key={item.id} href={buildLearnPath({ boardSlug: selectedBoard.slug, classSlug: selectedClass?.slug, subjectSlug: item.slug, chapterSlug: selectedChapter?.slug })} className={`rounded-full border px-3 py-1 text-sm ${selectedSubject?.slug === item.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {chapters?.map((item) => (
                <Link key={item.id} href={buildLearnPath({ boardSlug: selectedBoard.slug, classSlug: selectedClass?.slug, subjectSlug: selectedSubject?.slug, chapterSlug: item.slug })} className={`rounded-full border px-3 py-1 text-sm ${selectedChapter?.slug === item.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {item.chapter_number ? `${item.chapter_number}. ` : ""}{item.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Ready to learn
            </CardTitle>
            <CardDescription>Continue with your current selection or jump into practice tests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                Current focus
              </div>
              <p className="mt-2 font-semibold">{selectedBoard?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedClass?.name} • {selectedSubject?.name} • {selectedChapter?.name}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/tests">Start a mock test</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
