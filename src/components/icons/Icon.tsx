"use client";

import * as Icons from "lucide-react";
import React from "react";

export default function Icon({ name, className }: { name: string; className?: string }) {
  const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] || Icons.BookOpen;
  return <IconComp className={className} />;
}
