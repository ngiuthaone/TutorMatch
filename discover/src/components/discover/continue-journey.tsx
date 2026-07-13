"use client";

import { IconArrowRight, IconCamera, IconCode, IconMusic, IconBooks, IconRun } from "@tabler/icons-react";

const starters = [
  { icon: IconCamera, label: "Photography", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { icon: IconCode, label: "Coding", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" },
  { icon: IconMusic, label: "Music", color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300" },
  { icon: IconBooks, label: "Languages", color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" },
  { icon: IconRun, label: "Fitness", color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300" },
];

interface ContinueJourneyProps {
  isNewUser?: boolean;
}

export function ContinueJourney({ isNewUser = false }: ContinueJourneyProps) {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {isNewUser ? "Start with something you love" : "Continue your journey"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isNewUser
              ? "Pick a topic that sparks your curiosity and dive in."
              : "Pick up where you left off."}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {starters.map((item) => (
            <a
              key={item.label}
              href="#"
              className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                <item.icon size={20} />
              </div>
              <span className="font-medium text-sm text-foreground">{item.label}</span>
              <IconArrowRight size={14} className="ml-auto text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
