"use client";

import { useEffect } from "react";

export default function EbookTelemetry({
  eventName,
  ebookId,
  source,
  searchTerm,
}: {
  eventName: "ebook_view" | "ebook_search" | "mock_test_from_ebook" | "author_profile_view";
  ebookId?: string;
  source?: string;
  searchTerm?: string;
}) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/ebooks/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        eventName,
        ebookId,
        source,
        metadata: searchTerm ? { searchTerm: searchTerm.slice(0, 100) } : {},
      }),
    }).catch(() => undefined);
    return () => controller.abort();
  }, [ebookId, eventName, searchTerm, source]);

  return null;
}
