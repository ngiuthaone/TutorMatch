import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { ForYouPage } from "@/components/discover/for-you-page";

export default function ForYou() {
  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <ForYouPage />
      </Suspense>
      <Footer />
    </div>
  );
}
