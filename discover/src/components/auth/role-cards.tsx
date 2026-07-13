"use client";

import { IconSchool, IconChalkboardTeacher, IconUsersGroup } from "@tabler/icons-react";

const roles = [
  {
    id: "learner",
    title: "Become a Learner",
    description:
      "Discover skills, hobbies, courses, tutors, and experiences that help you grow.",
    tags: ["Photography", "English", "Cooking", "Coding"],
    icon: IconSchool,
  },
  {
    id: "creator",
    title: "Become a Creator",
    description:
      "Teach what you know, share useful content, offer sessions, and build an audience.",
    tags: ["Tutoring", "Coaching", "Courses", "Tutorials"],
    icon: IconChalkboardTeacher,
  },
  {
    id: "collaborator",
    title: "Become a Collaborator",
    description:
      "Meet people with similar interests, join communities, and turn ideas into projects.",
    tags: ["Communities", "Startups", "Volunteering", "Events"],
    icon: IconUsersGroup,
  },
];

interface RoleCardsProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function RoleCards({ selected, onChange }: RoleCardsProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {roles.map((role) => {
        const isSelected = selected.includes(role.id);
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => toggle(role.id)}
            className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background hover:border-primary/30 hover:shadow-sm"
            }`}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}

            <role.icon
              size={28}
              className={`${isSelected ? "text-primary" : "text-muted"}`}
            />

            <h3 className="mt-4 font-semibold text-foreground text-sm">{role.title}</h3>
            <p className="mt-2 text-xs text-muted leading-relaxed">{role.description}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {role.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-2 py-0.5 text-[10px] rounded-md ${
                    isSelected
                      ? "bg-primary/10 text-primary-dark dark:text-primary-light"
                      : "bg-surface text-muted"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
