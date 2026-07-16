import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { PeoplePage } from "@/components/discover/people-page";

export default function People() {
  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <PeoplePage />
      </Suspense>
      <Footer />
    </div>
  );
}
