import { Suspense } from "react";
import { TopNav } from "@/components/discover/top-nav";
import { Footer } from "@/components/discover/footer";
import { SearchResults } from "./search-results";

export default function SearchPage() {
  return (
    <div className="tutoria-page-shell flex flex-col">
      <TopNav />
      <Suspense fallback={<div className="flex-1" />}>
        <SearchResults />
      </Suspense>
      <Footer />
    </div>
  );
}
