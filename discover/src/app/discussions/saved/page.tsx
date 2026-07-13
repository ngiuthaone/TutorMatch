import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { SavedPage } from "@/components/discover/saved-page";

export default function Saved() {
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <SavedPage />
      </Suspense>
      <Footer />
    </div>
  );
}
