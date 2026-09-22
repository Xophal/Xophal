import { CircleHelp } from "lucide-react";
import { APP_NAME } from "@/constants";
import { SUPPORT_EMAIL } from "@/lib/legal";

export const metadata = {
  title: `FAQ - ${APP_NAME}`,
  description: `Frequently asked questions about ${APP_NAME}.`,
};

const faqs = [
  {
    question: "Is {APP_NAME} an official exam board or government platform?",
    answer: "No. {APP_NAME} provides practice resources, mock tests, and study support. It is not an official board, government authority, or exam conductor.",
  },
  {
    question: "Do I need an account to use the site?",
    answer: "You need an account for most student features, including mock tests, results, notifications, and personal study tracking.",
  },
  {
    question: "Where can I find mock tests?",
    answer: "After sign-in, open the student tests area and choose a board, class, and subject to browse available practice tests.",
  },
  {
    question: "How do I see my test results?",
    answer: "After submitting a test, results are shown in the student results/analytics flow, and relevant updates may also appear in notifications.",
  },
  {
    question: "Can I update my profile details?",
    answer: "Yes. Signed-in users can access their profile area to update personal and academic information that is relevant to the platform.",
  },
  {
    question: "How do I contact support?",
    answer: `Email ${SUPPORT_EMAIL} or use the contact page for general support requests.`,
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="mb-10 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">FAQ</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Answers to common questions.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            These answers reflect the features that currently exist in the app.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((entry) => (
            <div key={entry.question} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <CircleHelp className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{entry.question.replace("{APP_NAME}", APP_NAME)}</h2>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{entry.answer.replace("{APP_NAME}", APP_NAME)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
