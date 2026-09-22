"use client";

import * as Icons from "lucide-react";
import React from "react";

export default function Icon({ name, className }: { name: string; className?: string }) {
  const IconComp = (Icons as any)[name] || (Icons as any).BookOpen;
  return <IconComp className={className} />;
}
