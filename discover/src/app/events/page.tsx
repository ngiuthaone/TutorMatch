import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { EventsPage } from "@/components/discover/events-page";

export default function Events() {
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <EventsPage />
      </Suspense>
      <Footer />
    </div>
  );
}
