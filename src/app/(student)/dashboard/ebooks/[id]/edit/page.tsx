import Link from "next/link";
import { redirect } from "next/navigation";
import EbookSubmissionForm from "@/components/ebooks/EbookSubmissionForm";
import { requireAuth } from "@/lib/auth";

type Props = { params: Promise<{ id: string }> };

export default async function EditEbookPage({ params }: Props) {
  const session = await requireAuth();
  if (!session) redirect("/login?redirect=%2Fdashboard%2Febooks");
  const { id } = await params;
  return <div className="mx-auto max-w-5xl space-y-5"><div><Link href="/dashboard/ebooks" className="text-sm font-semibold text-primary hover:underline">My eBooks</Link><h1 className="mt-2 text-2xl font-bold">Edit eBook listing</h1><p className="mt-1 text-sm text-muted-foreground">Updating a listing sends it back through review before it is visible again.</p></div><EbookSubmissionForm listingId={id} /></div>;
}
