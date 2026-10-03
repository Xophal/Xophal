"use client";

import { useEffect } from "react";

type TrackerEvent = {
  eventName:
    | "ebook_mock_test_impression"
    | "mock_test_ebook_impression"
    | "mock_test_from_ebook"
    | "ebook_from_mock_test";
  ebookId?: string;
  mockTestId?: string;
  source: string;
};

type DiscoveryEventName = TrackerEvent["eventName"];

const impressionEvents = new Set<DiscoveryEventName>([
  "ebook_mock_test_impression",
  "mock_test_ebook_impression",
]);

const clickEvents = new Set<DiscoveryEventName>([
  "mock_test_from_ebook",
  "ebook_from_mock_test",
]);

function isDiscoveryEventName(value: string | undefined): value is DiscoveryEventName {
  return Boolean(value && (impressionEvents.has(value as DiscoveryEventName) || clickEvents.has(value as DiscoveryEventName)));
}

function sendEvent(event: TrackerEvent) {
  void fetch("/api/learning-discovery/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) throw new Error(`Event endpoint returned HTTP ${response.status}`);
  }).catch((error: unknown) => {
    console.error("Could not record learning discovery event", error);
  });
}

function readEvent(anchor: HTMLAnchorElement, attribute: string): TrackerEvent | null {
  const eventName = anchor.dataset[attribute];
  const ebookId = anchor.dataset.ebookId;
  const mockTestId = anchor.dataset.mockTestId;
  if (!isDiscoveryEventName(eventName) || !ebookId || !mockTestId) {
    return null;
  }

  return {
    eventName: eventName as DiscoveryEventName,
    ebookId,
    mockTestId,
    source: anchor.dataset.discoverySource ?? "learning_recommendation",
  };
}

export default function LearningDiscoveryTracker() {
  useEffect(() => {
    const impressionLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[data-discovery-impression]"),
    );
    const seenImpressions = new Set<HTMLAnchorElement>();
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLAnchorElement)) continue;
            const anchor = entry.target;
            if (seenImpressions.has(anchor)) continue;
            const event = readEvent(anchor, "discoveryImpression");
            if (!event) continue;
            seenImpressions.add(anchor);
            observer?.unobserve(anchor);
            sendEvent(event);
          }
        }, { threshold: 0.25 });

    if (observer) {
      impressionLinks.forEach((anchor) => observer.observe(anchor));
    }

    function trackRecommendationClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[data-discovery-click]");
      if (!anchor) return;
      const discoveryEvent = readEvent(anchor, "discoveryClick");
      if (discoveryEvent && clickEvents.has(discoveryEvent.eventName)) sendEvent(discoveryEvent);
    }

    document.addEventListener("click", trackRecommendationClick);
    return () => {
      observer?.disconnect();
      document.removeEventListener("click", trackRecommendationClick);
    };
  }, []);

  return null;
}
