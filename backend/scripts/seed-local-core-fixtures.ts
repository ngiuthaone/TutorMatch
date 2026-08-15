import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Local-only browser QA fixtures for the accepted core 1:1 flow.
 *
 * Required environment:
 *   SUPABASE_URL=http://127.0.0.1:54321
 *   SUPABASE_PUBLISHABLE_KEY=<local publishable key>
 *   SUPABASE_SERVICE_ROLE_KEY=<local service-role key>
 *   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
 *
 * The service-role key is used only by this local setup command. It must never
 * be passed to Discover or stored in a frontend/runtime configuration file.
 * Password: Local-test-only-Password1!
 */

const localOnlyPassword = "Local-test-only-Password1!";
const learner = { email: "student@example.com", name: "Local Learner", role: "student" as const };
const unverifiedLearner = { email: "unverified-student@example.com", name: "Unverified Local Learner", role: "student" as const, emailConfirmed: false };
const tutorFixtures = [
  { email: "tutor@example.com", name: "Thu Ha", headline: "Cooking Instructor", bio: "I teach home cooking techniques through practical, structured lessons that help learners build confidence in the kitchen.", hourlyRateVnd: 300000, regions: ["district-1"], requiredSessions: 5 },
  { email: "minh-anh@example.com", name: "Minh Anh", headline: "Public Speaking Coach", bio: "Helped 200+ learners speak with confidence through practical speaking practice.", hourlyRateVnd: 250000, regions: ["district-1"], requiredSessions: 1 },
  { email: "huy-tran@example.com", name: "Huy Tran", headline: "Full-stack Developer", bio: "Eight years building web apps for startups and helping developers launch their careers.", hourlyRateVnd: 350000, regions: ["district-2"], requiredSessions: 1 },
  { email: "linh-nguyen@example.com", name: "Linh Nguyen", headline: "English & IELTS Coach", bio: "A focused English and IELTS coach for learners building confident academic communication.", hourlyRateVnd: 200000, regions: ["district-3"], requiredSessions: 1 },
  { email: "duc-pham@example.com", name: "Duc Pham", headline: "Photography Artist", bio: "Commercial photographer and exhibition curator teaching composition, lighting, and editing.", hourlyRateVnd: 400000, regions: ["district-5"], requiredSessions: 1 },
  { email: "quoc-anh@example.com", name: "Quoc Anh", headline: "Music Producer", bio: "A music producer helping learners build practical skills in sound design and mixing.", hourlyRateVnd: 500000, regions: ["district-1"], requiredSessions: 1 },
  { email: "ngoc-tram@example.com", name: "Ngoc Tram", headline: "Yoga & Meditation Coach", bio: "A mindful movement coach helping learners build a steady, sustainable practice.", hourlyRateVnd: 220000, regions: ["district-2"], requiredSessions: 1 },
  { email: "bao-vy@example.com", name: "Bao Vy", headline: "Business Strategy Mentor", bio: "Helping founders validate, build, and scale with clearer strategic decisions.", hourlyRateVnd: 450000, regions: ["district-4"], requiredSessions: 1 },
  { email: "ha-linh@example.com", name: "Ha Linh", headline: "Korean Language Tutor", bio: "TOPIK-focused Korean lessons with practical conversation and clear progression.", hourlyRateVnd: 180000, regions: ["district-1"], requiredSessions: 1 },
  { email: "tuan-anh@example.com", name: "Tuan Anh", headline: "Mathematics Tutor", bio: "Math and physics coaching for learners who want stronger fundamentals and confidence.", hourlyRateVnd: 150000, regions: ["district-3"], requiredSessions: 1 },
  { email: "minh-tri@example.com", name: "Minh Tri", headline: "Piano Instructor", bio: "Conservatory-trained pianist teaching practical technique, repertoire, and music theory.", hourlyRateVnd: 350000, regions: ["district-5"], requiredSessions: 1 },
  { email: "phuong-thao@example.com", name: "Phuong Thao", headline: "Graphic Design Mentor", bio: "A design lead helping learners turn visual ideas into clear, useful work.", hourlyRateVnd: 320000, regions: ["district-1"], requiredSessions: 1 },
  { email: "hoang-nam@example.com", name: "Hoang Nam", headline: "Fitness Coach", bio: "Certified personal training and nutrition guidance built around sustainable progress.", hourlyRateVnd: 280000, regions: ["district-1"], requiredSessions: 1 },
  { email: "kim-chi@example.com", name: "Kim Chi", headline: "English Conversation Coach", bio: "CELTA-informed English conversation practice for learners building fluency.", hourlyRateVnd: 190000, regions: ["district-2"], requiredSessions: 1 },
  { email: "dang-khoa@example.com", name: "Dang Khoa", headline: "Data Scientist", bio: "Practical Python and data science mentoring for projects that solve real problems.", hourlyRateVnd: 420000, regions: ["district-4"], requiredSessions: 1 },
  { email: "bao-long@example.com", name: "Bao Long", headline: "Business Strategy Mentor", bio: "Helping founders validate, build, and scale with practical strategy and growth planning.", hourlyRateVnd: 300000, regions: ["district-5"], requiredSessions: 1 },
] as const;

type TutorFixture = (typeof tutorFixtures)[number];

type FixtureUser = typeof learner | typeof unverifiedLearner | TutorFixture;
type AuthUser = { id: string; email?: string | null };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const url = required("SUPABASE_URL");
const publishableKey = required("SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = required("SUPABASE_DB_URL");
const parsedUrl = new URL(url);
if (parsedUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
  throw new Error("Refusing to seed a non-loopback Supabase URL.");
}
const parsedDbUrl = new URL(dbUrl);
if (!["localhost", "127.0.0.1"].includes(parsedDbUrl.hostname)) {
  throw new Error("Refusing to seed a non-loopback Supabase database.");
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = postgres(dbUrl, { max: 1 });

async function findUser(email: string): Promise<AuthUser | null> {
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, email: match.email };
    if (result.data.users.length < 1000) return null;
  }
  throw new Error("Could not find local auth fixture after 10 pages.");
}

async function ensureUser(fixture: FixtureUser): Promise<AuthUser> {
  const role = "role" in fixture ? fixture.role : "tutor" as const;
  const existing = await findUser(fixture.email);
  let user: AuthUser;
  if (existing) {
    const result = await admin.auth.admin.updateUserById(existing.id, {
      password: localOnlyPassword,
      email_confirm: fixture.emailConfirmed ?? true,
      user_metadata: { name: fixture.name, role },
    });
    if (result.error || !result.data.user) throw result.error ?? new Error(`Could not update ${fixture.email}`);
    user = { id: result.data.user.id, email: result.data.user.email };
  } else {
    const result = await admin.auth.admin.createUser({
      email: fixture.email,
      password: localOnlyPassword,
      email_confirm: fixture.emailConfirmed ?? true,
      user_metadata: { name: fixture.name, role },
    });
    if (result.error || !result.data.user) throw result.error ?? new Error(`Could not create ${fixture.email}`);
    user = { id: result.data.user.id, email: result.data.user.email };
  }

  await sql`
    insert into public.profiles (id, role, name)
    values (${user.id}, ${role}, ${fixture.name})
    on conflict (id) do update set role = excluded.role, name = excluded.name
  `;
  return user;
}

async function authenticatedClient(email: string): Promise<SupabaseClient> {
  const result = await anon.auth.signInWithPassword({ email, password: localOnlyPassword });
  if (result.error || !result.data.session) throw result.error ?? new Error(`Could not sign in ${email}`);
  return createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${result.data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tutorProfileFor(tutor: TutorFixture) {
  return {
  displayName: tutor.name,
  headline: tutor.headline,
  bio: `${tutor.bio} This local profile is part of the deterministic Tutor discovery fixture.`,
  hourlyRateVnd: tutor.hourlyRateVnd,
  currency: "VND",
  teachingFormat: "online",
  // The local schema's accepted seed catalog has no cooking subject; English
  // keeps the published CV valid while the fixture identity remains Thu Ha.
  subjects: ["english"],
  levels: ["adult"],
  regions: ["district-1"],
  languages: [
    { code: "vi", displayName: "Vietnamese", proficiency: "native" },
    { code: "en", displayName: "English", proficiency: "professional" },
  ],
  availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00", timezone: "Asia/Ho_Chi_Minh" }],
  education: [],
  experience: [],
  };
}

async function ensureTutorProfile(tutorClient: SupabaseClient, tutor: TutorFixture): Promise<{ id: string; version: number }> {
  const current = await tutorClient.rpc("get_my_tutor_cv");
  if (current.error) throw current.error;
  const saved = await tutorClient.rpc("save_my_tutor_cv", {
    payload: tutorProfileFor(tutor),
    expected_version: current.data?.version ?? null,
  });
  if (saved.error || !saved.data) throw saved.error ?? new Error("Could not save tutor fixture profile");
  const published = await tutorClient.rpc("publish_my_tutor_cv", { expected_version: saved.data.version });
  if (published.error || !published.data) throw published.error ?? new Error("Could not publish tutor fixture profile");
  return { id: published.data.id, version: published.data.version };
}

async function ensureSessions(tutorClient: SupabaseClient, tutorUserId: string, requiredSessions: number): Promise<string[]> {
  const existing = await sql`
    select id, max_participants
    from public.sessions
    where host_id = ${tutorUserId} and status = 'scheduled' and starts_at > now()
    order by starts_at asc
    limit 10
  `;

  const available: string[] = [];
  for (const session of existing) {
    const bookings = await sql`
      select coalesce(sum(participant_count), 0)::int as reserved
      from public.bookings
      where session_id = ${session.id} and status in ('requested', 'confirmed')
    `;
    const reserved = bookings[0]?.reserved ?? 0;
    if (reserved < (session.max_participants ?? 0)) available.push(session.id);
    if (available.length >= requiredSessions) return available;
  }

  const newIds: string[] = [];
  for (const offsetHours of [24, 25.5, 48, 53, 72]) {
    if (available.length + newIds.length >= requiredSessions) break;
    const startsAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const result = await tutorClient.rpc("create_session", {
      payload: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), maxParticipants: 5 },
    });
    if (result.error || !result.data?.id) throw result.error ?? new Error("Could not create tutor fixture session");
    newIds.push(result.data.id);
  }
  return [...available, ...newIds].slice(0, requiredSessions);
}

const learnerUser = await ensureUser(learner);
const unverifiedLearnerUser = await ensureUser(unverifiedLearner);
const seededTutors = [];
for (const tutor of tutorFixtures) {
  const tutorUser = await ensureUser(tutor);
  const tutorClient = await authenticatedClient(tutor.email);
  const profile = await ensureTutorProfile(tutorClient, tutor);
  const sessions = await ensureSessions(tutorClient, tutorUser.id, tutor.requiredSessions);
  seededTutors.push({ tutor, profile, sessions });
}

console.log(JSON.stringify({
  learner: { email: learner.email, role: learner.role, userId: learnerUser.id },
  unverifiedLearner: { email: unverifiedLearner.email, role: unverifiedLearner.role, userId: unverifiedLearnerUser.id },
  tutors: seededTutors.map(({ tutor, profile, sessions }) => ({ email: tutor.email, name: tutor.name, role: "tutor", profileId: profile.id, sessions })),
}, null, 2));
await sql.end();
