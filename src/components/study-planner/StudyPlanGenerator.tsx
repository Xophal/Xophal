"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { StudyPlan } from "@/lib/ai-planner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudyPlanGenerator({ initialPlan }: { initialPlan: StudyPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [goal, setGoal] = useState("");
  const [topics, setTopics] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/ai/study-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          topics: topics.split(",").map((topic) => topic.trim()).filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.plan) {
        throw new Error(result.error || "Your study plan could not be created.");
      }
      setPlan(result.data.plan as StudyPlan);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your study plan could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="grid gap-4 border-b border-border pb-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label htmlFor="study-goal" className="text-sm font-medium">Study goal</label>
          <input
            id="study-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            maxLength={300}
            minLength={3}
            required
            placeholder="Build confidence before my science exam"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="study-topics" className="text-sm font-medium">Topics <span className="text-muted-foreground">(comma-separated)</span></label>
          <input
            id="study-topics"
            value={topics}
            onChange={(event) => setTopics(event.target.value)}
            maxLength={800}
            placeholder="Forces, electricity, light"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" disabled={submitting || goal.trim().length < 3} className="h-10 gap-2">
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {submitting ? "Creating plan" : "Create plan"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Your goal and topics are sent to OpenAI when AI generation is configured. Don&apos;t include personal information.
        </p>
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{error}</p>}
      </form>

      <Card>
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {plan.source === "openai" ? "AI-generated plan" : "Template plan"}
          </p>
          <CardTitle>{plan.title}</CardTitle>
          <CardDescription>{plan.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.days.map((day, index) => (
            <div key={`${day.day}-${index}`} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{day.day}</p>
                <span className="text-sm text-muted-foreground">{day.durationMinutes} min</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{day.theme}</p>
              <p className="text-sm">{day.focus}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}