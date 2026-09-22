import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view bookmarks.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Bookmarks</h1>
        <p className="mt-2 text-sm text-muted-foreground">Keep track of saved lessons, notes, and study resources.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No bookmarks saved</CardTitle>
          <CardDescription>Saved items will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            You haven&apos;t saved anything yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
