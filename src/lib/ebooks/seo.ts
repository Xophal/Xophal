import type { Metadata } from "next";
import { APP_NAME, APP_URL } from "@/constants";

const MAX_TITLE_LENGTH = 58;
const MAX_DESCRIPTION_LENGTH = 155;
const FALLBACK_IMAGE_PATH = "/opengraph-image";

export function getAppUrl(path: string) {
  const base = `${APP_URL.replace(/\/+$/, "")}/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

export function getSubjectPagePath(boardSlug: string, classSlug: string, subjectSlug: string) {
  return `/ebooks/subject/${encodeURIComponent(boardSlug)}/${encodeURIComponent(classSlug)}/${encodeURIComponent(subjectSlug)}`;
}

export function getPublicImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  try {
    const candidate = new URL(imageUrl, getAppUrl("/"));
    const secureProtocol = candidate.protocol === "https:" ||
      (new URL(APP_URL).protocol === "http:" && candidate.protocol === "http:");
    if (secureProtocol && !candidate.username && !candidate.password) {
      return candidate.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function getImageSource(imageUrl?: string | null) {
  const safeUrl = getPublicImageUrl(imageUrl);
  if (!safeUrl) return FALLBACK_IMAGE_PATH;
  const candidate = new URL(safeUrl);
  return candidate.origin === new URL(APP_URL).origin
    ? `${candidate.pathname}${candidate.search}${candidate.hash}`
    : safeUrl;
}

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const prefix = normalized.slice(0, limit - 1).replace(/\s+\S*$/, "").trim();
  return `${prefix || normalized.slice(0, limit - 1).trim()}…`;
}

export function getSeoTitle(value: string) {
  return truncate(value, MAX_TITLE_LENGTH);
}

export function getPublicSocialImage(imageUrl?: string | null) {
  return getPublicImageUrl(imageUrl) ?? getAppUrl(FALLBACK_IMAGE_PATH);
}

export function getEbookMetadata(input: {
  title: string;
  slug: string;
  authorName: string;
  description?: string | null;
  exam?: string | null;
  subject?: string | null;
  language?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
}): Metadata {
  const context = input.exam || input.subject || input.category;
  const titleWithoutBrandSuffix = input.title.replace(/\s*[|—–]\s*xophol\s*$/i, "").trim();
  const title = getSeoTitle(
    context && !titleWithoutBrandSuffix.toLocaleLowerCase().includes(context.toLocaleLowerCase())
      ? `${titleWithoutBrandSuffix} | ${context}`
      : titleWithoutBrandSuffix,
  );
  const qualifiers = [input.exam, input.subject, input.language].filter(Boolean).join(" · ");
  const descriptionText = input.description?.trim()
    ? `Explore ${input.title} by ${input.authorName}${qualifiers ? ` — ${qualifiers}` : ""}. ${input.description.trim()}`
    : `${input.title} by ${input.authorName}${qualifiers ? ` — ${qualifiers}` : ""}. Find this study resource on ${APP_NAME}.`;
  const description = truncate(descriptionText, MAX_DESCRIPTION_LENGTH);
  const url = getAppUrl(`/ebooks/${encodeURIComponent(input.slug)}`);
  const image = getPublicSocialImage(input.coverImageUrl);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "book",
      siteName: APP_NAME,
      url,
      title,
      description,
      images: [{ url: image, alt: `Cover of ${input.title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function getSeoDescription(value: string | null | undefined, fallback: string) {
  return truncate(value?.trim() || fallback, MAX_DESCRIPTION_LENGTH);
}
