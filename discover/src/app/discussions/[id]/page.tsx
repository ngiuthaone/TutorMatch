import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { CollapsibleHeader } from "@/components/discover/collapsible-header";
import { PostDetailPage } from "@/components/discover/post-detail-page";

export const dynamic = "force-dynamic";

export default async function PostDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
      <CollapsibleHeader><TopNav /></CollapsibleHeader>
      <PostDetailPage postId={decodeURIComponent(id)} />
    </Suspense>
  );
}
