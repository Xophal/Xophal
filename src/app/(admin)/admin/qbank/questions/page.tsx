import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { QuestionListingClient } from "./listing-client";

export default function QuestionListingPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">Browse and manage questions across the academic catalog.</p>
        </div>
        <Button asChild>
          <Link href="/admin/questions">
            <Plus size={18} className="mr-2" />
            Create Question
          </Link>
        </Button>
      </div>
      <QuestionListingClient />
    </div>
  );
}
