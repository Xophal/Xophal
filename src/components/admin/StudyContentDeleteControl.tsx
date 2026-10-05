"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogOverlay } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  DELETE_ALL_STUDY_CONTENT_CONFIRMATION,
  STUDY_CONTENT_RESOURCES,
  STUDY_CONTENT_RESOURCE_LABELS,
  getDeleteSectionConfirmation,
  type StudyContentResource,
  type StudyContentScope,
} from "@/lib/study-content-admin";

type StudyContentRow = { id: string; name: string; is_active: boolean };
type ApiResponse<T> = { success: boolean; data?: T; error?: string };

export default function StudyContentDeleteControl({ canDelete }: { canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<StudyContentScope>("boards");
  const [rows, setRows] = useState<StudyContentRow[]>([]);
  const [loadedResource, setLoadedResource] = useState<StudyContentResource | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || scope === "all") return;
    let cancelled = false;
    fetch(`/api/admin/study-content?resource=${scope}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<StudyContentRow[]>;
        if (!response.ok || !result.success) throw new Error(result.error || "Could not load study content.");
        if (!cancelled) {
          setRows(result.data ?? []);
          setLoadedResource(scope);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRows([]);
          setLoadedResource(scope);
          toast({
            title: "Study content failed to load",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, scope]);

  if (!canDelete) return null;

  const sectionLabel = scope === "all" ? "All study content" : STUDY_CONTENT_RESOURCE_LABELS[scope];
  const visibleRows = scope !== "all" && loadedResource === scope ? rows : [];
  const loading = scope !== "all" && loadedResource !== scope;
  const requiredConfirmation = scope === "all"
    ? DELETE_ALL_STUDY_CONTENT_CONFIRMATION
    : getDeleteSectionConfirmation(scope);
  const isBulkAction = scope === "all" || !selectedId;

  async function deleteContent() {
    if (!isBulkAction && !window.confirm(`Delete "${visibleRows.find((row) => row.id === selectedId)?.name ?? "this item"}"? It will be archived and hidden from students.`)) return;
    if (isBulkAction && confirmation !== requiredConfirmation) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/admin/study-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          ...(selectedId && scope !== "all" ? { id: selectedId } : { confirmation }),
        }),
      });
      const result = (await response.json()) as ApiResponse<{
        archived: number | Partial<Record<StudyContentResource, number>>;
      }>;
      if (!response.ok || !result.success) {
        const partialCounts = (result as ApiResponse<unknown> & { archived?: Partial<Record<StudyContentResource, number>> }).archived;
        if (partialCounts) {
          toast({
            title: "Archive stopped part-way",
            description: `${result.error || "Some sections may already have been archived."} ${Object.entries(partialCounts).map(([key, count]) => `${STUDY_CONTENT_RESOURCE_LABELS[key as StudyContentResource]}: ${count}`).join(" · ")}`,
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.error || "Could not delete study content.");
      }

      const archived = result.data?.archived;
      const description = typeof archived === "number"
        ? `${archived} ${sectionLabel.toLowerCase()} item${archived === 1 ? "" : "s"} archived.`
        : Object.entries(archived ?? {}).map(([key, count]) => `${STUDY_CONTENT_RESOURCE_LABELS[key as StudyContentResource]}: ${count}`).join(" · ");
      toast({ title: "Study content archived", description: description || "No records were found." });
      setConfirmation("");
      if (scope === "all") {
        setOpen(false);
      } else {
        setRows((current) => current.map((row) => (
          selectedId ? row.id === selectedId ? { ...row, is_active: false } : row : { ...row, is_active: false }
        )));
        setSelectedId("");
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="fixed bottom-5 right-5 z-40 shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open study content deletion controls"
      >
        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
        Delete study content
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setConfirmation("");
      }}>
        <DialogOverlay className="z-40" />
        <DialogContent className="z-50 max-w-xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-red-500/10 p-2 text-red-400">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">Delete study content</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Records are archived and hidden from students. User accounts, attempts, payments, audit logs, and settings are not deleted.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 p-2">
            <div className="space-y-2">
              <Label htmlFor="study-content-scope">Content section</Label>
              <select
                id="study-content-scope"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as StudyContentScope);
                  setSelectedId("");
                  setConfirmation("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {STUDY_CONTENT_RESOURCES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                <option value="all">All study content</option>
              </select>
            </div>

            {scope !== "all" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="study-content-item">Individual item</Label>
                  <select
                    id="study-content-item"
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                    disabled={loading || visibleRows.length === 0}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{loading ? "Loading items…" : visibleRows.length ? "Choose an item (or leave blank to clear the section)" : "No items found"}</option>
                    {visibleRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name.slice(0, 120)}{row.is_active ? "" : " (already archived)"}
                      </option>
                    ))}
                  </select>
                  {visibleRows.length === 500 && <p className="text-xs text-amber-300">Showing the first 500 records. Section deletion still covers every record.</p>}
                </div>
                {!selectedId && (
                  <div className="space-y-2">
                    <Label htmlFor="study-content-confirmation">Type {requiredConfirmation}</Label>
                    <Input
                      id="study-content-confirmation"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                )}
              </>
            )}

            {scope === "all" && (
              <>
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-100">
                  This hides all boards, classes, subjects, chapters, topics, questions, mock tests, and notes. Student records and histories stay intact.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="study-content-confirmation">Type {DELETE_ALL_STUDY_CONTENT_CONFIRMATION}</Label>
                  <Input
                    id="study-content-confirmation"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteContent()}
              disabled={deleting || loading || (isBulkAction && confirmation !== requiredConfirmation) || (scope !== "all" && visibleRows.length === 0)}
            >
              {deleting ? "Deleting…" : <><Archive className="mr-2 h-4 w-4" aria-hidden />{isBulkAction ? `Delete ${sectionLabel}` : "Delete item"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
