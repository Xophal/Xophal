"use client";

import React from "react";
import { ReactNode } from "react";

type Props = { children: ReactNode; variant?: "glass" | "subtle" };

export function NavTheme({ children, variant = "glass" }: Props) {
  return (
    <div className={variant === "glass" ? "nav-theme-glass" : "nav-theme-subtle"}>
      {children}
    </div>
  );
}

export default NavTheme;
