import { FALLBACK_BOARDS, FALLBACK_CLASSES } from "@/constants";

export function isSupabaseTableMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  const maybeDetails = "details" in error ? String((error as { details?: unknown }).details ?? "") : "";
  const maybeHint = "hint" in error ? String((error as { hint?: unknown }).hint ?? "") : "";
  const aggregated = `${maybeMessage}\n${maybeDetails}\n${maybeHint}`.toLowerCase();

  return aggregated.includes("could not find the table") || aggregated.includes("pgrst205");
}

export function getFallbackBoards() {
  return [...FALLBACK_BOARDS] as Array<{
    id: string;
    code: string;
    name: string;
    slug: string;
    description?: string | null;
    logo_url?: string | null;
    is_active: boolean;
    sort_order: number;
  }>;
}

export function getFallbackClassesForBoard(boardIdOrSlug?: string | null) {
  if (!boardIdOrSlug) return [];

  const direct = FALLBACK_CLASSES[boardIdOrSlug];
  if (Array.isArray(direct) && direct.length > 0) return [...direct];

  const board = FALLBACK_BOARDS.find(
    (item) =>
      item.id === boardIdOrSlug ||
      item.slug === boardIdOrSlug ||
      item.code === boardIdOrSlug
  );

  if (!board) return [];

  return [...(FALLBACK_CLASSES[board.id] ?? [])];
}
