"use client";

import { motion } from "framer-motion";

/**
 * Animated article wrapper for the blog detail page. framer-motion can only be
 * imported from client components, so this thin wrapper keeps the server
 * component (page.tsx) free of client-only imports while preserving the
 * entrance animation.
 */
export default function BlogArticle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.article>
  );
}
