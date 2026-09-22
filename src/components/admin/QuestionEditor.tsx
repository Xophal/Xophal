"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Option = { id?: string; label?: string; text?: string; isCorrect?: boolean };
type QuestionEditorProps = { mockTestId: string; existing?: Record<string, unknown>; onSaved: (q: unknown) => void; onCancel?: () => void };

export default function QuestionEditor({ mockTestId, existing, onSaved, onCancel }: QuestionEditorProps) {
  const existingOptions = Array.isArray(existing?.question_options) ? (existing.question_options as Array<Record<string, unknown>>).map((option) => ({
    id: typeof option.id === "string" ? option.id : undefined,
    label: typeof option.label === "string" ? option.label : undefined,
    text: typeof option.text === "string" ? option.text : typeof option.option_text === "string" ? option.option_text : "",
    isCorrect: option.isCorrect === true || option.is_correct === true,
  })) : [];
  const [stem, setStem] = useState(typeof existing?.question_text === "string" ? existing.question_text : "");
  const [explanation, setExplanation] = useState(typeof existing?.explanation === "string" ? existing.explanation : "");
  const [tags, setTags] = useState(Array.isArray(existing?.tags) ? existing.tags.join(", ") : "");
  const [status, setStatus] = useState(typeof existing?.status === "string" ? existing.status : "draft");
  const [marks, setMarks] = useState(typeof existing?.marks === "number" ? existing.marks : 1);
  const [negativeMarks, setNegativeMarks] = useState(typeof existing?.negative_marks === "number" ? existing.negative_marks : 0);
  const [options, setOptions] = useState<Option[]>(existingOptions.length > 0 ? existingOptions : [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing && existingOptions.length > 0) setOptions(existingOptions);
  }, [existing]);

  function setOptionText(index: number, text: string) {
    setOptions((s) => s.map((o, i) => (i === index ? { ...o, text } : o)));
  }

  function toggleCorrect(index: number) {
    setOptions((s) => s.map((o, i) => ({ ...o, isCorrect: i === index }))); // single-correct
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        mockTestId,
        stem,
        explanation,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        status,
        marks,
        negativeMarks,
        options: options.map((o, idx) => ({ label: o.label || String.fromCharCode(65 + idx), text: o.text || "", isCorrect: !!o.isCorrect, sortOrder: idx + 1 })),
        type: "single_correct",
      };

      const url = existing ? `/api/admin/questions/${existing.id}` : "/api/admin/questions";
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Save failed");
      toast({ title: existing ? "Question updated" : "Question created" });
      onSaved(json.data || json.data?.question || json.data?.question || json.data?.attached || json);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>Question text</Label>
        <Textarea value={stem} onChange={(e) => setStem(e.target.value)} required />
      </div>

      <div>
        <Label>Explanation</Label>
        <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explain the correct answer" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="algebra, board-exam" /></div>
        <div><Label>Status</Label><select value={status} onChange={(e) => setStatus(e.target.value)} className="flex h-10 w-full px-3 py-2 text-sm glass-input"><option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></div>
      </div>

      <div>
        <Label>Options</Label>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <button type="button" onClick={() => toggleCorrect(i)} className={`w-8 rounded border ${o.isCorrect ? 'bg-green-100' : ''}`}>{String.fromCharCode(65 + i)}</button>
              <Input value={o.text || ''} onChange={(e) => setOptionText(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="w-24">
          <Label>Marks</Label>
          <Input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value) || 1)} />
        </div>
        <div className="w-32">
          <Label>Negative</Label>
          <Input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        {onCancel && <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
