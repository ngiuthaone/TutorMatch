import { Resend } from "resend";
import { render } from "@react-email/render";
import { PasswordResetEmail } from "../emails/password-reset.js";
import { EmailVerificationEmail } from "../emails/email-verification.js";
import { SecurityAlertEmail } from "../emails/security-alert.js";
import { BookingConfirmedEmail } from "../emails/booking-confirmed.js";
import { PaymentReceivedEmail } from "../emails/payment-received.js";
import { RefundIssuedEmail } from "../emails/refund-issued.js";

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

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderPasswordReset(resetLink: string): Promise<RenderedEmail> {
  const html = await render(PasswordResetEmail({ resetLink }));
  return {
    subject: "Reset your Tutoria password",
    html,
    text: `Reset your password: ${resetLink} (expires in 1 hour)`,
  };
}

export async function renderEmailVerification(verifyLink: string, displayName: string): Promise<RenderedEmail> {
  const html = await render(EmailVerificationEmail({ verifyLink, displayName }));
  return {
    subject: "Verify your Tutoria email",
    html,
    text: `Hi ${displayName}, verify your email: ${verifyLink}`,
  };
}

export async function renderSecurityAlert(event: string, when: string, ip?: string): Promise<RenderedEmail> {
  const html = await render(SecurityAlertEmail({ event, when, ip }));
  return {
    subject: `Security alert: ${event}`,
    html,
    text: `Security alert: ${event} on ${when}${ip ? ` from ${ip}` : ""}`,
  };
}

export async function renderBookingConfirmed(props: { learnerName: string; tutorName: string; sessionDate: string; sessionTime: string; manageUrl: string }): Promise<RenderedEmail> {
  const html = await render(BookingConfirmedEmail(props));
  return {
    subject: `Your lesson with ${props.tutorName} is confirmed`,
    html,
    text: `Your lesson with ${props.tutorName} on ${props.sessionDate} at ${props.sessionTime} is confirmed. Manage: ${props.manageUrl}`,
  };
}

export async function renderPaymentReceived(props: { displayName: string; amount: string; currency: string; receiptUrl: string }): Promise<RenderedEmail> {
  const html = await render(PaymentReceivedEmail(props));
  return {
    subject: `Payment received: ${props.amount} ${props.currency}`,
    html,
    text: `Payment of ${props.amount} ${props.currency} received. View: ${props.receiptUrl}`,
  };
}

export async function renderRefundIssued(props: { displayName: string; amount: string; currency: string; bookingUrl: string; etaDays?: number }): Promise<RenderedEmail> {
  const html = await render(RefundIssuedEmail(props));
  return {
    subject: `Refund issued: ${props.amount} ${props.currency}`,
    html,
    text: `Refund of ${props.amount} ${props.currency} issued. View: ${props.bookingUrl}`,
  };
}

// Pattern adapted from BookBarber's event-driven template registry: every user-visible lifecycle
// event (booking confirmed, payment received, refund issued) gets a small, single-purpose
// template function so the call sites stay readable. Reimplemented under Tutoria's own copy
// and HTML structure — BookBarber source is unlicensed, no code was copied.
export const EmailTemplates = {
  passwordReset: async (link: string) => renderPasswordReset(link),
  emailVerification: async (link: string, displayName: string) => renderEmailVerification(link, displayName),
  securityAlert: async (event: string, when: string, ip?: string) => renderSecurityAlert(event, when, ip),
  bookingConfirmed: renderBookingConfirmed,
  paymentReceived: renderPaymentReceived,
  refundIssued: renderRefundIssued,
};
