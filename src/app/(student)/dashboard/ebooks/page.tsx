import { redirect } from "next/navigation";
import EbookSellerDashboard from "@/components/ebooks/EbookSellerDashboard";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "My eBooks | Xophol" };

export default async function MyEbooksPage() {
  const session = await requireAuth();
  if (!session) redirect("/login?redirect=%2Fdashboard%2Febooks");

  return <EbookSellerDashboard />;
}