"use client";

import { useEffect } from "react";

export default function EbookTelemetry({
  eventName,
  ebookId,
  mockTestId,
  source,
  searchTerm,
}: {
  eventName: "ebook_page_view" | "ebook_search" | "ebook_filter_used" | "ebook_category_view" | "ebook_author_view" | "ebook_share" | "ebook_share_clicked" | "mock_test_view" | "mock_test_from_ebook" | "ebook_from_mock_test" | "author_profile_view" | "seller_profile_view" | "ebook_external_click";
  ebookId?: string;
  mockTestId?: string;
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
        mockTestId,
        source,
        metadata: searchTerm ? { searchTerm: searchTerm.slice(0, 100) } : {},
      }),
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Could not record eBook telemetry event", error);
    });
    return () => controller.abort();
  }, [ebookId, eventName, mockTestId, searchTerm, source]);

  return null;
}
