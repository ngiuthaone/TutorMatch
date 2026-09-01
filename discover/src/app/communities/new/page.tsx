import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { NewCommunityPage } from "@/components/communities/new-community";

export const dynamic = "force-dynamic";

export default function NewCommunityRoute() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <NewCommunityPage />
    </Suspense>
  );
}
