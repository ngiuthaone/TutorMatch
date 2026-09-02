import { createClient } from "@supabase/supabase-js";
import { sendEmail, EmailTemplates } from "./email.js";
import { logServiceError } from "../lib/service-error.js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

function formatVnd(amountVnd: number | string | null | undefined): string {
  if (amountVnd === null || amountVnd === undefined) return "0";
  const value = typeof amountVnd === "string" ? Number(amountVnd) : amountVnd;
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(Math.round(value));
}

function publicBaseUrl(): string {
  const origins = process.env.FRONTEND_ORIGINS;
  if (origins) {
    const first = origins.split(",").map((s) => s.trim()).filter(Boolean)[0];
    if (first) return first.replace(/\/+$/, "");
  }
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
  return "https://tutoria.com";
}

function formatSessionDateTime(startsAt: string | null | undefined): { date: string; time: string } {
  if (!startsAt) return { date: "TBD", time: "TBD" };
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return { date: "TBD", time: "TBD" };
  return {
    date: d.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function buildServiceClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, { auth: authOptions });
}

type BookingRow = {
  id: string;
  profiles?: { name?: string | null; email?: string | null } | null;
  sessions?: {
    starts_at?: string | null;
    offerings?: { title?: string | null; profiles?: { name?: string | null } | null } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  profiles?: { name?: string | null; email?: string | null } | null;
  payments?: { amount_vnd?: number | null; status?: string | null } | { amount_vnd?: number | null; status?: string | null }[] | null;
};

type RefundRow = {
  id: string;
  amount_vnd?: number | null;
  booking_id?: string | null;
  payments?: { bookings?: { id?: string; profiles?: { name?: string | null; email?: string | null } | null } | null } | null;
};

export async function sendBookingConfirmedEmail(bookingId: string, supabaseUrl: string, serviceRoleKey: string | undefined): Promise<void> {
  if (!serviceRoleKey) return;
  const admin = buildServiceClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("bookings")
    .select("id, profiles!bookings_learner_id_fkey(name, email), sessions!bookings_session_id_fkey(starts_at, offerings!sessions_offering_id_fkey(title, profiles!offerings_creator_id_fkey(name)))")
    .eq("id", bookingId)
    .maybeSingle<BookingRow>();
  if (error) {
    logServiceError({ service: "transactional-emails", operation: "sendBookingConfirmedEmail.load", error });
    return;
  }
  const learnerProfile = data?.profiles;
  if (!learnerProfile?.email) return;

  const tutorName = data?.sessions?.offerings?.profiles?.name ?? "Tutor";
  const { date, time } = formatSessionDateTime(data?.sessions?.starts_at);

  try {
    const tpl = await EmailTemplates.bookingConfirmed({
      learnerName: learnerProfile.name ?? "bạn",
      tutorName,
      sessionDate: date,
      sessionTime: time,
      manageUrl: `${publicBaseUrl()}/bookings/${bookingId}`,
    });
    const result = await sendEmail({ to: learnerProfile.email, ...tpl });
    if ("error" in result) {
      console.error("booking_confirmed_email_failed", { bookingId, error: result.error });
    }
  } catch (error) {
    logServiceError({ service: "transactional-emails", operation: "sendBookingConfirmedEmail.send", error });
  }
}

export async function sendPaymentReceivedEmail(bookingId: string, supabaseUrl: string, serviceRoleKey: string | undefined): Promise<void> {
  if (!serviceRoleKey) return;
  const admin = buildServiceClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("bookings")
    .select("id, profiles!bookings_learner_id_fkey(name, email), payments(amount_vnd, status)")
    .eq("id", bookingId)
    .maybeSingle<PaymentRow>();
  if (error) {
    logServiceError({ service: "transactional-emails", operation: "sendPaymentReceivedEmail.load", error });
    return;
  }
  const learnerProfile = data?.profiles;
  if (!learnerProfile?.email) return;

  const payment = Array.isArray(data?.payments) ? data?.payments?.[0] : data?.payments;
  const amount = formatVnd(payment?.amount_vnd);

  try {
    const tpl = await EmailTemplates.paymentReceived({
      displayName: learnerProfile.name ?? "bạn",
      amount,
      currency: "VND",
      receiptUrl: `${publicBaseUrl()}/bookings/${bookingId}`,
    });
    const result = await sendEmail({ to: learnerProfile.email, ...tpl });
    if ("error" in result) {
      console.error("payment_received_email_failed", { bookingId, error: result.error });
    }
  } catch (error) {
    logServiceError({ service: "transactional-emails", operation: "sendPaymentReceivedEmail.send", error });
  }
}

export async function sendRefundIssuedEmail(refundId: string, supabaseUrl: string, serviceRoleKey: string | undefined): Promise<void> {
  if (!serviceRoleKey) return;
  const admin = buildServiceClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("refunds")
    .select("id, amount_vnd, booking_id, payments!refunds_payment_id_fkey(booking_id, bookings!payments_booking_id_fkey(id, profiles!bookings_learner_id_fkey(name, email)))")
    .eq("id", refundId)
    .maybeSingle<RefundRow>();
  if (error) {
    logServiceError({ service: "transactional-emails", operation: "sendRefundIssuedEmail.load", error });
    return;
  }
  if (!data) return;

  const learnerProfile = data.payments?.bookings?.profiles;
  const bookingId = data.payments?.bookings?.id ?? data.booking_id ?? refundId;
  if (!learnerProfile?.email) return;

  const amount = formatVnd(data.amount_vnd);

  try {
    const tpl = await EmailTemplates.refundIssued({
      displayName: learnerProfile.name ?? "bạn",
      amount,
      currency: "VND",
      bookingUrl: `${publicBaseUrl()}/bookings/${bookingId}`,
      etaDays: 5,
    });
    const result = await sendEmail({ to: learnerProfile.email, ...tpl });
    if ("error" in result) {
      console.error("refund_issued_email_failed", { refundId, error: result.error });
    }
  } catch (error) {
    logServiceError({ service: "transactional-emails", operation: "sendRefundIssuedEmail.send", error });
  }
}
