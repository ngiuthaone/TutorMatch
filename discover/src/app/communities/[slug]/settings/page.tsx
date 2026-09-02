import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { CommunitySettingsPage } from "@/components/communities/community-settings";

export const dynamic = "force-dynamic";

export default async function CommunitySettingsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <CommunitySettingsPage slug={decodeURIComponent(slug)} />
    </Suspense>
  );
}
