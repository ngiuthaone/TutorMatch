import { randomUUID } from "node:crypto"; import { readFile } from "node:fs/promises"; import { fileURLToPath } from "node:url"; import { createClient } from "@supabase/supabase-js"; import postgres from "postgres"; import { afterAll, beforeAll, describe, expect, it } from "vitest"; import { signUpConfirmed } from "./auth-helpers.js";
const url = process.env.SUPABASE_TEST_URL, key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY, dbUrl = process.env.SUPABASE_TEST_DB_URL, serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!url || !key || !dbUrl || !serviceKey) throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if (!["localhost", "127.0.0.1", "host.docker.internal"].includes(new URL(url).hostname)) throw new Error("Refusing to run integration tests against a non-local Supabase target.");
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sql = postgres(dbUrl, { max: 1 });
const password = "Local-test-only-Password1!";
async function signup(role: "student" | "tutor") { const email = `cv2-${randomUUID()}@example.test`; return signUpConfirmed({ anon, url: url!, publishableKey: key!, serviceRoleKey: serviceKey!, email, password, metadata: { name: "CV Full", role }, trustedTutor: role === "tutor" }); }

const full = {
  displayName: "Nguyen Minh Anh", headline: "Patient mathematics tutor", 
  bio: "I provide patient and structured mathematics lessons with clear examples and practice for secondary students learning in a supportive environment.",
  role: "Maths coach", hourlyRateVnd: 300000, currency: "VND", teachingFormat: "in_person",
  subjects: ["mathematics"], levels: ["lower_secondary"], regions: ["district-1"],
  languages: [{ code: "vi", displayName: "Vietnamese", proficiency: "native" }],
  availability: [{ dayOfWeek: 1, startTime: "18:00", endTime: "20:00", timezone: "Asia/Ho_Chi_Minh" }],
  education: [], experience: [],
  portfolioUrl: "https://coach.example", lessonDescription: "Each lesson begins with a short review, then we work through structured practice problems together and finish with a recap.",
  policies: { learnerCancellation: "24 hours notice", lateCancellation: "Within 24 hours is charged half", noShow: "Full rate", bookingNotice: "12 hours", bookingWindowDays: 60, lessonBufferMin: 10, sameDayBooking: true },
  rates: { "60": 300000, "90": 420000 }, displayDuration: 60,
  consultation: { enabled: true, duration: "15 minutes", price: "Free", purpose: "Discuss goals and compatibility" },
  credentials: [{ title: "BSc Mathematics", evidenceUrl: "https://diploma.example" }],
  goals: ["Pass the county finals", "Build study confidence"],
  teachingStyles: ["Structured practice problems", "Video feedback"],
  ageGroups: ["Secondary students", "Exam candidates"],
  faqs: [{ question: "Do you provide materials?", answer: "Yes, worksheets after each lesson." }],
};

describe.sequential("local tutor CV full fields, media moderation RLS", () => {
  beforeAll(async () => {
    for (const name of ["0001_create_profiles.sql", "0002_create_tutor_cvs.sql", "20260822000000_tutor_profile_media_and_full_fields.sql"]) {
      const migration = await readFile(fileURLToPath(new URL(`../supabase/migrations/${name}`, import.meta.url)), "utf8");
      await sql.unsafe(migration);
    }
  });

  it("persists every form field and round-trips them via get_my_tutor_cv", async () => {
    const t = await signup("tutor");
    const saved = await t.client.rpc("save_my_tutor_cv", { payload: full, expected_version: null });
    expect(saved.error).toBeNull();
    expect(saved.data.role).toBe("Maths coach");
    expect(saved.data.portfolioUrl).toBe("https://coach.example");
    expect(saved.data.lessonDescription).toContain("structured practice problems");
    expect(saved.data.policies.learnerCancellation).toBe("24 hours notice");
    expect(saved.data.policies.bookingWindowDays).toBe(60);
    expect(saved.data.rates["60"]).toBe(300000);
    expect(saved.data.displayDuration).toBe(60);
    expect(saved.data.consultation.duration).toBe("15 minutes");
    expect(saved.data.credentials[0].title).toBe("BSc Mathematics");
    expect(saved.data.goals).toContain("Pass the county finals");
    expect(saved.data.teachingStyles).toContain("Structured practice problems");
    expect(saved.data.ageGroups).toContain("Secondary students");
    expect(saved.data.faqs[0].question).toContain("materials");

    const refetch = await t.client.rpc("get_my_tutor_cv");
    expect(refetch.error).toBeNull();
    expect(refetch.data.role).toBe("Maths coach");
    expect(refetch.data.ageGroups).toEqual(full.ageGroups);
    expect(refetch.data.verified).toBe(false);
  });

  it("publishability is gated on the new required fields", async () => {
    const t = await signup("tutor");
    const minimal = { displayName: "X Van A", headline: "Maths teacher here", bio: "I teach mathematics patiently with structured practice for secondary students over a long and detailed period.", hourlyRateVnd: 200000, currency: "VND", teachingFormat: "online", subjects: ["mathematics"], levels: ["lower_secondary"], regions: [], languages: [{ code: "vi", displayName: "Vietnamese", proficiency: "native" }], availability: [{ dayOfWeek: 0, startTime: "09:00", endTime: "11:00", timezone: "Asia/Ho_Chi_Minh" }], education: [], experience: [], role: "Coach", lessonDescription: "Structured practice with clear examples for secondary students in a supportive style.", policies: {}, rates: { "60": 200000 }, displayDuration: 60, consultation: { enabled: false }, credentials: [], goals: [], teachingStyles: [], ageGroups: ["Secondary students"], faqs: [] };
    const noAge = await t.client.rpc("save_my_tutor_cv", { payload: { ...minimal, ageGroups: [] }, expected_version: null });
    expect(noAge.error).toBeNull();
    expect(noAge.data.verificationStatus).toBe("none");
    const pub = await t.client.rpc("publish_my_tutor_cv", { expected_version: noAge.data.version });
    expect(pub.error).toBeTruthy();
  });

  it("media: tutor can submit a pending submission but cannot self-approve", async () => {
    const t = await signup("tutor");
    const saved = await t.client.rpc("save_my_tutor_cv", { payload: full, expected_version: null });
    const path = `${t.user.id}/profile.webp`;
    const sub = await t.client.rpc("submit_tutor_media", { p_kind: "photo", p_object_path: path, p_mime: "image/webp", p_size_bytes: 200000 });
    expect(sub.error).toBeNull();
    expect(sub.data.status).toBe("pending");

    const direct = await t.client.from("media_submissions").insert({ user_id: t.user.id, kind: "photo", bucket: "avatars", object_path: path, mime: "image/webp", size_bytes: 100, status: "approved" });
    expect(direct.error).toBeTruthy();

    const mine = await t.client.rpc("get_my_tutor_media");
    expect(mine.error).toBeNull();
    expect(mine.data.some((m: any) => m.objectPath === path)).toBe(true);
    expect(mine.data.find((m: any) => m.objectPath === path).status).toBe("pending");

    await expect(t.client.rpc("moderate_tutor_media", { p_submission_id: sub.data.id, p_status: "approved", p_note: "fine" })).resolves.toMatchObject({ data: null });
  });

  it("media: admin/service-role approval makes it visible on the published profile", async () => {
    const t = await signup("tutor");
    const saved = await t.client.rpc("save_my_tutor_cv", { payload: full, expected_version: null });
    const sub = await t.client.rpc("submit_tutor_media", { p_kind: "photo", p_object_path: `${t.user.id}/headshot.jpg`, p_mime: "image/jpeg", p_size_bytes: 150000 });
    expect(sub.error).toBeNull();
    const decided = await service.rpc("moderate_tutor_media", { p_submission_id: sub.data.id, p_status: "approved", p_note: "ok" });
    expect(decided.error).toBeNull();
    expect(decided.data.status).toBe("approved");
    const pub = await t.client.rpc("publish_my_tutor_cv", { expected_version: saved.data.version });
    expect(pub.error).toBeNull();
    expect(pub.data.avatarUrl).toContain(`${t.user.id}/headshot.jpg`);
  });

  it("rejects contact information in the new free-text fields", async () => {
    const t = await signup("tutor");
    const bad = await t.client.rpc("save_my_tutor_cv", { payload: { ...full, role: "Call 0901 234 567" }, expected_version: null });
    expect(bad.error).toBeTruthy();
  });

  it("public read exposes no user_id and only approved media object paths", async () => {
    const t = await signup("tutor");
    const saved = await t.client.rpc("save_my_tutor_cv", { payload: full, expected_version: null });
    const sub = await t.client.rpc("submit_tutor_media", { p_kind: "photo", p_object_path: `${t.user.id}/approved.webp`, p_mime: "image/webp", p_size_bytes: 90000 });
    const sub2 = await t.client.rpc("submit_tutor_media", { p_kind: "photo", p_object_path: `${t.user.id}/pending.webp`, p_mime: "image/webp", p_size_bytes: 90000 });
    await service.rpc("moderate_tutor_media", { p_submission_id: sub.data.id, p_status: "approved", p_note: "ok" });
    const pub = await t.client.rpc("publish_my_tutor_cv", { expected_version: saved.data.version });
    expect(pub.error).toBeNull();
    const visible = await anon.rpc("get_published_tutor", { tutor_profile_id: pub.data.id });
    expect(visible.error).toBeNull();
    expect(JSON.stringify(visible.data)).not.toMatch(/user_id/);
    expect(JSON.stringify(visible.data)).toContain(`${t.user.id}/approved.webp`);
    expect(JSON.stringify(visible.data)).not.toContain("pending.webp");
  });
});

afterAll(() => sql.end());
