import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Local-only Phase 5B browser QA fixtures.
 *
 * Run seed-local-core-fixtures.ts first. This script creates one persisted
 * booking per named learner fixture, then uses the accepted booking/payment
 * RPCs and local database state to expose the real read-model states required
 * by the Phase 5 browser gate.
 *
 * Required environment is the same as seed-local-core-fixtures.ts. The
 * service-role key is used only by this loopback setup command.
 */

const localOnlyPassword = "Local-test-only-Password1!";
const tutorEmail = "tutor@example.com";
const tutorName = "Thu Ha";
const tutorProfileName = "Phase 5B fixture tutor";
const fixtureLearners = [
  { key: "full-refund", email: "phase5-full-refund@example.com", name: "QA Full Refund Learner" },
  { key: "no-refund", email: "phase5-no-refund@example.com", name: "QA No Refund Learner" },
  { key: "processing", email: "phase5-refund-processing@example.com", name: "QA Processing Refund Learner" },
  { key: "refunded", email: "phase5-refunded@example.com", name: "QA Refunded Learner" },
  { key: "needs-attention", email: "phase5-refund-attention@example.com", name: "QA Refund Attention Learner" },
  { key: "payment-flight", email: "phase5-payment-flight@example.com", name: "QA Payment Flight Learner" },
  { key: "tutor-cancel", email: "phase5-tutor-cancel@example.com", name: "QA Tutor Cancel Learner" },
  { key: "reject", email: "phase5-reject@example.com", name: "QA Reject Learner" },
] as const;

type AuthUser = { id: string; email?: string | null };
type FixtureLearner = (typeof fixtureLearners)[number];
type ReadBooking = {
  id: string;
  status: string;
  version: number;
  session?: { startsAt?: string; endsAt?: string };
  payment?: { id: string; status: string; amountVnd: number; refundedAmountVnd: number } | null;
  paymentReady?: boolean;
  paymentInFlight?: boolean;
  canLearnerCancel?: boolean;
  canTutorCancel?: boolean;
  refund?: { status?: string; amountVnd?: number; refundedAmountVnd?: number } | null;
};

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
if (parsedUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) throw new Error("Refusing to seed a non-loopback Supabase URL.");
const parsedDbUrl = new URL(dbUrl);
if (!["localhost", "127.0.0.1"].includes(parsedDbUrl.hostname)) throw new Error("Refusing to seed a non-loopback database.");

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const trusted = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = postgres(dbUrl, { max: 1 });

async function findUser(email: string): Promise<AuthUser | null> {
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return { id: match.id, email: match.email };
    if (result.data.users.length < 1000) return null;
  }
  throw new Error(`Could not find local auth fixture ${email}`);
}

async function ensureLearner(fixture: FixtureLearner): Promise<AuthUser> {
  const existing = await findUser(fixture.email);
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password: localOnlyPassword, email_confirm: true, user_metadata: { name: fixture.name, role: "student" } })
    : await admin.auth.admin.createUser({ email: fixture.email, password: localOnlyPassword, email_confirm: true, user_metadata: { name: fixture.name, role: "student" } });
  if (result.error || !result.data.user) throw result.error ?? new Error(`Could not ensure ${fixture.email}`);
  await sql`insert into public.profiles (id, role, name) values (${result.data.user.id}, 'student', ${fixture.name}) on conflict (id) do update set role='student', name=excluded.name`;
  return { id: result.data.user.id, email: result.data.user.email };
}

async function authenticatedClient(email: string): Promise<SupabaseClient> {
  const result = await anon.auth.signInWithPassword({ email, password: localOnlyPassword });
  if (result.error || !result.data.session) throw result.error ?? new Error(`Could not sign in ${email}`);
  return createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${result.data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

async function createSession(tutor: SupabaseClient, offsetHours: number): Promise<string> {
  const startsAt = new Date(Date.now() + offsetHours * 3600e3);
  const endsAt = new Date(startsAt.getTime() + 60 * 60e3);
  const result = await tutor.rpc("create_session", { payload: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), maxParticipants: 5 } });
  if (result.error || !result.data?.id) throw result.error ?? new Error("Could not create Phase 5B session");
  return result.data.id as string;
}

async function existingBooking(learnerId: string, tutorId: string): Promise<{ id: string; sessionId: string } | null> {
  const rows = await sql<{ id: string; session_id: string }[]>`select b.id, b.session_id from public.bookings b join public.sessions s on s.id=b.session_id where b.learner_id=${learnerId} and s.host_id=${tutorId} order by b.created_at asc limit 1`;
  return rows[0] ? { id: rows[0].id, sessionId: rows[0].session_id } : null;
}

async function ensureBooking(learner: SupabaseClient, learnerId: string, tutorId: string, offsetHours: number): Promise<{ id: string; sessionId: string }> {
  const existing = await existingBooking(learnerId, tutorId);
  if (existing) return existing;
  const sessionId = await createSession(tutorClient, offsetHours);
  const result = await learner.rpc("create_booking", { session_id: sessionId, participant_count: 1 });
  if (result.error || !result.data?.id) throw result.error ?? new Error("Could not create Phase 5B booking");
  return { id: result.data.id as string, sessionId };
}

async function approveAndPay(tutor: SupabaseClient, learner: SupabaseClient, bookingId: string, amountVnd = 300000): Promise<void> {
  const approved = await tutor.rpc("approve_booking_for_payment", { p_booking_id: bookingId });
  if (approved.error && !String(approved.error.message).includes("INVALID_TRANSITION")) throw approved.error;
  const current = await sql<{ status: string }[]>`select status from public.bookings where id=${bookingId}`;
  const payment = await sql<{ id: string; status: string }[]>`select id,status from public.payments where booking_id=${bookingId}`;
  if (current[0]?.status === "cancelled" || current[0]?.status === "rejected") return;
  if (current[0]?.status === "confirmed" && payment[0]?.status === "succeeded") return;
  const attempt = await learner.rpc("start_payment_attempt", { p_booking_id: bookingId, p_idempotency_key: `phase5b-${bookingId.replace(/-/g, "").slice(0, 20)}` });
  if (attempt.error && !String(attempt.error.message).includes("PAYMENT_NOT_RETRYABLE")) throw attempt.error;
  if (attempt.data?.merchantReference) {
    const observed = await trusted.rpc("record_vnpay_observation", { p_provider_event_key: `phase5b-${bookingId}`, p_merchant_reference: attempt.data.merchantReference, p_outcome: "succeeded", p_provider_transaction_no: `phase5b-txn-${bookingId}`, p_amount_vnd: amountVnd, p_payload: { fixture: "phase5b" } });
    if (observed.error && !String(observed.error.message).includes("duplicate")) throw observed.error;
  }
  const finalized = await trusted.rpc("finalize_paid_booking", { p_booking_id: bookingId });
  if (finalized.error) throw finalized.error;
}

async function setSessionOffset(sessionId: string, offsetHours: number): Promise<void> {
  const startsAt = new Date(Date.now() + offsetHours * 3600e3);
  await sql`update public.sessions set starts_at=${startsAt}, ends_at=${new Date(startsAt.getTime() + 3600e3)}, status='scheduled' where id=${sessionId}`;
}

async function cancelLearnerBooking(learner: SupabaseClient, bookingId: string): Promise<void> {
  const row = await sql<{ version: number; status: string }[]>`select version,status from public.bookings where id=${bookingId}`;
  if (row[0]?.status === "cancelled") return;
  const result = await learner.rpc("cancel_booking", { booking_id: bookingId, expected_version: row[0].version, cause: "attendee", reason: "Phase 5B local browser QA fixture" });
  if (result.error) throw result.error;
}

async function setRefundState(bookingId: string, status: "pending" | "succeeded" | "failed"): Promise<void> {
  const payment = await sql<{ id: string; amount_vnd: number }[]>`select id,amount_vnd from public.payments where booking_id=${bookingId}`;
  if (!payment[0]) throw new Error(`Missing payment for ${bookingId}`);
  const existing = await sql<{ id: string }[]>`select id from public.refunds where payment_id=${payment[0].id} order by created_at asc limit 1`;
  if (existing[0]) await sql`update public.refunds set status=${status}, updated_at=now() where id=${existing[0].id}`;
  else await sql`insert into public.refunds(payment_id,kind,status,amount_vnd,idempotency_key,reason) values(${payment[0].id},'standard',${status},${payment[0].amount_vnd},${`phase5b:${bookingId}`},'Phase 5B local browser QA fixture')`;
  if (status === "succeeded") await sql`update public.payments set status='refunded', refunded_amount_vnd=amount_vnd, updated_at=now() where id=${payment[0].id}`;
  if (status !== "succeeded") await sql`update public.payments set status='succeeded', updated_at=now() where id=${payment[0].id}`;
}

async function readFor(client: SupabaseClient, bookingId: string): Promise<ReadBooking> {
  const result = await client.rpc("get_my_bookings");
  if (result.error || !Array.isArray(result.data)) throw result.error ?? new Error("Could not read learner fixture projection");
  const booking = result.data.find((value: ReadBooking) => value.id === bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} is not visible in learner read model`);
  return booking;
}

async function readTutorFor(bookingId: string): Promise<ReadBooking> {
  const result = await tutorClient.rpc("get_my_tutor_bookings");
  if (result.error || !Array.isArray(result.data)) throw result.error ?? new Error("Could not read Tutor fixture projection");
  const booking = result.data.find((value: ReadBooking) => value.id === bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} is not visible in Tutor read model`);
  return booking;
}

const tutorUser = await findUser(tutorEmail);
if (!tutorUser) throw new Error("Run seed-local-core-fixtures.ts before Phase 5B fixtures.");
const tutorClient = await authenticatedClient(tutorEmail);
const tutorProfile = await sql<{ id: string }[]>`select id from public.tutor_profiles where user_id=${tutorUser.id} and display_name=${tutorName} limit 1`;
if (!tutorProfile[0]) throw new Error(`Missing ${tutorProfileName}; run seed-local-core-fixtures.ts first.`);

const inventory: Record<string, unknown>[] = [];
for (const [index, fixture] of fixtureLearners.entries()) {
  const learnerUser = await ensureLearner(fixture);
  const learnerClient = await authenticatedClient(fixture.email);
  const booking = await ensureBooking(learnerClient, learnerUser.id, tutorUser.id, fixture.key === "no-refund" ? 2 : 30 + index);
  if (["full-refund", "no-refund", "processing", "refunded", "needs-attention", "tutor-cancel"].includes(fixture.key)) await approveAndPay(tutorClient, learnerClient, booking.id);
  if (fixture.key === "full-refund") await setSessionOffset(booking.sessionId, 30);
  if (fixture.key === "no-refund") await setSessionOffset(booking.sessionId, 2);
  if (["processing", "refunded", "needs-attention"].includes(fixture.key)) {
    await setSessionOffset(booking.sessionId, 30);
    await cancelLearnerBooking(learnerClient, booking.id);
    await setRefundState(booking.id, fixture.key === "processing" ? "pending" : fixture.key === "refunded" ? "succeeded" : "failed");
  }
  if (fixture.key === "tutor-cancel") await setSessionOffset(booking.sessionId, 30);
  if (fixture.key === "payment-flight") {
    const current = await sql<{ status: string }[]>`select status from public.bookings where id=${booking.id}`;
    if (current[0]?.status === "requested") {
      const approved = await tutorClient.rpc("approve_booking_for_payment", { p_booking_id: booking.id });
      if (approved.error && !String(approved.error.message).includes("INVALID_TRANSITION")) throw approved.error;
      const attempt = await learnerClient.rpc("start_payment_attempt", { p_booking_id: booking.id, p_idempotency_key: `phase5b-flight-${booking.id.replace(/-/g, "").slice(0, 20)}` });
      if (attempt.error && !String(attempt.error.message).includes("PAYMENT_NOT_RETRYABLE")) throw attempt.error;
    }
  }
  const read = await readFor(learnerClient, booking.id);
  const tutorRead = await readTutorFor(booking.id);
  const preview = read.status === "confirmed" ? await learnerClient.rpc("get_booking_cancellation_preview", { bid: booking.id }) : { data: null };
  inventory.push({ key: fixture.key, learner: fixture.name, bookingId: booking.id, status: read.status, session: read.session, paymentStatus: read.payment?.status ?? null, paymentReady: read.paymentReady ?? false, paymentInFlight: read.paymentInFlight ?? false, canLearnerCancel: read.canLearnerCancel ?? false, canTutorCancel: tutorRead.canTutorCancel ?? false, refund: read.refund ?? null, preview: preview.data ?? null });
}

console.log(JSON.stringify({ tutor: tutorName, fixtures: inventory }, null, 2));
await sql.end();
