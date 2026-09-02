export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tutoria</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1a1a1a; padding: 32px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
    .body { padding: 40px; }
    .body h2 { color: #1a1a1a; margin: 0 0 20px; font-size: 20px; font-weight: 600; }
    .body p { color: #444444; margin: 0 0 16px; line-height: 1.6; font-size: 15px; }
    .body ul { color: #444444; margin: 0 0 16px; padding-left: 20px; }
    .body li { margin-bottom: 8px; }
    .button { display: inline-block; background: #1a1a1a; color: #ffffff !important; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 4px; margin-top: 8px; }
    .button:hover { background: #333333; }
    .footer { padding: 24px 40px; border-top: 1px solid #e5e5e5; }
    .footer p { color: #888888; margin: 0; font-size: 13px; line-height: 1.5; }
    .footer a { color: #666666; }
    .divider { height: 1px; background: #e5e5e5; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tutoria</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>Tutoria — Vietnam's learning marketplace</p>
      <p>You're receiving this because you have an account on Tutoria.</p>
    </div>
  </div>
</body>
</html>`;
}

export function bookingConfirmedEmail(
  name: string,
  sessionTitle: string,
  sessionDate: string,
  sessionTime: string,
  tutorName: string,
  meetingUrl?: string
): EmailMessage {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(sessionTitle);
  const safeDate = escapeHtml(sessionDate);
  const safeTime = escapeHtml(sessionTime);
  const safeTutor = escapeHtml(tutorName);

  let content = `
    <h2>Your booking is confirmed!</h2>
    <p>Hi ${safeName},</p>
    <p>Great news — your workshop booking is confirmed. Here are the details:</p>
    <ul>
      <li><strong>Session:</strong> ${safeTitle}</li>
      <li><strong>Date:</strong> ${safeDate}</li>
      <li><strong>Time:</strong> ${safeTime}</li>
      <li><strong>Tutor:</strong> ${safeTutor}</li>
    </ul>`;

  if (meetingUrl) {
    content += `<p><a href="${escapeHtml(meetingUrl)}" class="button">Join Session</a></p>`;
  }

  content += `<div class="divider"></div>
    <p style="font-size: 13px; color: #888888;">Need to cancel or reschedule? Visit your bookings page to manage this session.</p>`;

  return {
    to: "",
    subject: `Booking Confirmed — ${sessionTitle}`,
    html: baseLayout(content),
    text: `Hi ${name}, your workshop booking is confirmed!\n\nSession: ${sessionTitle}\nDate: ${sessionDate}\nTime: ${sessionTime}\nTutor: ${tutorName}${meetingUrl ? `\n\nJoin: ${meetingUrl}` : ""}`,
  };
}

export function bookingCancelledEmail(
  name: string,
  sessionTitle: string,
  sessionDate: string,
  tutorName: string
): EmailMessage {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(sessionTitle);
  const safeDate = escapeHtml(sessionDate);
  const safeTutor = escapeHtml(tutorName);

  const content = `
    <h2>Booking Cancelled</h2>
    <p>Hi ${safeName},</p>
    <p>Your workshop booking has been cancelled:</p>
    <ul>
      <li><strong>Session:</strong> ${safeTitle}</li>
      <li><strong>Date:</strong> ${safeDate}</li>
      <li><strong>Tutor:</strong> ${safeTutor}</li>
    </ul>
    <p>If you did not request this cancellation or have questions, please contact the tutor directly.</p>`;

  return {
    to: "",
    subject: `Booking Cancelled — ${sessionTitle}`,
    html: baseLayout(content),
    text: `Hi ${name}, your booking has been cancelled.\n\nSession: ${sessionTitle}\nDate: ${sessionDate}\nTutor: ${tutorName}\n\nIf you did not request this, please contact the tutor.`,
  };
}

export function bookingRequestedEmail(
  tutorName: string,
  learnerName: string,
  sessionTitle: string,
  sessionDate: string
): EmailMessage {
  const safeTutor = escapeHtml(tutorName);
  const safeLearner = escapeHtml(learnerName);
  const safeTitle = escapeHtml(sessionTitle);
  const safeDate = escapeHtml(sessionDate);

  const content = `
    <h2>New Booking Request</h2>
    <p>Hi ${safeTutor},</p>
    <p>You have a new booking request from ${safeLearner}:</p>
    <ul>
      <li><strong>Session:</strong> ${safeTitle}</li>
      <li><strong>Date:</strong> ${safeDate}</li>
      <li><strong>Learner:</strong> ${safeLearner}</li>
    </ul>
    <p>Log in to your Tutoria dashboard to accept or decline this request.</p>`;

  return {
    to: "",
    subject: `New Booking Request — ${sessionTitle}`,
    html: baseLayout(content),
    text: `Hi ${tutorName}, you have a new booking request from ${learnerName}.\n\nSession: ${sessionTitle}\nDate: ${sessionDate}\n\nLog in to your Tutoria dashboard to accept or decline.`,
  };
}

export function paymentConfirmationEmail(
  name: string,
  amount: string,
  bookingId: string
): EmailMessage {
  const safeName = escapeHtml(name);
  const safeAmount = escapeHtml(amount);
  const safeId = escapeHtml(bookingId);

  const content = `
    <h2>Payment Received</h2>
    <p>Hi ${safeName},</p>
    <p>We've received your payment. Thank you!</p>
    <ul>
      <li><strong>Amount:</strong> ${safeAmount}</li>
      <li><strong>Booking ID:</strong> ${safeId}</li>
    </ul>
    <p>Your booking is now confirmed. You'll receive a separate confirmation email with the session details.</p>`;

  return {
    to: "",
    subject: `Payment Received — ${amount}`,
    html: baseLayout(content),
    text: `Hi ${name}, we've received your payment of ${amount}.\n\nBooking ID: ${bookingId}\n\nYour booking is confirmed. Check your email for session details.`,
  };
}

export function refundConfirmationEmail(
  name: string,
  amount: string,
  bookingId: string
): EmailMessage {
  const safeName = escapeHtml(name);
  const safeAmount = escapeHtml(amount);
  const safeId = escapeHtml(bookingId);

  const content = `
    <h2>Refund Issued</h2>
    <p>Hi ${safeName},</p>
    <p>Your refund has been processed:</p>
    <ul>
      <li><strong>Amount:</strong> ${safeAmount}</li>
      <li><strong>Booking ID:</strong> ${safeId}</li>
    </ul>
    <p>Please allow 3–5 business days for the refund to appear on your statement, depending on your bank.</p>`;

  return {
    to: "",
    subject: `Refund Issued — ${amount}`,
    html: baseLayout(content),
    text: `Hi ${name}, your refund of ${amount} has been issued.\n\nBooking ID: ${bookingId}\n\nPlease allow 3–5 business days for it to appear on your statement.`,
  };
}

export function waitlistPromotionEmail(
  name: string,
  sessionTitle: string,
  sessionDate: string,
  bookingUrl: string
): EmailMessage {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(sessionTitle);
  const safeDate = escapeHtml(sessionDate);
  const safeUrl = escapeHtml(bookingUrl);

  const content = `
    <h2>A Spot Opened Up!</h2>
    <p>Hi ${safeName},</p>
    <p>Great news — a spot has opened up for the workshop you were on the waitlist for:</p>
    <ul>
      <li><strong>Session:</strong> ${safeTitle}</li>
      <li><strong>Date:</strong> ${safeDate}</li>
    </ul>
    <p>This spot is first-come, first-served. Book now to secure your place!</p>
    <p><a href="${safeUrl}" class="button">Book Now</a></p>
    <p style="font-size: 13px; color: #888888;">This offer expires when the spot is filled or the session starts.</p>`;

  return {
    to: "",
    subject: `Spot Available — ${sessionTitle}`,
    html: baseLayout(content),
    text: `Hi ${name}, a spot has opened up for "${sessionTitle}" on ${sessionDate}!\n\nBook now (first-come, first-served): ${bookingUrl}`,
  };
}
