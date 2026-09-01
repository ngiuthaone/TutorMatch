import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { CommunityDetailPage } from "@/components/communities/community-detail";

export const dynamic = "force-dynamic";

export default async function CommunityDetailRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <CommunityDetailPage slug={decodeURIComponent(slug)} />
    </Suspense>
  );
}
