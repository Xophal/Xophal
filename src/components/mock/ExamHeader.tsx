"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import TestTimer from "@/components/mock/TestTimer";
import SaveStatus, { type SaveState } from "@/components/mock/SaveStatus";

interface ExamHeaderProps {
  title: string;
  currentIndex: number;
  totalQuestions: number;
  answeredCount: number;
  expiresAt: number | null;
  saveState: SaveState;
  onExpire: () => void;
  onOpenPalette: () => void;
}

export default function ExamHeader({
  title,
  currentIndex,
  totalQuestions,
  answeredCount,
  expiresAt,
  saveState,
  onExpire,
  onOpenPalette,
}: ExamHeaderProps) {
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <header className="exam-header">
      <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-3 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/mock-tests"
            className="shrink-0 rounded-lg px-1.5 py-1 text-sm font-black tracking-[0.18em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            XOPHAL
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground" title={title}>
              {title}
            </p>
            <p className="exam-eyebrow" aria-hidden="true">
              Question {currentIndex + 1} of {totalQuestions}
            </p>
          </div>

          <SaveStatus state={saveState} className="hidden sm:inline-flex" />
          <TestTimer expiresAt={expiresAt} onExpire={onExpire} variant="header" />
        </div>

        <div className="flex items-center gap-3">
          <div
            className="exam-progress-track flex-1"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Test completion"
          >
            <div className="exam-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {answeredCount}/{totalQuestions} answered
          </span>
          <button
            type="button"
            onClick={onOpenPalette}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            Palette
          </button>
        </div>
      </div>
    </header>
  );
}
