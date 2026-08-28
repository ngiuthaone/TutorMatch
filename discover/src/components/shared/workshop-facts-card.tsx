"use client";

interface Fact {
  label: string;
  value: string;
  note?: string;
}

interface WorkshopFactsCardProps {
  facts: Fact[];
}

export function WorkshopFactsCard({ facts }: WorkshopFactsCardProps) {
  return (
    <div className="rounded-[32px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-8">
      <span className="block text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-[var(--quiet,#71717a)]">
        Workshop facts
      </span>
      <dl className="mt-8 grid gap-6">
        {facts.map((fact, index) => (
          <div
            key={fact.label}
            className={`pt-6 ${index === 0 ? "!border-t-0 !pt-0" : "border-t border-[rgba(255,255,255,0.08)]"}`}
          >
            <dt className="text-[0.625rem] font-extrabold uppercase tracking-[0.16em] text-[var(--quiet,#71717a)]">
              {fact.label}
            </dt>
            <dd className="mt-2 text-[0.95rem] font-bold text-white">{fact.value}</dd>
            {fact.note && (
              <small className="mt-1 block text-[0.88rem] leading-relaxed text-[var(--muted,#a1a1aa)]">
                {fact.note}
              </small>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
