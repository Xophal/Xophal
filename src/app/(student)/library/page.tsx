import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import LibraryClient from "@/components/library/LibraryClient";

export const metadata = { title: "My Library | Xophol" };

export default async function LibraryPage() {
  const session = await requireAuth();
  if (!session) redirect("/login?redirect=%2Flibrary");
  return <LibraryClient />;
}
