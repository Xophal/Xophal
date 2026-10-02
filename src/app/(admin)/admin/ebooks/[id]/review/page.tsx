import AdminEbookReview from "@/components/admin/AdminEbookReview";

export const metadata = { title: "Review eBook" };

export default async function AdminEbookReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEbookReview ebookId={id} />;
}
