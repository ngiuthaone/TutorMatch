"use client";

const interestCategories = [
  "Academic subjects",
  "Languages",
  "Technology",
  "Business",
  "Art and design",
  "Photography",
  "Music",
  "Cooking",
  "Beauty and nails",
  "Sports and fitness",
  "Personal development",
  "Entrepreneurship",
  "Volunteering",
  "Other",
];

interface InterestsGridProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function InterestsGrid({ selected, onChange }: InterestsGridProps) {
  const toggle = (interest: string) => {
    if (selected.includes(interest)) {
      onChange(selected.filter((s) => s !== interest));
    } else {
      onChange([...selected, interest]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      {interestCategories.map((interest) => {
        const isSelected = selected.includes(interest);
        return (
          <button
            key={interest}
            type="button"
            onClick={() => toggle(interest)}
            className={`px-4 py-2.5 text-sm rounded-xl border-2 transition-all duration-200 ${
              isSelected
                ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light font-medium"
                : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-surface"
            }`}
          >
            {interest}
          </button>
        );
      })}
    </div>
  );
}
