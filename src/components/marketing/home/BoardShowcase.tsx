"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap, Sparkles } from "lucide-react";
import { ROUTES } from "@/constants";
import { Reveal, RevealGroup, RevealItem, SpotlightCard } from "./Reveal";

export type BoardItem = {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
};

export default function BoardShowcase({ boards }: { boards: BoardItem[] }) {
  return (
    <section id="boards" className="hx-section hx-mesh hx-mesh--dark" aria-labelledby="boards-title">
      <div className="hx-grid-lines" aria-hidden="true" />

      <div className="hx-shell">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="hx-kicker">Start here</span>
            <h2 id="boards-title" className="hx-title">
              Choose your <span className="hx-grad">board</span>
            </h2>
            <p className="hx-subtitle">
              Follow the syllabus that matches your classroom and keep every test, chapter and result in one place.
            </p>
          </div>
          <Link
            href={ROUTES.learn}
            className="inline-flex w-fit items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            Explore all learning
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {boards.length > 0 ? (
          <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.1}>
            {boards.map((board) => (
              <RevealItem key={board.id}>
                <SpotlightCard as="article" className="hx-glass hx-ring hx-board">
                  <div className="hx-board__mark">
                    <span className="hx-chip">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <span className="hx-board__code">{board.code.toUpperCase()}</span>
                  </div>

                  <h3 className="hx-board__name">{board.name}</h3>
                  <p className="hx-board__desc">{board.description ?? "Complete syllabus, tests and solutions."}</p>

                  <Link
                    href={`${ROUTES.learn}?boardSlug=${encodeURIComponent(board.slug)}`}
                    className="hx-board__cta"
                  >
                    Explore {board.code.toUpperCase()}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </SpotlightCard>
              </RevealItem>
            ))}
          </RevealGroup>
        ) : (
          <Reveal className="mt-12">
            <div className="hx-glass hx-ring flex items-center gap-4 p-6 sm:p-8">
              <span className="hx-chip hx-chip--lg">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-bold text-foreground">Your board catalog is almost ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Boards added by your administrator will appear here automatically.
                </p>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
