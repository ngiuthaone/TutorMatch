import { VerifyEmailScreen } from "@/components/auth/verify-email-screen";
import { safeRedirectPath } from "@/lib/auth/redirect";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; email?: string | string[] }> }) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(params.next, "/discover");
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  return <VerifyEmailScreen nextPath={nextPath} emailHint={typeof email === "string" ? email : ""} />;
}
