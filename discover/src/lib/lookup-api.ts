import { getSessionAccessToken } from "./auth/session";

export interface LookupOptions {
  languages: string[];
  categories: string[];
  levels: string[];
}

const FALLBACK_LANGUAGES = [
  "English", "Vietnamese", "French", "German", "Spanish",
  "Japanese", "Korean", "Portuguese", "Italian", "Indonesian", "Thai",
];

const FALLBACK_CATEGORIES = [
  "Development", "Business", "Finance & Accounting", "Food & Beverage",
  "IT & Software", "Office Productivity", "Personal Development", "Design",
  "Marketing", "Lifestyle", "Photography & Video", "Health & Fitness", "Music",
  "Teaching & Academics",
];

const FALLBACK_LEVELS = ["Beginner Level", "Intermediate Level", "Expert Level", "All Levels"];

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toLookupOptions(data: { items?: unknown[] }): LookupOptions {
  const items = Array.isArray(data.items) ? data.items : [];
  const languages = sortUnique(
    items.flatMap((item) => {
      const langs = (item as { languages?: { displayName?: unknown }[] }).languages;
      return Array.isArray(langs) ? toStringArray(langs.map((l) => l.displayName)) : [];
    }),
  );
  const categories = sortUnique(
    items.flatMap((item) => toStringArray((item as { subjects?: unknown[] }).subjects)),
  );
  const levels = sortUnique(
    items.flatMap((item) => toStringArray((item as { levels?: unknown[] }).levels)),
  );
  return {
    languages: languages.length ? languages : FALLBACK_LANGUAGES,
    categories: categories.length ? categories : FALLBACK_CATEGORIES,
    levels: levels.length ? levels : FALLBACK_LEVELS,
  };
}

export async function getLookupOptions(): Promise<LookupOptions> {
  try {
    const base = process.env.NEXT_PUBLIC_TUTORIA_API_BASE_URL ?? "http://127.0.0.1:4000";
    const token = getSessionAccessToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}/api/v1/tutors?limit=24`, { cache: "no-store", headers });
    if (!response.ok) return { languages: FALLBACK_LANGUAGES, categories: FALLBACK_CATEGORIES, levels: FALLBACK_LEVELS };
    const data = (await response.json()) as { ok?: boolean; items?: unknown[] };
    if (data.ok !== true) return { languages: FALLBACK_LANGUAGES, categories: FALLBACK_CATEGORIES, levels: FALLBACK_LEVELS };
    return toLookupOptions(data);
  } catch {
    return { languages: FALLBACK_LANGUAGES, categories: FALLBACK_CATEGORIES, levels: FALLBACK_LEVELS };
  }
}
