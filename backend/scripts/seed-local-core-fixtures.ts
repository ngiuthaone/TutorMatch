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
const tutor = { email: "tutor@example.com", name: "Local Tutor", role: "tutor" as const };

type FixtureUser = typeof learner | typeof tutor;
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
  const existing = await findUser(fixture.email);
  let user: AuthUser;
  if (existing) {
    const result = await admin.auth.admin.updateUserById(existing.id, {
      password: localOnlyPassword,
      email_confirm: true,
      user_metadata: { name: fixture.name, role: fixture.role },
    });
    if (result.error || !result.data.user) throw result.error ?? new Error(`Could not update ${fixture.email}`);
    user = { id: result.data.user.id, email: result.data.user.email };
  } else {
    const result = await admin.auth.admin.createUser({
      email: fixture.email,
      password: localOnlyPassword,
      email_confirm: true,
      user_metadata: { name: fixture.name, role: fixture.role },
    });
    if (result.error || !result.data.user) throw result.error ?? new Error(`Could not create ${fixture.email}`);
    user = { id: result.data.user.id, email: result.data.user.email };
  }

  await sql`
    insert into public.profiles (id, role, name)
    values (${user.id}, ${fixture.role}, ${fixture.name})
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

const tutorProfile = {
  displayName: tutor.name,
  headline: "Patient IELTS conversation tutor",
  bio: "I help adult learners build confidence through structured speaking practice, clear feedback, and practical weekly goals for real conversations.",
  hourlyRateVnd: 300000,
  currency: "VND",
  teachingFormat: "online",
  subjects: ["ielts"],
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

async function ensureTutorProfile(tutorClient: SupabaseClient): Promise<{ id: string; version: number }> {
  const current = await tutorClient.rpc("get_my_tutor_cv");
  if (current.error) throw current.error;
  const saved = await tutorClient.rpc("save_my_tutor_cv", {
    payload: tutorProfile,
    expected_version: current.data?.version ?? null,
  });
  if (saved.error || !saved.data) throw saved.error ?? new Error("Could not save tutor fixture profile");
  const published = await tutorClient.rpc("publish_my_tutor_cv", { expected_version: saved.data.version });
  if (published.error || !published.data) throw published.error ?? new Error("Could not publish tutor fixture profile");
  return { id: published.data.id, version: published.data.version };
}

async function ensureSessions(tutorClient: SupabaseClient, tutorUserId: string): Promise<string[]> {
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
    if (available.length >= 2) return available;
  }

  const newIds: string[] = [];
  for (const offsetHours of [48, 72]) {
    const startsAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const result = await tutorClient.rpc("create_session", {
      payload: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), maxParticipants: 5 },
    });
    if (result.error || !result.data?.id) throw result.error ?? new Error("Could not create tutor fixture session");
    newIds.push(result.data.id);
  }
  return [...available, ...newIds].slice(0, 2);
}

const learnerUser = await ensureUser(learner);
const tutorUser = await ensureUser(tutor);
const tutorClient = await authenticatedClient(tutor.email);
const profile = await ensureTutorProfile(tutorClient);
const sessions = await ensureSessions(tutorClient, tutorUser.id);

console.log(JSON.stringify({
  learner: { email: learner.email, role: learner.role },
  tutor: { email: tutor.email, role: tutor.role, profileId: profile.id },
  sessions,
  password: localOnlyPassword,
}, null, 2));
await sql.end();
