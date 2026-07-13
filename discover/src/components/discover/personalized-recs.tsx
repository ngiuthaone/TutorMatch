"use client";

import { useEffect, useState } from "react";
import { IconArrowRight, IconSparkles, IconSchool, IconChalkboardTeacher, IconUsersGroup } from "@tabler/icons-react";

const recsByInterest: Record<string, { title: string; description: string }[]> = {
  Technology: [
    { title: "Intro to Python", description: "Learn programming from scratch" },
    { title: "Web Development Basics", description: "Build your first website" },
  ],
  Languages: [
    { title: "English for Beginners", description: "Start speaking with confidence" },
    { title: "Japanese Fundamentals", description: "Learn hiragana and basic phrases" },
  ],
  Photography: [
    { title: "DSLR for Beginners", description: "Master manual mode" },
    { title: "Mobile Photography Tips", description: "Take better photos with your phone" },
  ],
  Music: [
    { title: "Guitar for Beginners", description: "Learn your first chords" },
    { title: "Music Theory 101", description: "Understand rhythm and harmony" },
  ],
  Cooking: [
    { title: "Vietnamese Home Cooking", description: "Classic family recipes" },
    { title: "Baking Made Simple", description: "Bread, cakes, and pastries" },
  ],
};

interface SignupData {
  name: string;
  roles: string[];
  interests: string[];
}

export function PersonalizedRecs() {
  const [data, setData] = useState<SignupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tutoria_signup");
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({
          name: parsed.name || "",
          roles: parsed.roles || [],
          interests: parsed.interests || [],
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <section className="py-12">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-surface rounded-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-surface rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="py-12">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconSparkles size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Popular on Tutoria
              </h2>
              <p className="text-xs text-muted">
                Trending learning paths the community loves
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "English for Beginners", description: "Start speaking with confidence" },
              { title: "Intro to Python", description: "Learn programming from scratch" },
              { title: "DSLR for Beginners", description: "Master manual mode" },
              { title: "Guitar for Beginners", description: "Learn your first chords" },
            ].map((rec) => (
              <a
                key={rec.title}
                href="#"
                className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent hover:shadow-md hover:border-primary/20 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconSparkles size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-muted mt-1">{rec.description}</p>
                </div>
                <IconArrowRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </a>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const RoleIcon = data.roles.includes("creator")
    ? IconChalkboardTeacher
    : data.roles.includes("collaborator")
    ? IconUsersGroup
    : IconSchool;

  const roleLabel = data.roles.includes("creator")
    ? "Creator"
    : data.roles.includes("collaborator")
    ? "Collaborator"
    : "Learner";

  const matchedRecs = data.interests
    .flatMap((interest) => recsByInterest[interest] || [])
    .slice(0, 4);

  if (matchedRecs.length === 0) return null;

  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <RoleIcon size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Picked for you, {data.name || "curious mind"}
            </h2>
            <p className="text-xs text-muted">
              Based on your interests as a {roleLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {matchedRecs.map((rec) => (
            <a
              key={rec.title}
              href="#"
              className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconSparkles size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {rec.title}
                </h3>
                <p className="text-xs text-muted mt-1">{rec.description}</p>
              </div>
              <IconArrowRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
