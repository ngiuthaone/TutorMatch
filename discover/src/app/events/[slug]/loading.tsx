import { TopNav } from "@/components/discover/top-nav";

export default function EventLoading() {
  return (
    <div className="tutoria-page-shell tutoria-marketplace-shell flex flex-col bg-black">
      <TopNav />
      <main className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_370px]" aria-busy="true" aria-label="Loading event details">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
          <div className="min-h-[520px] animate-pulse bg-white/[0.07]" />
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 p-6 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />)}
          </div>
          <div className="space-y-4 border-t border-white/10 p-8">
            <div className="h-7 w-52 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
        <aside className="h-[620px] animate-pulse rounded-xl border border-white/10 bg-white/[0.05]" />
      </main>
    </div>
  );
}
