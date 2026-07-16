import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { CommunitiesPage } from "@/components/discover/communities-page";

export default function Communities() {
  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <CommunitiesPage />
      </Suspense>
      <Footer />
    </div>
  );
}
