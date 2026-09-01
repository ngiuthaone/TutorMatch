import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { ThreadDetailPage } from "@/components/threads/thread-detail";

export const dynamic = "force-dynamic";

export default async function ThreadDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <ThreadDetailPage threadId={decodeURIComponent(id)} />
    </Suspense>
  );
}
