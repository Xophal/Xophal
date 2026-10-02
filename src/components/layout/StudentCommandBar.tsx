"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Flame, Search, Sparkles, Zap } from "lucide-react";
import { createTranslator } from "@/lib/i18n";
import NotificationBell from "@/components/layout/NotificationBell";
import StudentProfileMenu from "@/components/layout/StudentProfileMenu";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const t = createTranslator("en");
const numberFormat = new Intl.NumberFormat("en-IN");
const MAX_RESULTS = 8;

export type CommandBarItem = { href: string; label: string };

type CommandGroup = "search" | "goTo" | "action";

type Command = {
  id: string;
  label: string;
  href: string;
  group: CommandGroup;
};

const GROUP_ICONS = {
  search: Search,
  goTo: ArrowUpRight,
  action: Zap,
} as const;

/**
 * Which top-nav entry owns the current route. In-page anchors (the `#` links)
 * are never marked current, so a section jump can't light up two items at once.
 */
function isCurrentRoute(pathname: string, href: string) {
  if (href.includes("#")) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* The modifier glyph for the palette shortcut. Read through
   `useSyncExternalStore` so the server render stays "Ctrl K" and Apple
   keyboards upgrade to ⌘ after hydration - no setState inside an effect and no
   hydration mismatch. Cached because the snapshot must be referentially
   stable. */
let cachedShortcutLabel: string | undefined;

function getShortcutLabel() {
  if (cachedShortcutLabel === undefined) {
    const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
    cachedShortcutLabel = /mac|iphone|ipad|ipod/i.test(platform) ? "⌘ K" : "Ctrl K";
  }
  return cachedShortcutLabel;
}

function getServerShortcutLabel() {
  return "Ctrl K";
}

/** The platform never changes at runtime, so there is nothing to subscribe to. */
function subscribeToShortcut() {
  return () => {};
}

/**
 * The sticky student command bar: brand lockup, sliding-pill navigation, a
 * level/XP + streak vitals pair, a search command palette (Ctrl/⌘ + K) and the
 * shared session actions.
 *
 * Everything visible here is derived from the session, so the bar stays a
 * server-rendered shell with a single client island for the interactions.
 */
export default function StudentCommandBar({
  items,
  fullName,
  email,
  firstName,
  totalXp,
  currentStreak,
}: {
  items: CommandBarItem[];
  fullName: string | null;
  email: string | null;
  firstName: string;
  totalXp: number;
  currentStreak: number;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const reduceMotion = useReducedMotion();
  const [elevated, setElevated] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const shortcutLabel = useSyncExternalStore(subscribeToShortcut, getShortcutLabel, getServerShortcutLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      ...items.map<Command>((item) => ({
        id: `goto:${item.href}`,
        label: item.label,
        href: item.href,
        group: "goTo",
      })),
      { id: "action:mock-tests", label: t("chrome.actionSearch"), href: "/mock-tests", group: "action" },
      { id: "action:weak", label: t("chrome.actionWeak"), href: "/learn", group: "action" },
      { id: "action:performance", label: t("chrome.actionPerformance"), href: "/analytics", group: "action" },
      { id: "action:wrong-answers", label: t("chrome.actionWrongAnswers"), href: "/dashboard#wrong-answers", group: "action" },
    ],
    [items],
  );

  const results = useMemo<Command[]>(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands.slice(0, MAX_RESULTS);
    const matches = commands.filter((command) => command.label.toLowerCase().includes(term));
    return [
      {
        id: "search:term",
        label: t("chrome.paletteSearchOption", { query: query.trim() }),
        href: `/mock-tests?search=${encodeURIComponent(query.trim())}`,
        group: "search" as const,
      },
      ...matches.slice(0, MAX_RESULTS - 1),
    ];
  }, [commands, query]);

  /* The bar deepens its shadow once the shell scrolls, so it reads as a
     floating plane rather than a painted edge. */
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Command palette shortcut. Registered once and independent of open state so
     Ctrl/⌘ + K also closes an open palette. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setQuery("");
      setActiveIndex(0);
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function select(command: Command) {
    setOpen(false);
    setQuery("");
    router.push(command.href);
  }

  /* Everything in the palette is reachable with the arrow keys, so the input is
     the only Tab stop - Tab is kept inside the modal. */
  function onPalettePanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    inputRef.current?.focus();
  }

  function onPaletteKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + results.length) % results.length);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : Math.max(0, results.length - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) select(command);
    }
  }

  return (
    <>
      <header className="sx-bar" data-elevated={elevated ? "true" : "false"}>
        <Link href="/dashboard" className="sx-brand">
          <span className="sx-brand__mark" aria-hidden="true">
            <Sparkles />
          </span>
          <span className="sx-brand__text">
            <span className="sx-brand__title">{t("chrome.brandTag")}</span>
            <span className="sx-brand__sub">{t("chrome.learningHub", { name: firstName })}</span>
          </span>
        </Link>

        <nav className="sx-nav" aria-label={t("nav.primary")}>
          {items.map((item) => {
            const current = isCurrentRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sx-nav__link"
                aria-current={current ? "page" : undefined}
              >
                {current ? (
                  <motion.span
                    layoutId="sx-nav-active"
                    className="sx-nav__glow"
                    aria-hidden="true"
                    transition={reduceMotion ? { duration: 0 } : undefined}
                  />
                ) : null}
                <span className="sx-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sx-bar__trail">
          <button
            type="button"
            className="sx-cmd-trigger"
            onClick={openPalette}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t("chrome.searchHint", { key: shortcutLabel })}
          >
            <Search aria-hidden="true" />
            <span className="sx-cmd-trigger__label">{t("chrome.searchTrigger")}</span>
            <kbd className="sx-kbd">{shortcutLabel}</kbd>
          </button>

          <div className="sx-bar__vitals">
            <span className="sx-chip sx-chip--streak" title={t("chrome.streakHint")}>
              <Flame aria-hidden="true" />
              <span>{t("chrome.streakLabel")}</span>
              <span className="sx-chip__value">
                {currentStreak > 0 ? t("chrome.streakValue", { count: currentStreak }) : "—"}
              </span>
            </span>
            <span className="sx-chip sx-chip--xp" title={t("chrome.xpHint")}>
              <Zap aria-hidden="true" />
              <span className="sx-chip__value">{numberFormat.format(totalXp)}</span>
              <span>{t("chrome.xpLabel")}</span>
            </span>
          </div>

          <div className="sx-bar__icons">
            <NotificationBell />
            <StudentProfileMenu fullName={fullName} email={email} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {open ? (
        <div
          className="sx-palette"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="sx-palette__panel"
            role="dialog"
            aria-modal="true"
            aria-label={t("chrome.paletteLabel")}
            onKeyDown={onPalettePanelKeyDown}
          >
            <div className="sx-palette__field">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                id="student-command-input"
                className="sx-palette__input"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onPaletteKeyDown}
                placeholder={t("chrome.paletteInputPlaceholder")}
                aria-label={t("chrome.paletteInputLabel")}
                aria-controls="student-command-results"
                aria-activedescendant={results[activeIndex] ? `student-command-${results[activeIndex].id}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <ul
              ref={listRef}
              id="student-command-results"
              className="sx-palette__list"
              role="listbox"
              aria-label={t("chrome.paletteLabel")}
            >
              {results.map((command, index) => {
                const Icon = GROUP_ICONS[command.group];
                const showGroup = index === 0 || results[index - 1].group !== command.group;
                return (
                  <li key={command.id} role="presentation">
                    {showGroup ? (
                      <p className="sx-palette__group" role="presentation">
                        {command.group === "goTo" ? t("chrome.paletteGroupGoTo") : t("chrome.paletteGroupActions")}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      id={`student-command-${command.id}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      data-active={index === activeIndex ? "true" : "false"}
                      className="sx-palette__option"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(command)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{command.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="sx-palette__foot">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> {t("chrome.paletteKeyNavigate")}
              </span>
              <span>
                <kbd>↵</kbd> {t("chrome.paletteKeyOpen")}
              </span>
              <span>
                <kbd>esc</kbd> {t("chrome.paletteKeyClose")}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
