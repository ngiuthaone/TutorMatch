"use client";

import { useState } from "react";

const learningStyles = [
  "One-on-one",
  "Courses",
  "Tutorials",
  "Articles",
  "Workshops",
  "Communities",
];

const experienceTypes = ["Online", "In person", "Both"];

export function PreferencesForm() {
  const [learningStyle, setLearningStyle] = useState("");
  const [experienceType, setExperienceType] = useState("");
  const [location, setLocation] = useState("");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          How do you prefer to learn?
        </label>
        <div className="flex flex-wrap gap-2">
          {learningStyles.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setLearningStyle(style === learningStyle ? "" : style)}
              className={`px-4 py-2 text-sm rounded-xl border transition-all duration-200 ${
                learningStyle === style
                  ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light font-medium"
                  : "border-border text-foreground hover:border-primary/30"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Are you interested in online or in-person experiences?
        </label>
        <div className="flex flex-wrap gap-2">
          {experienceTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExperienceType(type === experienceType ? "" : type)}
              className={`px-4 py-2 text-sm rounded-xl border transition-all duration-200 ${
                experienceType === type
                  ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light font-medium"
                  : "border-border text-foreground hover:border-primary/30"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Where are you based?
        </label>
        <p className="text-xs text-muted mb-2">Optional unless you want local recommendations.</p>
        <input
          type="text"
          placeholder="City, country"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
        />
      </div>
    </div>
  );
}
