"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const standalonePrefixes = [
  "/admin",
  "/analytics",
  "/auth",
  "/dashboard",
  "/achievements",
  "/bookmarks",
  "/certificates",
  "/leaderboard",
  "/learn",
  "/login",
  "/forgot-password",
  "/notifications",
  "/profile",
  "/register",
  "/reset-password",
  "/settings",
  "/study-planner",
  "/tests",
  "/verify-email",
];

function usesStandaloneShell(pathname: string) {
  return (
    standalonePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    pathname.startsWith("/test/result/") ||
    (pathname.startsWith("/test/") && pathname.endsWith("/attempt"))
  );
}

export default function PublicChrome({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname() || "/";

  if (usesStandaloneShell(pathname)) return children;

  return (
    <div className="xophol-public flex min-h-screen flex-col">
      {header}
      <div className="flex-1 pt-20">{children}</div>
      {footer}
    </div>
  );
}