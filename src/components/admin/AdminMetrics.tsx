"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, ClipboardList, GraduationCap, Layers3, Users } from "lucide-react";
import { AdminStat } from "@/components/admin/ui";

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
    if (Array.isArray(json?.data)) return json.data.length;
    return undefined;
  } catch {
    return undefined;
  }
}

export default function AdminMetrics() {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [users, boards, classes, subjects, mockTests] = await Promise.all([
        fetchCount("/api/admin/users"),
        fetchCount("/api/admin/boards"),
        fetchCount("/api/admin/classes"),
        fetchCount("/api/admin/subjects"),
        fetchCount("/api/admin/mock-tests"),
      ]);
      if (!cancelled) {
        setCounts({ users, boards, classes, subjects, mockTests });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    { label: "Users", value: counts.users, icon: Users, tone: "cyan" as const },
    { label: "Boards", value: counts.boards, icon: Layers3, tone: "emerald" as const },
    { label: "Classes", value: counts.classes, icon: GraduationCap, tone: "violet" as const },
    { label: "Subjects", value: counts.subjects, icon: BookOpen, tone: "amber" as const },
    { label: "Mock tests", value: counts.mockTests, icon: ClipboardList, tone: "rose" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <AdminStat
          key={item.label}
          label={item.label}
          value={loading ? "…" : typeof item.value === "number" ? item.value.toLocaleString() : "—"}
          icon={item.icon}
          tone={item.tone}
          hint={loading ? "Syncing" : typeof item.value === "number" ? "Total records" : "Unavailable"}
        />
      ))}
    </div>
  );
}

