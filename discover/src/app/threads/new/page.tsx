import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { NewThreadPage } from "@/components/threads/new-thread";

export const dynamic = "force-dynamic";

export default function NewThreadRoute() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <NewThreadPage />
    </Suspense>
  );
}
