import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("RESEND_FROM") ?? "Tutoria <noreply@tutoria.com>";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string }> {
  if (!RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject=${subject}`);
    return { id: `dev-${Date.now()}` };
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
  return data;
}

interface OutboxEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: authData } = await supabase.auth.admin.getUserById(userId);
  return authData.user?.email ?? null;
}

async function getSessionDetails(sessionId: string): Promise<{
  title: string;
  starts_at: string;
  ends_at: string;
  host_id: string;
  host_name: string;
} | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: session } = await supabase
    .from("sessions")
    .select("id, starts_at, ends_at, host_id")
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const { data: hostProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", session.host_id)
    .single();

  const { data: authData } = await supabase.auth.admin.getUserById(session.host_id);
  const hostName = hostProfile?.name ?? authData.user?.email?.split("@")[0] ?? "The host";

  const { data: offering } = await supabase
    .from("offerings")
    .select("title")
    .eq("id", session.offering_id)
    .single();

  const title = offering?.title ?? "Workshop Session";

  return {
    title,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    host_id: session.host_id,
    host_name: hostName,
  };
}

async function getBookingDetails(bookingId: string): Promise<{
  learner_id: string;
  session_id: string;
  participant_count: number;
} | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase
    .from("bookings")
    .select("learner_id, session_id, participant_count")
    .eq("id", bookingId)
    .single();
  return data ?? null;
}

async function getLearnerDetails(learnerId: string): Promise<{ name: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", learnerId)
    .single();
  return data ?? null;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(amount);
}

async function handleBookingConfirmed(
  payload: Record<string, unknown>,
): Promise<EmailResult> {
  const bookingId = payload.bookingId as string;
  const sessionId = payload.sessionId as string;

  const booking = await getBookingDetails(bookingId);
  const session = await getSessionDetails(sessionId);

  if (!booking || !session) {
    return { success: false, error: "Booking or session not found" };
  }

  const learnerEmail = await getUserEmail(booking.learner_id);
  if (!learnerEmail) {
    return { success: false, error: "Learner email not found" };
  }

  const learner = await getLearnerDetails(booking.learner_id);
  const learnerName = learner?.name ?? "Learner";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">🎉 Your workshop booking is confirmed!</h1>
      <p>Hi ${learnerName},</p>
      <p>Great news! Your booking has been confirmed. Here are the details:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Session:</strong> ${session.title}</p>
        <p><strong>Date & Time:</strong> ${formatDateTime(session.starts_at)}</p>
        <p><strong>Host:</strong> ${session.host_name}</p>
        <p><strong>Participants:</strong> ${booking.participant_count}</p>
      </div>
      <p>We look forward to seeing you there!</p>
      <p>Best regards,<br>The Tutoria Team</p>
    </div>
  `;

  const result = await sendEmail(learnerEmail, "Booking Confirmed - " + session.title, html);
  return { success: true, emailId: result.id };
}

async function handleBookingCancelled(
  payload: Record<string, unknown>,
): Promise<EmailResult> {
  const sessionId = payload.sessionId as string;

  const session = await getSessionDetails(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const learnerEmail = await getUserEmail(session.host_id);
  if (!learnerEmail) {
    return { success: false, error: "Host email not found" };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Your workshop booking has been cancelled</h1>
      <p>Hi,</p>
      <p>Unfortunately, your booking has been cancelled. Here are the details:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Session:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${formatDate(session.starts_at)}</p>
      </div>
      <p>If you have any questions, please contact us.</p>
      <p>Best regards,<br>The Tutoria Team</p>
    </div>
  `;

  const result = await sendEmail(learnerEmail, "Booking Cancelled - " + session.title, html);
  return { success: true, emailId: result.id };
}

async function handlePaymentReceived(
  payload: Record<string, unknown>,
): Promise<EmailResult> {
  const learnerId = payload.learnerId as string;
  const amount = payload.amount as number;

  const learnerEmail = await getUserEmail(learnerId);
  if (!learnerEmail) {
    return { success: false, error: "Learner email not found" };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">✅ Payment received</h1>
      <p>Hi,</p>
      <p>We have received your payment. Thank you!</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Amount:</strong> ${formatAmount(amount)}</p>
      </div>
      <p>Best regards,<br>The Tutoria Team</p>
    </div>
  `;

  const result = await sendEmail(learnerEmail, "Payment Received", html);
  return { success: true, emailId: result.id };
}

async function handleRefundIssued(
  payload: Record<string, unknown>,
): Promise<EmailResult> {
  const learnerId = payload.learnerId as string;
  const amount = payload.amount as number;

  const learnerEmail = await getUserEmail(learnerId);
  if (!learnerEmail) {
    return { success: false, error: "Learner email not found" };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">💰 Refund issued</h1>
      <p>Hi,</p>
      <p>Your refund has been processed. The funds should appear in your account shortly.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Refund Amount:</strong> ${formatAmount(amount)}</p>
      </div>
      <p>Best regards,<br>The Tutoria Team</p>
    </div>
  `;

  const result = await sendEmail(learnerEmail, "Refund Issued", html);
  return { success: true, emailId: result.id };
}

async function handleBookingRequested(
  payload: Record<string, unknown>,
): Promise<EmailResult> {
  const sessionId = payload.sessionId as string;

  const session = await getSessionDetails(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const hostEmail = await getUserEmail(session.host_id);
  if (!hostEmail) {
    return { success: false, error: "Host email not found" };
  }

  const booking = await getBookingDetails(payload.bookingId as string);
  const learnerName = booking ? ((await getLearnerDetails(booking.learner_id))?.name ?? "A learner") : "A learner";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">New booking request</h1>
      <p>Hi ${session.host_name},</p>
      <p>You have received a new booking request!</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Learner:</strong> ${learnerName}</p>
        <p><strong>Session:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${formatDate(session.starts_at)}</p>
        <p><strong>Time:</strong> ${new Date(session.starts_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <p>Please log in to your dashboard to accept or decline this request.</p>
      <p>Best regards,<br>The Tutoria Team</p>
    </div>
  `;

  const result = await sendEmail(hostEmail, "New Booking Request - " + session.title, html);
  return { success: true, emailId: result.id };
}

async function processEvent(event: OutboxEvent): Promise<{ success: boolean; error?: string }> {
  const handlers: Record<string, (p: Record<string, unknown>) => Promise<EmailResult>> = {
    BOOKING_CONFIRMED: handleBookingConfirmed,
    BOOKING_CANCELLED: handleBookingCancelled,
    PAYMENT_RECEIVED: handlePaymentReceived,
    REFUND_ISSUED: handleRefundIssued,
    BOOKING_REQUESTED: handleBookingRequested,
  };

  const handler = handlers[event.event_type];
  if (!handler) {
    console.log(`Skipping unhandled event type: ${event.event_type}`);
    return { success: true };
  }

  try {
    const result = await handler(event.payload);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function updateEventStatus(
  eventId: string,
  status: "processed" | "error",
  errorMessage?: string,
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (status === "processed") {
    await supabase
      .from("event_outbox")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", eventId);
  } else {
    await supabase
      .from("event_outbox")
      .update({
        last_error: errorMessage ? errorMessage.slice(0, 500) : null,
        retry_count: supabase.sql`retry_count + 1`,
      })
      .eq("id", eventId);
  }
}

async function fetchUnprocessedEvents(limit: number): Promise<OutboxEvent[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("event_outbox")
    .select("id, event_type, aggregate_type, aggregate_id, payload, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get("batch_size") ?? "20", 10);

    const events = await fetchUnprocessedEvents(batchSize);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of events) {
      const result = await processEvent(event);

      if (result.success) {
        await updateEventStatus(event.id, "processed");
        processed++;
      } else {
        await updateEventStatus(event.id, "error", result.error);
        failed++;
        if (result.error) {
          errors.push(`${event.event_type} (${event.id}): ${result.error}`);
        }
      }
    }

    const response = {
      processed,
      failed,
      errors,
      total: events.length,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
