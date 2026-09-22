"use client";

import { Suspense } from "react";
import NextDynamic from "next/dynamic";

const DevTestClient = NextDynamic(() => import("@/components/dev/DevTestClient"));

export default function DevTestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DevTestClient />
    </Suspense>
  );
}
