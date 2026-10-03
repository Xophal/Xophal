"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type RelationType = "RELATED" | "RECOMMENDED" | "PRIMARY" | "EXCLUDED";
type Resource = {
  id: string;
  title: string;
  slug: string;
  status?: string;
  is_active?: boolean;
  is_published?: boolean;
  author_name?: string;
};
type Relation = {
  id: string;
  ebook_id?: string;
  mock_test_id?: string;
  relation_type: RelationType;
  priority: number;
};
type Payload = { relations: Relation[]; candidates: Resource[] };

export default function LearningRelationManager({
  ebookId,
  mockTestId,
}: {
  ebookId?: string;
  mockTestId?: string;
}) {
  const resourceId = ebookId ?? mockTestId ?? "";
  const [payload, setPayload] = useState<Payload>({ relations: [], candidates: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRelationType, setNewRelationType] = useState<RelationType>("RELATED");
  const relationKey = ebookId ? "ebookId" : "mockTestId";
  const targetKey = ebookId ? "mock_test_id" : "ebook_id";

  const fetchPayload = useCallback(async (term: string) => {
    const params = new URLSearchParams({ [relationKey]: resourceId });
    if (term.trim()) params.set("q", term.trim());
    const response = await fetch(`/api/admin/learning-relations?${params}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Could not load relationships.");
    return result.data as Payload;
  }, [relationKey, resourceId]);
  const load = useCallback(async (term: string) => {
    setPayload(await fetchPayload(term));
  }, [fetchPayload]);

  useEffect(() => {
    let active = true;
    void fetchPayload("").then((data) => {
      if (active) setPayload(data);
    }).catch((error: unknown) => {
      if (active) toast({ title: "Relationships could not load", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPayload]);

  async function save(relation: Relation, changes: { relation_type?: RelationType; priority?: number }) {
    const ebook = ebookId ?? relation.ebook_id;
    const test = mockTestId ?? relation.mock_test_id;
    if (!ebook || !test) return;
    setBusyId(test);
    try {
      const response = await fetch("/api/admin/learning-relations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          ebookId: ebook,
          mockTestId: test,
          relationType: changes.relation_type ?? relation.relation_type,
          priority: changes.priority ?? relation.priority,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save relationship.");
      await load(search);
    } catch (error) {
      toast({ title: "Relationship could not save", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(relation: Relation) {
    const ebook = ebookId ?? relation.ebook_id;
    const test = mockTestId ?? relation.mock_test_id;
    if (!ebook || !test) return;
    setBusyId(test);
    try {
      const response = await fetch("/api/admin/learning-relations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", ebookId: ebook, mockTestId: test }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not remove relationship.");
      await load(search);
    } catch (error) {
      toast({ title: "Relationship could not remove", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function add(resource: Resource) {
    const relation = {
      id: "",
      [targetKey]: resource.id,
      relation_type: newRelationType,
      priority: 100,
    } as Relation;
    await save(relation, {});
  }

  const relatedIds = new Set(payload.relations.map((relation) => relation[targetKey]));

  async function searchResources() {
    try {
      await load(search);
    } catch (error) {
      toast({ title: "Search failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={ebookId ? "Search mock tests" : "Search published eBooks"}
          aria-label={ebookId ? "Search mock tests" : "Search eBooks"}
        />
        <Button type="button" variant="outline" onClick={() => void searchResources()}>Search</Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={`new-relation-type-${resourceId}`} className="text-sm text-muted-foreground">New relationship</label>
        <select
          id={`new-relation-type-${resourceId}`}
          className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
          value={newRelationType}
          onChange={(event) => setNewRelationType(event.target.value as RelationType)}
        >
          <option value="RELATED">Related</option>
          <option value="RECOMMENDED">Recommended</option>
          <option value="PRIMARY">Primary override</option>
          <option value="EXCLUDED">Hide recommendation</option>
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading relationships…</p> : null}
      <div className="space-y-2">
        {payload.relations.map((relation) => {
          const targetId = relation[targetKey];
          const candidate = payload.candidates.find((item) => item.id === targetId);
          return (
            <div key={targetId} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_150px_90px_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{candidate?.title ?? targetId}</p>
                <p className="text-xs text-muted-foreground">{candidate?.status ?? (candidate?.is_published ? "Published" : "Unpublished")}</p>
              </div>
              <select
                aria-label={`Relationship type for ${candidate?.title ?? targetId}`}
                className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={relation.relation_type}
                disabled={busyId === targetId}
                onChange={(event) => void save(relation, { relation_type: event.target.value as RelationType })}
              >
                <option value="RELATED">Related</option>
                <option value="RECOMMENDED">Recommended</option>
                <option value="PRIMARY">Primary override</option>
                <option value="EXCLUDED">Hide recommendation</option>
              </select>
              <Input
                aria-label={`Priority for ${candidate?.title ?? targetId}`}
                type="number"
                min={0}
                max={10000}
                value={relation.priority}
                disabled={busyId === targetId}
                onChange={(event) => {
                  const priority = Number(event.target.value);
                  setPayload((current) => ({
                    ...current,
                    relations: current.relations.map((item) =>
                      item.id === relation.id ? { ...item, priority } : item,
                    ),
                  }));
                }}
                onBlur={() => void save(relation, { priority: relation.priority })}
              />
              <Button type="button" variant="ghost" disabled={busyId === targetId} onClick={() => void remove(relation)}>Remove</Button>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search results</p>
        {payload.candidates.filter((candidate) => !relatedIds.has(candidate.id)).map((candidate) => (
          <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{candidate.title}</p>
              <p className="text-xs text-muted-foreground">{candidate.author_name ?? candidate.status ?? (candidate.is_published ? "Published" : "Unpublished")}</p>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={busyId === candidate.id} onClick={() => void add(candidate)}>Add</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
