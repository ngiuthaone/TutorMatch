"use client";

import { useSearchParams } from "next/navigation";

export function SearchResults() {
  const params = useSearchParams();
  const query = params.get("q") ?? "";

  return (
    <main className="flex-1 max-w-[1400px] mx-auto px-4 lg:px-8 pt-8 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {query ? `Results for "${query}"` : "Search"}
      </h1>
      <p className="text-muted mt-2">
        {query
          ? `Showing results for "${query}". Search is not yet connected to a backend.`
          : "Enter a search query to find skills, people, courses, and more."}
      </p>
    </main>
  );
}
