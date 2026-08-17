"use client";

import type { BackendTutorAvailability, BackendTutorLanguage, BackendTutorProfile } from "./tutor-cv-api";

export interface TutorProfileInput {
  displayName: string;
  city: string;
  location: string;
  headline: string;
  about: string;
  professionalBackground: string;
  skills: string[];
  learnerLevels: string[];
  ageGroups: string[];
  languages: string[];
  lessonFormat: string[];
  sessionLengths: number[];
  rates: Record<string, number>;
  displayDuration: number | null;
  timeSlots: string[];
  availability: string[];
  timeZone: string;
}

const LEVEL_LABEL_TO_CODE = new Map<string, string>([
  ["Complete beginners", "beginner"],
  ["Intermediate learners", "intermediate"],
  ["Advanced learners", "advanced"],
  ["Professional practitioners", "advanced"],
  ["Developing learners", "beginner"],
  ["First-time coders", "beginner"],
  ["Junior developers", "intermediate"],
  ["Career switchers", "beginner"],
  ["A2 learners", "beginner"],
  ["Experienced presenters", "advanced"],
  ["Developing speakers", "intermediate"],
  ["Developing photographers", "intermediate"],
  ["Portfolio builders", "advanced"],
  ["First-time cooks", "beginner"],
  ["Confident home cooks", "intermediate"],
  ["Aspiring professionals", "advanced"],
  ["New producers", "beginner"],
  ["Developing artists", "intermediate"],
  ["Release-ready musicians", "advanced"],
  ["Returning practitioners", "intermediate"],
  ["Regular practitioners", "advanced"],
  ["Aspiring founders", "intermediate"],
  ["Early-stage teams", "advanced"],
  ["Growing operators", "advanced"],
]);

const CODE_TO_LEVEL_LABEL: Record<string, string> = {
  primary: "Primary school ages",
  lower_secondary: "Lower secondary ages",
  upper_secondary: "Upper secondary ages",
  university: "University students",
  adult: "Adults",
  beginner: "Complete beginners",
  intermediate: "Intermediate learners",
  advanced: "Advanced learners",
  exam_preparation: "Exam preparation",
};

function ageGroupToLevel(value: string): string | null {
  const lowered = value.toLowerCase();
  if (/(children|kids|child|young)/.test(lowered)) return "primary";
  if (/(teen|high school|secondary)/.test(lowered)) return "upper_secondary";
  if (/(universit|college|student)/.test(lowered)) return "university";
  if (/(professional|founder|leader|working|team|operator)/.test(lowered)) return "adult";
  if (/(beginner|first-time|new)/.test(lowered)) return "beginner";
  if (/(intermediate|returning|developing)/.test(lowered)) return "intermediate";
  if (/(advanced|regular|aspiring)/.test(lowered)) return "advanced";
  return null;
}

function mapLevels(draft: TutorProfileInput): string[] {
  const codes = new Set<string>();
  draft.learnerLevels.forEach((level) => {
    const code = LEVEL_LABEL_TO_CODE.get(level);
    if (code) codes.add(code);
  });
  draft.ageGroups.forEach((group) => {
    const code = ageGroupToLevel(group);
    if (code) codes.add(code);
  });
  if (codes.size === 0 && draft.learnerLevels.length > 0) codes.add("beginner");
  return [...codes].slice(0, 10);
}

const PROFICIENCY_BY_LABEL = new Map<string, "basic" | "conversational" | "professional" | "native">([
  ["basic", "basic"],
  ["conversational", "conversational"],
  ["conversation", "conversational"],
  ["beginner", "basic"],
  ["fluent", "professional"],
  ["professional", "professional"],
  ["native", "native"],
]);

const LANGUAGE_NAME_TO_CODE = new Map<string, string>([
  ["vietnamese", "vi"],
  ["english", "en"],
  ["french", "fr"],
  ["german", "de"],
  ["spanish", "es"],
  ["japanese", "ja"],
  ["korean", "ko"],
  ["chinese", "zh"],
  ["mandarin", "zh"],
  ["cantonese", "zh-CN"],
  ["korean", "ko"],
  ["thai", "th"],
  ["italian", "it"],
  ["portuguese", "pt"],
  ["russian", "ru"],
  ["indonesian", "id"],
  ["arabic", "ar"],
  ["hindi", "hi"],
  ["turkish", "tr"],
  ["dutch", "nl"],
]);

function parseLanguage(value: string): BackendTutorLanguage | null {
  const match = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(value.trim());
  const rawName = (match ? match[1] : value).trim();
  const proficiencyRaw = match ? match[2].trim().toLowerCase() : "conversational";
  const proficiency = PROFICIENCY_BY_LABEL.get(proficiencyRaw) ?? "conversational";
  const code = LANGUAGE_NAME_TO_CODE.get(rawName.toLowerCase());
  if (!code) return null;
  return { code, displayName: rawName, proficiency };
}

const TIMEZONE_LABEL_TO_IANA = new Map<string, string>([
  ["GMT+7 - Asia/Bangkok", "Asia/Bangkok"],
  ["GMT+8 - Asia/Singapore", "Asia/Singapore"],
  ["GMT+9 - Asia/Tokyo", "Asia/Tokyo"],
  ["UTC - Coordinated Universal Time", "UTC"],
]);

const TIMEZONE_TO_LABEL = new Map<string, string>([
  ["Asia/Bangkok", "GMT+7 - Asia/Bangkok"],
  ["Asia/Singapore", "GMT+8 - Asia/Singapore"],
  ["Asia/Tokyo", "GMT+9 - Asia/Tokyo"],
  ["UTC", "UTC - Coordinated Universal Time"],
]);

function timezoneToIana(label: string): string {
  return TIMEZONE_LABEL_TO_IANA.get(label.trim()) ?? "Asia/Bangkok";
}

export function formatBackendAvailability(slots: BackendTutorAvailability[]): { timeSlots: string[]; availability: string[] } {
  const timeSlots = new Set<string>();
  const availability: string[] = [];
  for (const slot of slots) {
    const range = `${slot.startTime}-${slot.endTime}`;
    timeSlots.add(range);
    availability.push(`${range}-${slot.dayOfWeek}`);
  }
  return { timeSlots: [...timeSlots], availability };
}

export function draftToBackendProfile(draft: TutorProfileInput): BackendTutorProfile {
  const sessionLength = draft.displayDuration ?? draft.sessionLengths[0] ?? null;
  const sessionRate = sessionLength ? Number(draft.rates[String(sessionLength)] || 0) : null;
  const hourlyRateVnd =
    sessionLength && sessionRate && sessionLength > 0
      ? Math.round((sessionRate * 60) / sessionLength)
      : null;

  const formats = draft.lessonFormat ?? [];
  const online = formats.includes("Online");
  const inPerson = formats.some((format) => format !== "Online");
  const teachingFormat: BackendTutorProfile["teachingFormat"] =
    online && inPerson ? "both" : online ? "online" : inPerson ? "in_person" : null;

  const regions = [draft.location && draft.city ? `${draft.location}, ${draft.city}` : (draft.location || draft.city)].filter(Boolean);

  const languages: BackendTutorLanguage[] = [];
  for (const raw of draft.languages ?? []) {
    const parsed = parseLanguage(raw);
    if (parsed && !languages.some((item) => item.code === parsed.code)) languages.push(parsed);
  }

  const dayToIndex = new Map<string, number>([
    ["Mon", 0], ["Tue", 1], ["Wed", 2], ["Thu", 3], ["Fri", 4], ["Sat", 5], ["Sun", 6],
  ]);
  const availability: BackendTutorAvailability[] = [];
  for (const key of draft.availability ?? []) {
    const dashIndex = key.lastIndexOf("-");
    const slot = key.slice(0, dashIndex);
    const dayLabel = key.slice(dashIndex + 1);
    const dayIndex = dayToIndex.get(dayLabel) ?? (/^\d$/.test(dayLabel) ? Number(dayLabel) : undefined);
    const match = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(slot);
    if (dayIndex === undefined || !match || dayIndex < 0 || dayIndex > 6) continue;
    availability.push({
      dayOfWeek: dayIndex,
      startTime: match[1],
      endTime: match[2],
      timezone: timezoneToIana(draft.timeZone),
    });
  }

  const bio = [draft.about, draft.professionalBackground].filter(Boolean).join("\n\n");

  return {
    displayName: draft.displayName,
    headline: draft.headline || null,
    bio: bio || null,
    hourlyRateVnd,
    currency: "VND",
    teachingFormat,
    subjects: (draft.skills ?? []).slice(0, 10),
    levels: mapLevels(draft),
    regions: regions.slice(0, 20),
    languages: languages.slice(0, 8),
    availability: [...availability].slice(0, 28),
    education: [],
    experience: [],
  };
}

export function backendProfileToDraft(profile: BackendTutorProfile): Partial<TutorProfileInput> {
  const languages: string[] = (profile.languages ?? []).map((lang) => `${lang.displayName} (${capitalize(lang.proficiency)})`);

  const { timeSlots, availability } = formatBackendAvailability(profile.availability ?? []);

  const learnerLevels: string[] = [];
  for (const code of profile.levels ?? []) {
    const label = CODE_TO_LEVEL_LABEL[code];
    if (label && !learnerLevels.includes(label)) learnerLevels.push(label);
  }

  const hourly = profile.hourlyRateVnd ?? null;
  const rates: Record<string, number> = {};
  const sessionLengths: number[] = [];
  let displayDuration: number | null = null;
  if (hourly && hourly > 0) {
    for (const duration of [30, 50, 60, 90]) {
      rates[String(duration)] = Math.round((hourly * duration) / 60);
    }
    sessionLengths.push(60);
    displayDuration = 60;
  }

  const regions = profile.regions ?? [];
  let city = "";
  let location = "";
  const first = regions[0] ?? "";
  const comma = first.indexOf(",");
  if (comma >= 0) {
    location = first.slice(0, comma).trim();
    city = first.slice(comma + 1).trim();
  } else {
    city = first;
  }

  const tzName = profile.availability?.[0]?.timezone;
  const timeZone = tzName ? (TIMEZONE_TO_LABEL.get(tzName) ?? tzName) : "GMT+7 - Asia/Bangkok";

  return {
    displayName: profile.displayName,
    headline: profile.headline || "",
    about: profile.bio || "",
    professionalBackground: "",
    city,
    location,
    skills: (profile.subjects ?? []).filter(Boolean),
    learnerLevels,
    ageGroups: [],
    languages,
    lessonFormat: formatTeachingFromBackend(profile.teachingFormat),
    sessionLengths,
    rates,
    displayDuration,
    timeSlots,
    availability,
    timeZone,
  };
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatTeachingFromBackend(format: BackendTutorProfile["teachingFormat"]): string[] {
  const formats: string[] = [];
  if (format === "online" || format === "both") formats.push("Online");
  if (format === "in_person" || format === "both") {
    formats.push("At learners' location", "At my teaching space", "Public place");
  }
  if (formats.length === 0) formats.push("Online", "At learners' location", "At my teaching space", "Public place");
  return formats;
}