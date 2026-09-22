"use server";

import React from "react";

type Counts = {
  users?: number;
  boards?: number;
  classes?: number;
  subjects?: number;
  mockTests?: number;
};

async function fetchCount(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const json = await res.json();
    if (Array.isArray(json)) return json.length;
    if (json?.data && Array.isArray(json.data)) return json.data.length;
    return undefined;
  } catch (e) {
    return undefined;
  }
}

export default async function AdminMetrics() {
  const [users, boards, classes, subjects, mockTests] = await Promise.all([
    fetchCount("/api/admin/users"),
    fetchCount("/api/admin/boards"),
    fetchCount("/api/admin/classes"),
    fetchCount("/api/admin/subjects"),
    fetchCount("/api/admin/mock-tests"),
  ]);

  const counts: Counts = { users, boards, classes, subjects, mockTests };

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {[
        { label: "Users", value: counts.users },
        { label: "Boards", value: counts.boards },
        { label: "Classes", value: counts.classes },
        { label: "Subjects", value: counts.subjects },
        { label: "Mock tests", value: counts.mockTests },
      ].map((item) => (
        <div key={item.label} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">{item.label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{typeof item.value === "number" ? item.value : "—"}</div>
        </div>
      ))}
    </div>
  );
}
