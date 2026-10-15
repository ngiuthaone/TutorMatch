"use client";
import React, { useState } from "react";
import { TUTORIA_CREATOR_COLORS, FONT_DISPLAY, FONT_MONO } from "./course-creator-shell";

const COLORS = TUTORIA_CREATOR_COLORS;
const CATEGORIES = ["Development", "Business", "Finance", "Food & Beverage", "IT & Software", "Office Productivity", "Personal Development", "Design", "Marketing", "Lifestyle", "Photography & Video", "Health & Fitness", "Music", "Teaching & Academics"];
const TIME_OPTIONS = [
  { id: "0-2h", label: "0–2 hours" },
  { id: "2-4h", label: "2–4 hours" },
  { id: "5+h", label: "5+ hours" },
  { id: "undecided", label: "I'm undecided" },
] as const;
const TYPE_OPTIONS = [
  { id: "course" as const, title: "Course", description: "Create rich learning experiences with video, quizzes, and assignments." },
  { id: "practice-test" as const, title: "Practice Test", description: "Help learners prepare for certification with timed practice tests." },
];

export type WeeklyTime = "0-2h" | "2-4h" | "5+h" | "undecided";
export type CourseType = "course" | "practice-test";

export interface OnboardingData {
  type: CourseType;
  title: string;
  category: string;
  weeklyTime: WeeklyTime;
}

export interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
  onExit?: () => void;
  initial?: Partial<OnboardingData>;
}

export function OnboardingWizard({ onComplete, onExit, initial }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<CourseType>(initial?.type ?? "course");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [weeklyTime, setWeeklyTime] = useState<WeeklyTime>(initial?.weeklyTime ?? "undecided");
  const total = 4;
  const progress = ((step + 1) / total) * 100;
  const canProceed = (step === 0 && !!type) || (step === 1 && title.trim().length > 0 && title.length <= 60) || (step === 2 && !!category) || (step === 3 && !!weeklyTime);

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: COLORS.bg, color: COLORS.ink, fontFamily: FONT_DISPLAY }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.035em", textTransform: "uppercase", opacity: 0.5 }}>Step {step + 1} of {total}</div>
          {onExit ? <button type="button" onClick={onExit} style={{ background: "transparent", color: COLORS.ink, border: "none", cursor: "pointer", opacity: 0.7, fontSize: 14 }}>Exit</button> : null}
        </div>
        <div style={{ height: 4, width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 4, marginBottom: 40, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: COLORS.accent, transition: "all 0.2s" }} />
        </div>

        {step === 0 ? (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 8px 0" }}>What do you want to create?</h1>
            <p style={{ fontSize: 14, opacity: 0.6, margin: "0 0 32px 0" }}>Choose the format that best fits your teaching goal.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => setType(opt.id)} style={{ textAlign: "left", padding: 24, borderRadius: 8, background: type === opt.id ? COLORS.panel : COLORS.input, border: `1px solid ${type === opt.id ? "rgba(228,228,229,0.4)" : "rgba(228,228,229,0.10)"}`, color: COLORS.ink, cursor: "pointer" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{opt.title}</div>
                  <div style={{ fontSize: 14, opacity: 0.7 }}>{opt.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 8px 0" }}>Working title</h1>
            <p style={{ fontSize: 14, opacity: 0.6, margin: "0 0 32px 0" }}>You can change this anytime. Keep it under 60 characters.</p>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Introduction to Photography" style={{ width: "100%", padding: "12px 16px", borderRadius: 6, fontSize: 16, background: COLORS.input, color: COLORS.ink, border: "1px solid rgba(228,228,229,0.15)", outline: "none", fontFamily: FONT_DISPLAY, boxSizing: "border-box" }} />
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.5, fontFamily: FONT_MONO }}>{title.length} / 60</div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 8px 0" }}>What category?</h1>
            <p style={{ fontSize: 14, opacity: 0.6, margin: "0 0 32px 0" }}>Pick the most relevant category for your audience.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat)} style={{ textAlign: "left", padding: "12px 16px", borderRadius: 6, fontSize: 14, background: category === cat ? COLORS.panel : COLORS.input, border: `1px solid ${category === cat ? "rgba(228,228,229,0.4)" : "rgba(228,228,229,0.10)"}`, color: COLORS.ink, cursor: "pointer", fontFamily: FONT_DISPLAY }}>{cat}</button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 8px 0" }}>Weekly time estimate</h1>
            <p style={{ fontSize: 14, opacity: 0.6, margin: "0 0 32px 0" }}>How much time will learners need each week to complete this?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {TIME_OPTIONS.map((t) => (
                <button key={t.id} type="button" onClick={() => setWeeklyTime(t.id)} style={{ textAlign: "left", padding: 16, borderRadius: 6, fontSize: 14, background: weeklyTime === t.id ? COLORS.panel : COLORS.input, border: `1px solid ${weeklyTime === t.id ? "rgba(228,228,229,0.4)" : "rgba(228,228,229,0.10)"}`, color: COLORS.ink, cursor: "pointer", fontFamily: FONT_DISPLAY }}>{t.label}</button>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 48 }}>
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ background: "transparent", color: COLORS.ink, opacity: step === 0 ? 0.3 : 0.7, border: "none", cursor: "pointer", fontSize: 14 }}>← Previous</button>
          <button type="button" disabled={!canProceed} onClick={() => { if (step < total - 1) { setStep(step + 1); } else { onComplete({ type, title: title.trim(), category, weeklyTime }); } }} style={{ padding: "8px 20px", borderRadius: 6, fontSize: 14, fontWeight: 600, background: COLORS.accent, color: COLORS.bg, border: "none", cursor: "pointer", opacity: canProceed ? 1 : 0.3 }}>{step < total - 1 ? "Next →" : "Create course →"}</button>
        </div>
      </div>
    </div>
  );
}
