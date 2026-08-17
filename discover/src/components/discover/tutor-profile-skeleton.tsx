export function TutorProfileSkeleton() {
  return (
    <main
      aria-label="Loading tutor profile"
      className="min-h-[100dvh] bg-[#101011] px-6 py-10 text-white md:px-12 lg:px-20"
    >
      <div className="mx-auto max-w-[1440px] animate-pulse">
        <div className="h-4 w-56 rounded bg-white/[0.08]" />
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(280px,444px)_minmax(0,1fr)_minmax(300px,420px)]">
          <div className="aspect-[0.82] rounded-[28px] bg-white/[0.08]" />
          <section className="space-y-7 pt-2">
            <div className="h-8 w-52 rounded bg-white/[0.1]" />
            <div className="h-14 w-72 rounded bg-white/[0.1]" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-white/[0.07]" />
              <div className="h-4 w-4/5 rounded bg-white/[0.07]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 rounded-xl bg-white/[0.07]" />
              <div className="h-24 rounded-xl bg-white/[0.07]" />
              <div className="h-24 rounded-xl bg-white/[0.07]" />
            </div>
          </section>
          <aside className="min-h-[520px] rounded-[28px] border border-white/10 bg-white/[0.05]" />
        </div>
      </div>
    </main>
  );
}
