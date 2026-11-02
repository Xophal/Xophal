"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BLUEPRINT_KINDS,
  blueprintSectionInputSchema,
  sectionFilterSchema,
} from "@/lib/engine/blueprint-schema";
import type {
  BlueprintKind,
  BlueprintSectionDefaults,
  SectionFilter,
} from "@/lib/engine/blueprint-schema";
import { ENGINE_BOARDS, ENGINE_SKILLS, ENGINE_TYPES } from "@/lib/engine/vocab";

type BlueprintSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: BlueprintKind;
  duration_sec: number;
  total_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_public: boolean;
  source_mock_test_id: string | null;
  updated_at?: string;
};

type BlueprintDetails = BlueprintSummary & {
  sections: BlueprintSectionDefaults[];
};

type TopicOption = {
  id: string;
  name: string;
  chapters?: { name?: string | null } | null;
};

type Pagination = { page: number; totalPages: number; total: number; hasMore: boolean };
type ApiReply<T> = { success: boolean; data?: T; error?: string };
type BlueprintListData = { data: BlueprintSummary[]; pagination: Pagination };
type Availability = {
  sectionId: string | null;
  title: string;
  requested: number;
  exact: number;
  reachable: number;
  canFill: boolean;
  wouldRelax: string[];
  shortfall: number;
};

type BlueprintForm = {
  name: string;
  slug: string;
  description: string;
  kind: BlueprintKind;
  duration_sec: number;
  is_public: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
};

const EMPTY_FILTER: SectionFilter = sectionFilterSchema.parse({});

function newSection(position: number): BlueprintSectionDefaults {
  return blueprintSectionInputSchema.parse({
    title: `Section ${position + 1}`,
    position,
  });
}

function newBlueprintForm(): BlueprintForm {
  return {
    name: "",
    slug: "",
    description: "",
    kind: "custom",
    duration_sec: 1800,
    is_public: true,
    shuffle_questions: true,
    shuffle_options: true,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json()) as ApiReply<T>;
  if (!response.ok || !result.success || result.data === undefined) {
    throw new Error(result.error ?? `Request failed with status ${response.status}`);
  }
  return result.data;
}

function selectedValues<T extends string>(
  event: ChangeEvent<HTMLSelectElement>,
  allowed: readonly T[]
): T[] {
  return Array.from(event.currentTarget.selectedOptions).reduce<T[]>((values, option) => {
    const match = allowed.find((value) => value === option.value);
    if (match) values.push(match);
    return values;
  }, []);
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="glass-input w-full rounded-md px-2 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

export default function EngineBlueprintsPage() {
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BlueprintForm>(newBlueprintForm);
  const [sections, setSections] = useState<BlueprintSectionDefaults[]>([]);
  const [availability, setAvailability] = useState<Availability[] | null>(null);
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadBlueprints = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await requestData<BlueprintListData>(
        `/api/admin/engine/blueprints?page=${page}&limit=100`,
        { cache: "no-store" }
      );
      setBlueprints(result.data);
      setPagination(result.pagination);
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadTopics = useCallback(async () => {
    try {
      const result = await requestData<{ topics: TopicOption[] }>("/api/admin/engine/vocab", {
        cache: "no-store",
      });
      setTopics(result.topics);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    const refresh = async () => {
      await loadBlueprints();
    };
    void refresh();
  }, [loadBlueprints]);

  useEffect(() => {
    const refresh = async () => {
      await loadTopics();
    };
    void refresh();
  }, [loadTopics]);

  function closeEditor() {
    setFormOpen(false);
    setEditingId(null);
    setForm(newBlueprintForm());
    setSections([]);
    setAvailability(null);
    setPoolSize(null);
    setFormError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(newBlueprintForm());
    setSections([newSection(0)]);
    setAvailability(null);
    setPoolSize(null);
    setFormError(null);
    setFormOpen(true);
  }

  async function startEdit(id: string) {
    setFormError(null);
    try {
      const detail = await requestData<BlueprintDetails>(`/api/admin/engine/blueprints/${id}`, {
        cache: "no-store",
      });
      setEditingId(id);
      setForm({
        name: detail.name,
        slug: detail.slug,
        description: detail.description ?? "",
        kind: detail.kind,
        duration_sec: detail.duration_sec,
        is_public: detail.is_public,
        shuffle_questions: detail.shuffle_questions,
        shuffle_options: detail.shuffle_options,
      });
      setSections(
        detail.sections.length
          ? detail.sections.map((section) => blueprintSectionInputSchema.parse(section))
          : [newSection(0)]
      );
      setAvailability(null);
      setPoolSize(null);
      setFormOpen(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  function updateSection(index: number, patch: Partial<BlueprintSectionDefaults>) {
    setAvailability(null);
    setSections((current) =>
      current.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      )
    );
  }

  function updateFilter(index: number, patch: Partial<SectionFilter>) {
    const currentFilter = sections[index]?.filter ?? EMPTY_FILTER;
    updateSection(index, { filter: { ...currentFilter, ...patch } });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setAvailability(null);
    setSections((current) => {
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((section, position) => ({ ...section, position }));
    });
  }

  async function checkAvailability() {
    setChecking(true);
    setFormError(null);
    try {
      const result = await requestData<{ sections: Availability[]; poolSize: number }>(
        "/api/admin/engine/blueprints",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sections: sections.map((section, position) => ({ ...section, position })),
          }),
        }
      );
      setAvailability(result.sections);
      setPoolSize(result.poolSize);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }

  async function saveBlueprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const normalizedSections = sections.map((section, position) => ({ ...section, position }));
      const payload = {
        ...form,
        total_marks: normalizedSections.reduce(
          (total, section) => total + section.count * section.marks_per_q,
          0
        ),
        sections: normalizedSections,
      };
      await requestData(
        editingId
          ? `/api/admin/engine/blueprints/${editingId}`
          : "/api/admin/engine/blueprints",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      closeEditor();
      await loadBlueprints();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBlueprint(id: string) {
    if (!confirm("Delete this blueprint? Deletion is blocked if it has generated test instances.")) return;
    setListError(null);
    try {
      await requestData(`/api/admin/engine/blueprints/${id}`, { method: "DELETE" });
      await loadBlueprints();
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
    }
  }

  const totalMarks = sections.reduce(
    (total, section) => total + section.count * section.marks_per_q,
    0
  );

  if (formOpen) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button type="button" variant="ghost" className="mb-2 -ml-3" onClick={closeEditor}>
              Back to blueprints
            </Button>
            <h1 className="text-2xl font-semibold">
              {editingId ? "Edit blueprint" : "Create blueprint"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Define sections and filters, then check whether the published question bank can fill them.
            </p>
          </div>
          <div className="rounded-xl border border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Estimated total marks</span>
            <strong className="ml-2">{totalMarks}</strong>
          </div>
        </div>

        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <form className="space-y-6" onSubmit={saveBlueprint}>
          <Card>
            <CardHeader>
              <CardTitle>Blueprint details</CardTitle>
              <CardDescription>These settings control how the generated test is presented.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bp-name">Name</Label>
                <Input
                  id="bp-name"
                  required
                  maxLength={300}
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      slug: current.slug === slugify(current.name) ? slugify(name) : current.slug,
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp-slug">URL slug</Label>
                <Input
                  id="bp-slug"
                  required
                  maxLength={300}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="bp-description">Description</Label>
                <Textarea
                  id="bp-description"
                  maxLength={4000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>
              <SelectField
                id="bp-kind"
                label="Blueprint type"
                value={form.kind}
                onChange={(value) => {
                  const kind = BLUEPRINT_KINDS.find((candidate) => candidate === value);
                  if (kind) setForm((current) => ({ ...current, kind }));
                }}
              >
                {BLUEPRINT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
                ))}
              </SelectField>
              <div className="space-y-1.5">
                      <Label htmlFor="bp-duration">Duration (seconds)</Label>
                <Input
                  id="bp-duration"
                  type="number"
                        min={30}
                        max={28800}
                  required
                        value={form.duration_sec}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                            duration_sec: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-5 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, is_public: event.target.checked }))
                    }
                  />
                  Public blueprint
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.shuffle_questions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, shuffle_questions: event.target.checked }))
                    }
                  />
                  Shuffle questions
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.shuffle_options}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, shuffle_options: event.target.checked }))
                    }
                  />
                  Shuffle options
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Sections</h2>
              <p className="text-sm text-muted-foreground">
                Each section draws from published questions matching its filters.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={sections.length >= 30}
              onClick={() => {
                setAvailability(null);
                setSections((current) => [...current, newSection(current.length)]);
              }}
            >
              Add section
            </Button>
          </div>

          {sections.map((section, index) => (
            <Card key={section.id ?? `new-${index}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-lg">Section {index + 1}</CardTitle>
                  <CardDescription>{section.count} questions · {section.marks_per_q} marks each</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    aria-label={`Move section ${index + 1} up`}
                    onClick={() => moveSection(index, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === sections.length - 1}
                    aria-label={`Move section ${index + 1} down`}
                    onClick={() => moveSection(index, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={sections.length === 1}
                    onClick={() => {
                      setAvailability(null);
                      setSections((current) => current.filter((_, sectionIndex) => sectionIndex !== index));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-title`}>Section title</Label>
                  <Input
                    id={`section-${index}-title`}
                    maxLength={200}
                    required
                    value={section.title}
                    onChange={(event) => updateSection(index, { title: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-count`}>Question count</Label>
                  <Input
                    id={`section-${index}-count`}
                    type="number"
                    min={0}
                    max={200}
                    required
                    value={section.count}
                    onChange={(event) => updateSection(index, { count: Number(event.target.value) })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`section-${index}-marks`}>Marks per question</Label>
                    <Input
                      id={`section-${index}-marks`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.25"
                      value={section.marks_per_q}
                      onChange={(event) =>
                        updateSection(index, { marks_per_q: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`section-${index}-negative`}>Negative marks</Label>
                    <Input
                      id={`section-${index}-negative`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.25"
                      value={section.neg_marks}
                      onChange={(event) =>
                        updateSection(index, { neg_marks: Number(event.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5 xl:col-span-3">
                  <Label htmlFor={`section-${index}-topics`}>Topic scope (leave empty for any topic)</Label>
                  <select
                    id={`section-${index}-topics`}
                    multiple
                    size={Math.min(5, Math.max(2, topics.length))}
                    className="glass-input w-full rounded-md px-2 py-2 text-sm"
                    value={section.filter.topic_ids}
                    onChange={(event) =>
                      updateFilter(
                        index,
                        { topic_ids: selectedValues(event, topics.map((topic) => topic.id)) }
                      )
                    }
                  >
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.chapters?.name ? `${topic.chapters.name} › ${topic.name}` : topic.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Use Ctrl or Command to select multiple topics.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-types`}>Question types</Label>
                  <select
                    id={`section-${index}-types`}
                    multiple
                    size={4}
                    className="glass-input w-full rounded-md px-2 py-2 text-sm"
                    value={section.filter.types}
                    onChange={(event) => updateFilter(index, { types: selectedValues(event, ENGINE_TYPES) })}
                  >
                    {ENGINE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-skills`}>Skills</Label>
                  <select
                    id={`section-${index}-skills`}
                    multiple
                    size={4}
                    className="glass-input w-full rounded-md px-2 py-2 text-sm"
                    value={section.filter.skills}
                    onChange={(event) => updateFilter(index, { skills: selectedValues(event, ENGINE_SKILLS) })}
                  >
                    {ENGINE_SKILLS.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Section ${index + 1} minimum difficulty`}
                      type="number"
                      min={1}
                      max={3}
                      value={section.filter.difficulty_min}
                      onChange={(event) =>
                        updateFilter(index, { difficulty_min: Number(event.target.value) })
                      }
                    />
                    <span aria-hidden="true">to</span>
                    <Input
                      aria-label={`Section ${index + 1} maximum difficulty`}
                      type="number"
                      min={1}
                      max={3}
                      value={section.filter.difficulty_max}
                      onChange={(event) =>
                        updateFilter(index, { difficulty_max: Number(event.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Requested difficulty mix</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map((difficulty) => (
                      <div key={difficulty} className="space-y-1">
                        <Label htmlFor={`section-${index}-mix-${difficulty}`} className="text-xs">
                          Level {difficulty}
                        </Label>
                        <Input
                          id={`section-${index}-mix-${difficulty}`}
                          type="number"
                          min={0}
                          max={200}
                          value={section.difficulty_mix[`${difficulty}` as "1" | "2" | "3"] ?? 0}
                          onChange={(event) =>
                            updateSection(index, {
                              difficulty_mix: {
                                ...section.difficulty_mix,
                                [`${difficulty}` as "1" | "2" | "3"]: Number(event.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-boards`}>Board patterns</Label>
                  <select
                    id={`section-${index}-boards`}
                    multiple
                    size={3}
                    className="glass-input w-full rounded-md px-2 py-2 text-sm"
                    value={section.filter.board_patterns}
                    onChange={(event) =>
                      updateFilter(index, { board_patterns: selectedValues(event, ENGINE_BOARDS) })
                    }
                  >
                    {ENGINE_BOARDS.map((board) => <option key={board} value={board}>{board}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${index}-tags`}>Required tags</Label>
                  <Input
                    id={`section-${index}-tags`}
                    placeholder="e.g. balancing,pyq"
                    value={section.filter.tags.join(", ")}
                    onChange={(event) =>
                      updateFilter(index, {
                        tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={section.filter.pyq_only}
                      onChange={(event) => updateFilter(index, { pyq_only: event.target.checked })}
                    />
                    Previous-year questions only
                  </label>
                </div>
                <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                  <Label htmlFor={`section-${index}-instructions`}>Instructions</Label>
                  <Textarea
                    id={`section-${index}-instructions`}
                    maxLength={2000}
                    value={section.instructions}
                    onChange={(event) => updateSection(index, { instructions: event.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Question-bank availability</h2>
                  <p className="text-sm text-muted-foreground">
                    Read-only check against published questions; it does not create a test instance.
                  </p>
                </div>
                <Button type="button" variant="outline" disabled={checking} onClick={checkAvailability}>
                  {checking ? "Checking…" : "Check availability"}
                </Button>
              </div>
              {availability && (
                <div className="space-y-2" aria-live="polite">
                  <p className="text-xs text-muted-foreground">
                    Published question pool: {poolSize ?? 0}
                  </p>
                  {availability.map((result, index) => (
                    <div
                      key={result.sectionId ?? `${result.title}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <div>
                        <strong>{result.title}</strong>
                        <span className="ml-2 text-muted-foreground">
                          {result.exact} exact · {result.reachable} reachable · {result.requested} requested
                        </span>
                      </div>
                      <span className={result.canFill ? "text-emerald-600" : "text-destructive"}>
                        {result.canFill
                          ? result.wouldRelax.length
                            ? `Can fill if relaxed: ${result.wouldRelax.join(" → ")}`
                            : "Can fill without relaxing filters"
                          : `Short by ${result.shortfall}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create blueprint"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Test blueprints</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure reusable test structures and check their published question-bank coverage.
          </p>
        </div>
        <Button onClick={startCreate}>Create blueprint</Button>
      </div>

      {listError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {listError}
        </div>
      )}
      {formError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      {loading ? (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading blueprints…</CardContent></Card>
      ) : blueprints.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">No blueprints found</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a blueprint to define your first generated test.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blueprints.map((blueprint) => (
            <Card key={blueprint.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{blueprint.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    /{blueprint.slug} · {blueprint.kind.replaceAll("_", " ")} ·{" "}
                    {Math.round(blueprint.duration_sec / 60)} min · {blueprint.total_marks} marks
                  </p>
                  {blueprint.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{blueprint.description}</p>
                  )}
                  <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                    {blueprint.is_public ? "Public" : "Private"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {blueprint.source_mock_test_id ? (
                    <span className="self-center text-xs text-muted-foreground">
                      Managed by the linked legacy mock test
                    </span>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => void startEdit(blueprint.id)}>Edit</Button>
                      <Button variant="destructive" onClick={() => void deleteBlueprint(blueprint.id)}>Delete</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasMore}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
