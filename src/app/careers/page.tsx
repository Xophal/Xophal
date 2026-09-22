import { BriefcaseBusiness } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Careers - ${APP_NAME}`,
  description: `Career opportunities at ${APP_NAME}.`,
};

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Careers</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Join the Xophal team.</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <BriefcaseBusiness className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Open roles</h2>
          </div>
          <p className="text-muted-foreground">We are building a team of educators, engineers, and product builders passionate about improving learning outcomes in India.</p>
        </div>
      </section>
    </main>
  );
}
