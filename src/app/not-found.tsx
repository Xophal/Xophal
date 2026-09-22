import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Page not found - ${APP_NAME}`,
  description: `The requested page is not available on ${APP_NAME}.`,
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <SearchX className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-primary">404</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Page not found</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The page you’re looking for does not exist or may have moved. You can return home or browse the available mock tests.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link href="/tests" className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
            Mock tests
          </Link>
        </div>
      </div>
    </main>
  );
}
