import { Resend } from "resend";

let cached: Resend | null = null;
function getClient(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

const FROM_ADDRESS = process.env.RESEND_FROM ?? "Tutoria <noreply@tutoria.com>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<{ id: string } | { error: string }> {
  const client = getClient();
  if (!client) {
    console.log(`[email:dev] to=${msg.to} subject=${msg.subject}`);
    return { id: `dev-${Date.now()}` };
  }
  const payload: { from: string; to: string; subject: string; html: string; text?: string } = {
    from: FROM_ADDRESS,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
  };
  if (msg.text !== undefined) payload.text = msg.text;
  const { data, error } = await client.emails.send(payload);
  if (error) return { error: error.message };
  return { id: data!.id };
}

// Pattern adapted from BookBarber's event-driven template registry: every user-visible lifecycle
// event (booking confirmed, payment received, refund issued) gets a small, single-purpose
// template function so the call sites stay readable. Reimplemented under Tutoria's own copy
// and HTML structure — BookBarber source is unlicensed, no code was copied.
export const EmailTemplates = {
  passwordReset: (link: string) => ({
    subject: "Reset your Tutoria password",
    html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${link}">${link}</a></p>`,
    text: `Reset your password: ${link} (expires in 1 hour)`,
  }),
  emailVerification: (link: string) => ({
    subject: "Verify your Tutoria email",
    html: `<p>Welcome to Tutoria. Verify your email to finish signup.</p><p><a href="${link}">${link}</a></p>`,
    text: `Verify your email: ${link}`,
  }),
  securityAlert: (event: string) => ({
    subject: `Security alert: ${event}`,
    html: `<p>A ${event} was detected on your account. If this wasn't you, change your password immediately.</p>`,
    text: `Security alert: ${event} detected. If this wasn't you, change your password.`,
  }),
  bookingConfirmed: (name: string, date: string, tutorName: string, manageUrl: string) => ({
    subject: `Your lesson with ${tutorName} is confirmed`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your lesson on <strong>${escapeHtml(date)}</strong> with ${escapeHtml(tutorName)} is confirmed.</p><p><a href="${escapeAttr(manageUrl)}">View booking</a></p>`,
    text: `Hi ${name}, your lesson on ${date} with ${tutorName} is confirmed. Manage: ${manageUrl}`,
  }),
  paymentReceived: (name: string, amount: string, bookingUrl: string) => ({
    subject: `Payment received: ${amount}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>We received your payment of <strong>${escapeHtml(amount)}</strong>.</p><p><a href="${escapeAttr(bookingUrl)}">View receipt</a></p>`,
    text: `Hi ${name}, we received your payment of ${amount}. View: ${bookingUrl}`,
  }),
  refundIssued: (name: string, amount: string, bookingUrl: string) => ({
    subject: `Refund issued: ${amount}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>We've issued a refund of <strong>${escapeHtml(amount)}</strong>. It may take 3-5 business days to appear on your statement.</p><p><a href="${escapeAttr(bookingUrl)}">View refund</a></p>`,
    text: `Hi ${name}, we've issued a refund of ${amount}. It may take 3-5 business days. View: ${bookingUrl}`,
  }),
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
