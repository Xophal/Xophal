"use client";

import { Check, CloudUpload, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

const COPY: Record<SaveState, string> = {
  idle: "All changes saved",
  saving: "Saving…",
  saved: "Saved",
  error: "Could not save. Retrying automatically.",
};

const ICONS: Record<SaveState, typeof Check> = {
  idle: Check,
  saving: CloudUpload,
  saved: Check,
  error: TriangleAlert,
};

/**
 * Subtle, non-blocking indicator for the existing debounced autosave PATCH.
 * Announced politely so it never interrupts a student mid-question.
 */
export default function SaveStatus({
  state,
  className,
}: {
  state: SaveState;
  className?: string;
}) {
  if (state === "idle") return null;

  const Icon = ICONS[state];

  return (
    <p
      className={cn("exam-save-status", className)}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className="exam-save-dot" aria-hidden="true" />
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{COPY[state]}</span>
    </p>
  );
}
