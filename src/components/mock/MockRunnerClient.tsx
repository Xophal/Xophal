"use client";

import dynamic from "next/dynamic";

const MockRunner = dynamic(() => import("./MockRunner"), { ssr: false });

export default function MockRunnerClient({ slug, sourceEbookId }: { slug: string; sourceEbookId?: string }) {
  return <MockRunner slug={slug} sourceEbookId={sourceEbookId} />;
}
