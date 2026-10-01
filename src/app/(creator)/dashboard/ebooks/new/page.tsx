import Link from "next/link";
import { redirect } from "next/navigation";
import EbookSubmissionForm from "@/components/ebooks/EbookSubmissionForm";
import { requireAuth } from "@/lib/auth";

export default async function NewEbookPage() {
  const session = await requireAuth();
  if (!session) redirect("/login?redirect=%2Fdashboard%2Febooks%2Fnew");
  return <div className="mx-auto max-w-5xl space-y-5"><div><Link href="/dashboard/ebooks" className="text-sm font-semibold text-primary hover:underline">My eBooks</Link><h1 className="mt-2 text-2xl font-bold">Publish your eBook</h1><p className="mt-1 text-sm text-muted-foreground">Submit a free listing for admin review. The original book remains at your external destination.</p></div><EbookSubmissionForm /></div>;
}