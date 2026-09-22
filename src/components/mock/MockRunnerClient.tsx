"use client";

import dynamic from "next/dynamic";

const MockRunner = dynamic(() => import("./MockRunner"), { ssr: false });

export default function MockRunnerClient({ slug }: { slug: string }) {
  return <MockRunner slug={slug} />;
}
