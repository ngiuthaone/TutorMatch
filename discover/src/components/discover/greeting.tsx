"use client";

import { IconSparkles } from "@tabler/icons-react";

interface GreetingProps {
  isNewUser?: boolean;
}

export function Greeting({ isNewUser = false }: GreetingProps) {
  return (
    <section className="pt-12 pb-8">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary-dark dark:text-primary-light text-xs font-medium mb-4">
            <IconSparkles size={14} />
            {isNewUser ? "Welcome to Tutoria" : "Good to see you again"}
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground max-w-2xl">
            What are you curious about today?
          </h1>

        </div>
      </div>
    </section>
  );
}
