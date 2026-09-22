import { BookOpen, FileQuestion, Trophy, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  icon?: "book" | "test" | "trophy" | "inbox";
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const icons = {
  book: BookOpen,
  test: FileQuestion,
  trophy: Trophy,
  inbox: Inbox,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
