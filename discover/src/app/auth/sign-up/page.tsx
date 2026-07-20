import { SignUpFlow } from "@/components/auth/sign-up-flow";

function safeNextPath(next: string | string[] | undefined) {
  const path = Array.isArray(next) ? next[0] : next;
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/discover";
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  return (
    <main className="min-h-[100dvh]">
      <SignUpFlow nextPath={nextPath} />
    </main>
  );
}
