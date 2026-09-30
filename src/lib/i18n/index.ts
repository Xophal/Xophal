import { en } from "./en";

/**
 * Localization-ready text layer for the student dashboard.
 *
 * The dashboard ships with English only. Assamese and Hindi are part of the
 * product plan, so the architecture (typed keys, a locale resolver and a
 * translator factory) is already in place: adding `as.ts` / `hi.ts` and listing
 * the locale below is the only work left for a new language. Because the
 * component layer only ever calls `t("some.key")`, no component needs editing
 * and no string is buried inside markup.
 */
export const SUPPORTED_LOCALES = ["en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export type TextKey = keyof typeof en;

export type TextParams = Record<string, string | number>;

type Dictionary = Record<TextKey, string>;

const dictionaries: Record<Locale, Dictionary> = { en };

export type LanguageOption = { code: Locale; label: string; nativeLabel: string };

/** Only languages with a complete dictionary are advertised in the UI. */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
];

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Falls back to the default locale instead of throwing on unknown values. */
export function resolveLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/** Locale codes are compared case-insensitively, e.g. `en-IN` -> `en`. */
export function resolveLocaleFromTag(tag: string | null | undefined): Locale {
  if (!tag) return DEFAULT_LOCALE;
  const base = tag.split(/[-_]/)[0]?.toLowerCase();
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

function interpolate(template: string, params?: TextParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

/** Translate a key. Unknown locales fall back to English. */
export function t(key: TextKey, params?: TextParams, locale: Locale = DEFAULT_LOCALE): string {
  const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const template = dictionary[key] ?? en[key] ?? key;
  return interpolate(template, params);
}

/** Bind a locale once (used by server components) and translate by key. */
export function createTranslator(locale: Locale = DEFAULT_LOCALE) {
  return (key: TextKey, params?: TextParams) => t(key, params, locale);
}

export type Translator = ReturnType<typeof createTranslator>;
