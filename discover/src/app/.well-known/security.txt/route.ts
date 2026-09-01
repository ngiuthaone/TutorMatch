// Well-known security.txt: RFC 9116. A small static response surface
// (no PII, no query params) describing the disclosure contact and the
// canonical expiry. Operators can update the email + expiry here.
//
// Rendered as plain text with a long max-age; security.txt is rarely
// changed and is safe to cache.
const SECURITY_TXT_BODY = `# Tutoria security disclosure
# See https://www.rfc-editor.org/rfc/rfc9116 for the spec.

Contact: mailto:security@tutoria.com
Contact: https://tutoria.com/.well-known/security.txt
Expires: 2027-12-31T23:59:59z
Preferred-Languages: en, vi
Canonical: https://tutoria.com/.well-known/security.txt

# We acknowledge responsible disclosure within 5 business days.
# Please include reproduction steps, impact, and your contact details.
# Do NOT include personal data of other users in your report.
`;

export function GET() {
  return new Response(SECURITY_TXT_BODY, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
