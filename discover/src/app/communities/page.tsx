import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { CommunitiesPage } from "@/components/communities/communities-list";

export const dynamic = "force-dynamic";

export default function CommunitiesRoute() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <CommunitiesPage />
    </Suspense>
  );
}
