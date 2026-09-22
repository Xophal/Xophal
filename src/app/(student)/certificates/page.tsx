import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view certificates.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Certificates</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your verified course and assessment certificates appear here.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No certificates yet</CardTitle>
          <CardDescription>Complete lessons and mock tests to unlock downloadable certificates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            You have not earned any certificates yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
