import { Suspense } from "react";
import { DiscussionsPage } from "@/components/discover/posts-page";

export default function Discussions() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#070b12]" />}>
        <DiscussionsPage />
    </Suspense>
  );
}
