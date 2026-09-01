import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { ThreadsFeedPage } from "@/components/threads/threads-feed";

export const dynamic = "force-dynamic";

export default function ThreadsRoute() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <ThreadsFeedPage />
    </Suspense>
  );
}
