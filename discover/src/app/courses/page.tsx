import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { CoursesPage } from "@/components/discover/courses-page";

export default function Courses() {
  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <CoursesPage />
      </Suspense>
      <Footer />
    </div>
  );
}
