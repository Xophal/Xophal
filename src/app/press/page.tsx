import { Newspaper } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Press - ${APP_NAME}`,
  description: `Press and media information about ${APP_NAME}.`,
};

export default function PressPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Press</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Media and brand resources.</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Press kit</h2>
          </div>
          <p className="text-muted-foreground">Media inquiries and brand resources can be requested through the contact page.</p>
        </div>
      </section>
    </main>
  );
}
