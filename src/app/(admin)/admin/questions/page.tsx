"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QuestionEditor from "@/components/admin/QuestionEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type Q = any;

export default function AdminQuestionsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [editing, setEditing] = useState<Q | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    const res = await fetch("/api/admin/mock-tests", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setTests(json.data || []);
  }

  async function loadQuestions(testId: string) {
    setLoading(true);
    try {
      const statusQuery = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(`/api/admin/questions?mockTestId=${testId}${statusQuery}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      setQuestions(json.data || []);
    } catch (err) {
      toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function setQuestionStatus(id: string, status: string) {
    const response = await fetch(`/api/admin/questions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Status update failed", description: result.error || "Please try again.", variant: "destructive" });
    toast({ title: `Question marked ${status}` });
    if (selectedTest) await loadQuestions(selectedTest);
  }

  function onTestChange(id: string) {
    setSelectedTest(id);
    loadQuestions(id);
  }

  function handleSaved(q: any) {
    // reload list
    if (selectedTest) loadQuestions(selectedTest);
    setEditing(null);
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this question? This archives if referenced.")) return;
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) return toast({ title: "Delete failed", description: json.error || "", variant: "destructive" });
    toast({ title: "Deleted" });
    if (selectedTest) loadQuestions(selectedTest);
  }

  async function move(index: number, dir: number) {
    if (!selectedTest) return;
    const items = [...questions];
    const ni = index + dir;
    if (ni < 0 || ni >= items.length) return;
    const tmp = items[index]; items[index] = items[ni]; items[ni] = tmp;
    setQuestions(items);
  }

  async function saveOrder() {
    if (!selectedTest) return;
    const order = questions.map((q, i) => ({ questionId: q.id, sortOrder: i + 1 }));
    const res = await fetch(`/api/admin/mock-tests/${selectedTest}/questions/reorder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) });
    const json = await res.json();
    if (!res.ok || !json.success) return toast({ title: "Save order failed", description: json.error || "", variant: "destructive" });
    toast({ title: "Order saved" });
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Question Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage questions for mock tests.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Select test</CardTitle>
          </CardHeader>
          <CardContent>
            <select className="w-full px-2 py-1 glass-input" value={selectedTest || ""} onChange={(e) => onTestChange(e.target.value)}>
              <option value="">-- select test --</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">Review status<select className="mt-2 w-full px-2 py-1 glass-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); if (selectedTest) void loadQuestions(selectedTest); }}><option value="all">All statuses</option><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></label>
              <Button onClick={() => setEditing({})} disabled={!selectedTest}>Add question</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <QuestionEditor mockTestId={selectedTest || ''} existing={editing?.id ? editing : undefined} onSaved={handleSaved} onCancel={() => setEditing(null)} />
            ) : (
              <div className="space-y-3">
                {loading && <div>Loading...</div>}
                {!loading && questions.length === 0 && <div className="text-sm text-muted-foreground">No questions</div>}
                {questions.map((q: any, idx: number) => (
                  <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">#{idx + 1} • {q.type || q.question_type}</div>
                      <div className="font-medium">{(q.stem || q.question_text || '').slice(0, 120)}{(q.stem || q.question_text || '').length > 120 ? '…' : ''}</div>
                      <div className="text-xs text-muted-foreground">Options: {(q.question_options || q.options || []).length} • Marks: {q.marks} • Status: {q.status || "draft"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => { setEditing(q); }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => move(idx, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" onClick={() => move(idx, 1)}>↓</Button>
                      <Button size="sm" variant="outline" onClick={() => void setQuestionStatus(q.id, q.status === "published" ? "draft" : "published")}>{q.status === "published" ? "Unpublish" : "Publish"}</Button><Button size="sm" variant="destructive" onClick={() => onDelete(q.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {questions.length > 1 && <div className="mt-3"><Button onClick={saveOrder}>Save order</Button></div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
