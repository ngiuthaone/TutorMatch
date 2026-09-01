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
};
