import { describe, expect, it } from "vitest";

import type { BackendTutorProfile } from "@/lib/tutor-cv-api";
import { backendProfileToDraft, draftToBackendProfile, formatBackendAvailability, type TutorProfileInput } from "@/lib/tutor-cv-mapper";

function validDraft(): TutorProfileInput {
  return {
    displayName: "Nguyen Van An",
    city: "Ha Noi",
    location: "Hoan Kiem",
    headline: "Patient math tutor for secondary students",
    about: "I have been teaching mathematics for six years and focus on building confidence.",
    professionalBackground: "Former high school teacher.",
    skills: ["mathematics"],
    learnerLevels: ["Intermediate learners"],
    ageGroups: ["High school students"],
    languages: ["Vietnamese (native)", "English (professional)"],
    lessonFormat: ["Online", "At learners' location"],
    sessionLengths: [60],
    rates: { "60": 300000 },
    displayDuration: 60,
    timeSlots: ["09:00-10:00"],
    availability: ["09:00-10:00-3", "09:00-10:00-5"],
    timeZone: "GMT+7 - Asia/Bangkok",
  };
}

describe("draftToBackendProfile", () => {
  it("derives hourly rate from the session rate and length", () => {
    const profile = draftToBackendProfile(validDraft());
    expect(profile.hourlyRateVnd).toBe(300000);
    expect(profile.currency).toBe("VND");
  });

  it("derives null hourly rate when no session rate is set", () => {
    const draft = { ...validDraft(), rates: {}, displayDuration: 60 };
    expect(draftToBackendProfile(draft).hourlyRateVnd).toBeNull();
  });

  it("maps lesson formats to backend teaching format", () => {
    expect(draftToBackendProfile(validDraft()).teachingFormat).toBe("both");
    expect(draftToBackendProfile({ ...validDraft(), lessonFormat: ["Online"] }).teachingFormat).toBe("online");
    expect(draftToBackendProfile({ ...validDraft(), lessonFormat: ["At learners' location"] }).teachingFormat).toBe("in_person");
    expect(draftToBackendProfile({ ...validDraft(), lessonFormat: [] }).teachingFormat).toBeNull();
  });

  it("maps learner levels and age groups to backend level codes", () => {
    const profile = draftToBackendProfile({
      ...validDraft(),
      learnerLevels: ["Complete beginners", "Intermediate learners"],
      ageGroups: ["University students"],
    });
    expect(profile.levels).toContain("beginner");
    expect(profile.levels).toContain("university");
    expect(profile.levels).toContain("intermediate");
  });

  it("parses numeric and day-name availability keys", () => {
    const profile = draftToBackendProfile({
      ...validDraft(),
      availability: ["09:00-10:00-3", "10:00-11:00-Sat"],
    });
    expect(profile.availability).toHaveLength(2);
    expect(profile.availability[0]).toMatchObject({ dayOfWeek: 3, startTime: "09:00", endTime: "10:00", timezone: "Asia/Bangkok" });
    expect(profile.availability[1]).toMatchObject({ dayOfWeek: 5, startTime: "10:00", endTime: "11:00" });
  });

  it("ignores malformed availability keys", () => {
    const profile = draftToBackendProfile({
      ...validDraft(),
      availability: ["09:00-10:00-9", "bad", "09:00-10:00"],
    });
    expect(profile.availability).toHaveLength(0);
  });

  it("maps languages to codes with proficiency, deduplicating by code", () => {
    const profile = draftToBackendProfile({
      ...validDraft(),
      languages: ["English (fluent)", "ENGLISH (native)", "Vietnamese (native)", "Unknown (native)"],
    });
    expect(profile.languages).toHaveLength(2);
    expect(profile.languages[0]).toMatchObject({ code: "en", displayName: "English", proficiency: "professional" });
    expect(profile.languages[1]).toMatchObject({ code: "vi", proficiency: "native" });
  });

  it("builds a regions list from location and city without inventing extra data", () => {
    const profile = draftToBackendProfile(validDraft());
    expect(profile.regions).toEqual(["Hoan Kiem, Ha Noi"]);
    expect(draftToBackendProfile({ ...validDraft(), city: "", location: "" }).regions).toEqual([]);
  });

  it("caps array sizes to backend schema limits", () => {
    const profile = draftToBackendProfile({
      ...validDraft(),
      skills: Array.from({ length: 20 }, (_, index) => `subject-${index}`),
    });
    expect(profile.subjects.length).toBeLessThanOrEqual(10);
  });

  it("does not fabricate education or experience entries", () => {
    const profile = draftToBackendProfile(validDraft());
    expect(profile.education).toEqual([]);
    expect(profile.experience).toEqual([]);
  });
});

describe("backendProfileToDraft", () => {
  const profile: BackendTutorProfile = {
    displayName: "Nguyen Van An",
    headline: "Patient math tutor",
    bio: "About text.",
    hourlyRateVnd: 300000,
    currency: "VND",
    teachingFormat: "both",
    subjects: ["mathematics"],
    levels: ["intermediate", "university"],
    regions: ["Hoan Kiem, Ha Noi"],
    languages: [{ code: "vi", displayName: "Vietnamese", proficiency: "native" }],
    availability: [
      { dayOfWeek: 3, startTime: "09:00", endTime: "10:00", timezone: "Asia/Bangkok" },
      { dayOfWeek: 5, startTime: "10:00", endTime: "11:00", timezone: "Asia/Bangkok" },
    ],
    education: [],
    experience: [],
  };

  it("maps backend levels to learner level labels without inventing codes", () => {
    const draft = backendProfileToDraft(profile);
    expect(draft.learnerLevels).toContain("Intermediate learners");
    expect(draft.learnerLevels).toContain("University students");
    expect(draft.learnerLevels).not.toContain("Made-up level");
  });

  it("maps languages to display labels with proficiency", () => {
    const draft = backendProfileToDraft(profile);
    expect(draft.languages).toContain("Vietnamese (Native)");
  });

  it("reconstructs availability keys in onboarding format (numeric day index)", () => {
    const draft = backendProfileToDraft(profile);
    expect(draft.availability).toEqual(["09:00-10:00-3", "10:00-11:00-5"]);
    expect(draft.timeSlots).toEqual(["09:00-10:00", "10:00-11:00"]);
  });

  it("reconstructs rates and session lengths from the hourly rate", () => {
    const draft = backendProfileToDraft(profile);
    expect(draft.displayDuration).toBe(60);
    expect(draft.sessionLengths).toContain(60);
    expect(draft.rates?.["60"]).toBe(300000);
  });

  it("round-trips through draftToBackendProfile without dropping availability", () => {
    const mapped = draftToBackendProfile(backendProfileToDraft(profile) as TutorProfileInput);
    expect(mapped.availability).toHaveLength(2);
    expect(mapped.availability.map((slot) => slot.dayOfWeek).sort()).toEqual([3, 5]);
  });

  it("maps timezone to a label and falls back to GMT+7 default", () => {
    const draft = backendProfileToDraft(profile);
    expect(draft.timeZone).toBe("GMT+7 - Asia/Bangkok");
    const noTz = backendProfileToDraft({ ...profile, availability: [] });
    expect(noTz.timeZone).toBe("GMT+7 - Asia/Bangkok");
  });

  it("returns empty skill list when subjects are absent", () => {
    const draft = backendProfileToDraft({ ...profile, subjects: [] });
    expect(draft.skills).toEqual([]);
  });
});

describe("formatBackendAvailability", () => {
  it("produces time slots and day-indexed availability keys", () => {
    const { timeSlots, availability } = formatBackendAvailability([
      { dayOfWeek: 1, startTime: "09:00", endTime: "10:00", timezone: "Asia/Bangkok" },
      { dayOfWeek: 1, startTime: "14:00", endTime: "15:00", timezone: "Asia/Bangkok" },
    ]);
    expect(timeSlots).toEqual(["09:00-10:00", "14:00-15:00"]);
    expect(availability).toEqual(["09:00-10:00-1", "14:00-15:00-1"]);
  });

  it("deduplicates identical time ranges", () => {
    const { timeSlots } = formatBackendAvailability([
      { dayOfWeek: 2, startTime: "09:00", endTime: "10:00", timezone: "UTC" },
      { dayOfWeek: 4, startTime: "09:00", endTime: "10:00", timezone: "UTC" },
    ]);
    expect(timeSlots).toEqual(["09:00-10:00"]);
  });
});
