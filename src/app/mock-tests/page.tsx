import type { Metadata } from "next";
import { TestListing } from "@/components/tests/test-listing";
import { APP_NAME } from "@/constants";
import { getPublicSocialImage } from "@/lib/ebooks/seo";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const isFiltered = Object.values(params).some((value) => Boolean(value?.trim()));
  const title = "Mock Tests";
  const description = `Browse available Class 9 and 10 board-focused mock tests on ${APP_NAME}.`;
  const image = getPublicSocialImage();
  return {
    title,
    description,
    robots: isFiltered ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/mock-tests" },
    openGraph: { type: "website", siteName: APP_NAME, title, description, url: "/mock-tests", images: [{ url: image, alt: "Xophol mock tests" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function MockTestsPage() {
  return <TestListing />;
}
