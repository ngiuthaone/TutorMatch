"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDeviceLaptop,
  IconInfoCircle,
  IconMapPin,
  IconPlus,
  IconRocket,
  IconTrash,
  IconUpload,
  IconWorld,
  IconX,
} from "@tabler/icons-react";

import styles from "./tutor-onboarding.module.css";

type TutorDraftStatus = "draft" | "pending_review";
type TutorVisibility = "public" | "unlisted" | "paused";
type TutorFaq = { id: string; question: string; answer: string };
type DraftUpdater = (updater: (draft: TutorDraft) => TutorDraft) => void;
type ValidationError = { fieldId: string; message: string };

type TutorDraft = {
  displayName: string;
  role: string;
  headline: string;
  about: string;
  photoUrl: string | null;
  introVideoName: string;
  languages: string[];
  skills: string[];
  learnerLevels: string[];
  ageGroups: string[];
  goals: string[];
  teachingStyles: string[];
  lessonDescription: string;
  lessonFormat: string;
  sessionLengths: number[];
  timeSlots: string[];
  availability: string[];
  timeZone: string;
  calendarConnected: boolean;
  bookingNotice: string;
  bookingWindow: string;
  lessonBuffer: string;
  sameDayBooking: boolean;
  exceptions: string[];
  rates: Record<string, number>;
  learnerCancellation: string;
  lateCancellation: string;
  noShowPolicy: string;
  consultationEnabled: boolean;
  consultationDuration: string;
  consultationPrice: string;
  consultationPurpose: string;
  faqs: TutorFaq[];
  visibility: TutorVisibility;
  status: TutorDraftStatus;
  submittedAt?: string;
  updatedAt?: string;
};

const DRAFT_KEY = "tutoria_tutor_profile_draft";
const SUBMISSION_KEY = "tutoria_tutor_profile_submission";
const steps = [
  { title: "Profile", description: "Introduce yourself and build trust" },
  { title: "Teaching offer", description: "What you teach and who you help" },
  { title: "Availability & format", description: "Set when, where, and how you teach" },
  { title: "Pricing & policies", description: "Set your rates and lesson policies" },
  { title: "Preview & publish", description: "Review and launch your profile" },
];

const levelOptions = ["Complete beginners", "Intermediate learners", "Advanced learners", "Professional practitioners"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const defaultTimeSlots = ["09:00-12:00", "14:00-18:00", "18:00-21:00"];
const formatOptions = [
  { value: "Online", note: "Teach using video calls" },
  { value: "At my teaching space", note: "Learners come to you" },
  { value: "At learners' location", note: "You go to them" },
  { value: "Public place", note: "Meet at a public place" },
];

const stepQuestions = [
  "Tell learners who you are",
  "Shape your teaching offer",
  "When and how will you teach?",
  "Set rates and policies",
  "Review your tutor profile",
];

const onboardingFaqs = [
  { question: "What do I need before I apply?", answer: "Prepare a clear profile photo, a short introduction, the subjects you teach, your availability, and your lesson rates." },
  { question: "Can I save my progress and finish later?", answer: "Yes. Your draft is saved in this browser, and you can return to update any section before submitting it for review." },
  { question: "What happens after I submit my profile?", answer: "Tutoria reviews your profile before it is published. You can still preview your information while the review is in progress." },
];

const defaultDraft: TutorDraft = {
  displayName: "",
  role: "",
  headline: "",
  about: "",
  photoUrl: null,
  introVideoName: "",
  languages: [],
  skills: [],
  learnerLevels: [],
  ageGroups: [],
  goals: [],
  teachingStyles: [],
  lessonDescription: "",
  lessonFormat: "Online",
  sessionLengths: [],
  timeSlots: defaultTimeSlots,
  availability: [],
  timeZone: "GMT+7 - Asia/Bangkok",
  calendarConnected: false,
  bookingNotice: "12 hours",
  bookingWindow: "30 days",
  lessonBuffer: "15 minutes",
  sameDayBooking: false,
  exceptions: [],
  rates: {},
  learnerCancellation: "Full refund until 24h before lesson",
  lateCancellation: "50% lesson fee",
  noShowPolicy: "Full lesson fee",
  consultationEnabled: false,
  consultationDuration: "15 minutes",
  consultationPrice: "Free",
  consultationPurpose: "Discuss goals and compatibility",
  faqs: [],
  visibility: "public",
  status: "draft",
};

function normalizeDraft(value: Partial<TutorDraft>): TutorDraft {
  const normalizeRange = (item: string) => item.replace(/[—–]/g, "-");
  return {
    ...defaultDraft,
    ...value,
    languages: Array.isArray(value.languages) ? value.languages : defaultDraft.languages,
    skills: Array.isArray(value.skills) ? value.skills : defaultDraft.skills,
    learnerLevels: Array.isArray(value.learnerLevels) ? value.learnerLevels : defaultDraft.learnerLevels,
    ageGroups: Array.isArray(value.ageGroups) ? value.ageGroups.map(normalizeRange) : defaultDraft.ageGroups,
    goals: Array.isArray(value.goals) ? value.goals : defaultDraft.goals,
    teachingStyles: Array.isArray(value.teachingStyles) ? value.teachingStyles : defaultDraft.teachingStyles,
    sessionLengths: Array.isArray(value.sessionLengths) ? value.sessionLengths : defaultDraft.sessionLengths,
    timeSlots: Array.isArray(value.timeSlots) ? value.timeSlots.map(normalizeRange).filter((slot) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) : defaultDraft.timeSlots,
    availability: Array.isArray(value.availability) ? value.availability.map(normalizeRange) : defaultDraft.availability,
    timeZone: value.timeZone ? normalizeRange(value.timeZone) : defaultDraft.timeZone,
    exceptions: Array.isArray(value.exceptions) ? value.exceptions.map((item) => normalizeRange(item).replace(" · ", ": ")) : defaultDraft.exceptions,
    faqs: Array.isArray(value.faqs) ? value.faqs.filter((faq): faq is TutorFaq => Boolean(faq && typeof faq.question === "string" && typeof faq.answer === "string")).map((faq, index) => ({ id: faq.id || `faq-${index}`, question: faq.question, answer: faq.answer })) : defaultDraft.faqs,
    rates: { ...defaultDraft.rates, ...(value.rates || {}) },
  };
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatVnd(value: number) {
  return `${Math.max(0, value || 0).toLocaleString("vi-VN")} đ`;
}

function validateStep(step: number, draft: TutorDraft): ValidationError[] {
  if (step === 0) {
    return [
      !draft.photoUrl && { fieldId: "profile-photo", message: "Add a profile photo." },
      !draft.displayName.trim() && { fieldId: "display-name", message: "Enter your display name." },
      !draft.role.trim() && { fieldId: "role", message: "Add your role." },
      draft.headline.trim().length < 20 && { fieldId: "professional-headline", message: "Write a headline of at least 20 characters." },
      draft.about.trim().length < 80 && { fieldId: "about-you", message: "Tell learners more about yourself (at least 80 characters)." },
      draft.languages.length === 0 && { fieldId: "languages", message: "Add at least one language." },
    ].filter(Boolean) as ValidationError[];
  }
  if (step === 1) {
    return [
      draft.skills.length === 0 && { fieldId: "skills", message: "Add at least one skill." },
      draft.learnerLevels.length === 0 && { fieldId: "learner-levels", message: "Choose at least one learner level." },
      draft.ageGroups.length === 0 && { fieldId: "age-groups", message: "Add at least one learner group." },
      draft.teachingStyles.length === 0 && { fieldId: "teaching-styles", message: "Add at least one teaching style." },
      draft.goals.length === 0 && { fieldId: "learner-goals", message: "Add at least one learner goal." },
      draft.lessonDescription.trim().length < 40 && { fieldId: "lesson-description", message: "Describe what happens in a typical lesson." },
    ].filter(Boolean) as ValidationError[];
  }
  if (step === 2) {
    return [
      draft.sessionLengths.length === 0 && { fieldId: "session-lengths", message: "Choose at least one session length." },
      draft.availability.length === 0 && { fieldId: "weekly-availability", message: "Choose at least one available time." },
    ].filter(Boolean) as ValidationError[];
  }
  if (step === 3) {
    return draft.sessionLengths.some((length) => !draft.rates[String(length)] || draft.rates[String(length)] < 50000)
      ? [{ fieldId: "lesson-rates", message: "Set a rate of at least 50,000 đ for every session length." }]
      : [];
  }
  return [];
}

function ProgressRail({ activeStep, onSelect }: { activeStep: number; onSelect: (step: number) => void }) {
  return (
    <nav className={styles.progressRail} aria-label="Tutor profile setup">
      <span className={styles.mobileStepSummary}>Step {activeStep + 1} of {steps.length}: {steps[activeStep].title}</span>
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        return (
          <button className={`${styles.progressStep} ${isActive ? styles.progressStepActive : ""}`} key={step.title} onClick={() => onSelect(index)} type="button" aria-label={`${isDone ? "Completed" : isActive ? "Current" : "Go to"}: ${step.title}`} aria-current={isActive ? "step" : undefined}>
            <span className={styles.progressMarkerWrap}>
              <span className={`${styles.progressMarker} ${isDone ? styles.progressMarkerDone : ""}`}>{isDone ? <IconCheck size={13} stroke={2.5} /> : String(index + 1).padStart(2, "0")}</span>
              {index < steps.length - 1 && <span className={styles.progressLine} />}
            </span>
            <span className={styles.progressCopy}><strong>{step.title}</strong><span>{step.description}</span></span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeading({ step, title, description }: { step: number; title: string; description: string }) {
  return <header className={styles.sectionHeading}><span>{title}</span><h2>{stepQuestions[step - 1]}</h2><p>{description}</p></header>;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  if (htmlFor) return <label className={styles.label} htmlFor={htmlFor}>{children}</label>;
  return <span className={styles.label}>{children}</span>;
}

function FieldError({ errors, fieldId }: { errors: ValidationError[]; fieldId: string }) {
  const error = errors.find((item) => item.fieldId === fieldId);
  if (!error) return null;
  return <span className={styles.fieldError} id={`${fieldId}-error`} role="alert"><IconAlertTriangle size={15} /> {error.message}</span>;
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return <span className={styles.chip}>{children}<button type="button" onClick={onRemove} aria-label={`Remove ${String(children)}`}><IconX size={13} /></button></span>;
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className={styles.checkRow}><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>;
}

function SelectControl({ value, options, onChange, label }: { value: string; options: string[]; onChange: (value: string) => void; label: string }) {
  return (
    <span className={styles.selectControl}>
      <select className={styles.selectNative} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <IconChevronDown size={15} aria-hidden="true" />
    </span>
  );
}

function InlineAdder({ label, placeholder, onAdd, numeric = false }: { label: string; placeholder: string; onAdd: (value: string) => void; numeric?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const next = value.trim();
    if (!next) return;
    onAdd(next);
    setValue("");
    setOpen(false);
  };

  if (!open) return <button className={styles.addButton} type="button" onClick={() => setOpen(true)}><IconPlus size={14} /> {label}</button>;
  return (
    <span className={styles.inlineAdder}>
      <input className={styles.inlineInput} type={numeric ? "number" : "text"} value={value} placeholder={placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } if (event.key === "Escape") setOpen(false); }} autoFocus aria-label={placeholder} />
      <button type="button" onClick={submit}>Add</button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"><IconX size={13} /></button>
    </span>
  );
}

function ValidationNotice({ errors }: { errors: ValidationError[] }) {
  if (!errors.length) return null;
  return <div className={styles.validationNotice} role="alert"><strong>Please complete this step</strong><ul>{errors.map((error) => <li key={error.fieldId}><button type="button" onClick={() => document.getElementById(error.fieldId)?.focus()}>{error.message}</button></li>)}</ul></div>;
}

function ProfileStep({ draft, update, errors }: { draft: TutorDraft; update: DraftUpdater; errors: ValidationError[] }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof TutorDraft>(key: K, value: TutorDraft[K]) => update((current) => ({ ...current, [key]: value }));
  const hasError = (fieldId: string) => errors.some((error) => error.fieldId === fieldId);

  const loadPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        set("photoUrl", canvas.toDataURL("image/jpeg", .82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <SectionHeading step={1} title="Profile" description="Help learners get to know you." />
      <div className={styles.profileGrid}>
        <div className={styles.photoColumn} id="profile-photo" tabIndex={-1} aria-describedby={hasError("profile-photo") ? "profile-photo-error" : undefined}>
          <FieldLabel>Profile photo</FieldLabel>
          <div className={`${styles.profilePhoto} ${!draft.photoUrl ? styles.photoPlaceholder : ""}`} style={draft.photoUrl ? { backgroundImage: `url(${draft.photoUrl})` } : undefined} role="img" aria-label={`${draft.displayName || "Tutor"} profile portrait`}>{!draft.photoUrl && "Add a photo"}</div>
          <input ref={photoInput} className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadPhoto(event.target.files?.[0])} />
          <div className={styles.photoActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => photoInput.current?.click()}>Change photo</button>
            <button className={styles.textButtonMuted} type="button" onClick={() => set("photoUrl", null)}>Remove</button>
          </div>
          <FieldError errors={errors} fieldId="profile-photo" />
        </div>
        <div className={styles.profileFields}>
          <div><FieldLabel htmlFor="display-name">Display name</FieldLabel><input id="display-name" className={styles.input} value={draft.displayName} onChange={(event) => set("displayName", event.target.value)} aria-invalid={hasError("display-name")} aria-describedby={hasError("display-name") ? "display-name-error" : undefined} /><FieldError errors={errors} fieldId="display-name" /></div>
          <div><FieldLabel htmlFor="role">Role</FieldLabel><input id="role" className={styles.input} value={draft.role} maxLength={80} placeholder="e.g. Karate coach" onChange={(event) => set("role", event.target.value)} aria-invalid={hasError("role")} aria-describedby={hasError("role") ? "role-error" : undefined} /><FieldError errors={errors} fieldId="role" /></div>
          <div><FieldLabel htmlFor="professional-headline">Professional headline</FieldLabel><textarea id="professional-headline" className={`${styles.input} ${styles.headlineInput}`} value={draft.headline} maxLength={100} onChange={(event) => set("headline", event.target.value)} aria-invalid={hasError("professional-headline")} aria-describedby={hasError("professional-headline") ? "professional-headline-error" : "professional-headline-count"} /><span className={styles.counter} id="professional-headline-count">{draft.headline.length}/100</span><FieldError errors={errors} fieldId="professional-headline" /></div>
          <div><FieldLabel htmlFor="about-you">About you</FieldLabel><textarea id="about-you" className={`${styles.input} ${styles.aboutInput}`} value={draft.about} maxLength={500} onChange={(event) => set("about", event.target.value)} aria-invalid={hasError("about-you")} aria-describedby={hasError("about-you") ? "about-you-error" : "about-you-count"} /><span className={styles.counter} id="about-you-count">{draft.about.length}/500</span><FieldError errors={errors} fieldId="about-you" /></div>
        </div>
      </div>
      <div className={styles.formSection}>
        <FieldLabel>Introduction video (optional) <IconInfoCircle className={styles.infoDot} size={16} aria-hidden="true" /></FieldLabel>
        <input ref={videoInput} className={styles.hiddenInput} type="file" accept="video/*" onChange={(event) => set("introVideoName", event.target.files?.[0]?.name || "")} />
        <button className={styles.uploadField} type="button" onClick={() => videoInput.current?.click()}>
          <span className={styles.uploadIcon}>{draft.introVideoName ? <IconCheck size={21} /> : <IconUpload size={21} />}</span>
          <span className={styles.uploadCopy}><strong>{draft.introVideoName || "Upload a 30-90 second video"}</strong><small>{draft.introVideoName ? "Video selected. Click to replace it." : "Share who you are, what you teach, and how you help."}</small></span>
          <span className={styles.secondaryButton}>{draft.introVideoName ? "Replace video" : "Upload video"}</span>
        </button>
        {draft.introVideoName && <button className={styles.textButtonMuted} type="button" onClick={() => set("introVideoName", "")}>Remove video</button>}
      </div>
      <div className={styles.formSection} id="languages" tabIndex={-1} aria-describedby={hasError("languages") ? "languages-error" : undefined}>
        <FieldLabel>Languages</FieldLabel>
        <div className={styles.chipRow}>
          {draft.languages.map((language) => <Chip key={language} onRemove={() => set("languages", draft.languages.filter((item) => item !== language))}>{language}</Chip>)}
          <InlineAdder label="Add language" placeholder="e.g. French (Fluent)" onAdd={(value) => { if (!draft.languages.includes(value)) set("languages", [...draft.languages, value]); }} />
        </div>
        <FieldError errors={errors} fieldId="languages" />
      </div>
    </>
  );
}

function TeachingStep({ draft, update, errors }: { draft: TutorDraft; update: DraftUpdater; errors: ValidationError[] }) {
  const set = <K extends keyof TutorDraft>(key: K, value: TutorDraft[K]) => update((current) => ({ ...current, [key]: value }));
  const hasError = (fieldId: string) => errors.some((error) => error.fieldId === fieldId);
  return (
    <>
      <SectionHeading step={2} title="Teaching offer" description="Define what you teach, who you help, and how." />
      <div className={styles.formSection} id="skills" tabIndex={-1} aria-describedby={hasError("skills") ? "skills-error" : undefined}><FieldLabel>Skills &amp; specialties</FieldLabel><div className={styles.chipRow}>{draft.skills.map((skill) => <Chip key={skill} onRemove={() => set("skills", draft.skills.filter((item) => item !== skill))}>{skill}</Chip>)}{!draft.skills.length && <span className={styles.emptyHint}>No skills added yet.</span>}<InlineAdder label="Add another skill" placeholder="e.g. Wheel throwing" onAdd={(value) => { if (!draft.skills.includes(value)) set("skills", [...draft.skills, value]); }} /></div><FieldError errors={errors} fieldId="skills" /></div>
      <div className={styles.twoColumnGrid}>
        <section className={styles.groupPanel} id="learner-levels" tabIndex={-1} aria-describedby={hasError("learner-levels") ? "learner-levels-error" : undefined}><FieldLabel>Learner levels</FieldLabel><div className={styles.optionList}>{levelOptions.map((level) => <CheckRow key={level} label={level} checked={draft.learnerLevels.includes(level)} onChange={() => set("learnerLevels", toggleValue(draft.learnerLevels, level))} />)}</div><FieldError errors={errors} fieldId="learner-levels" /></section>
        <section className={styles.groupPanel} id="age-groups" tabIndex={-1} aria-describedby={hasError("age-groups") ? "age-groups-error" : undefined}><FieldLabel>Who do you teach?</FieldLabel><p className={styles.fieldHint}>Name the people you teach, in the terms that fit your practice.</p><div className={styles.chipRow}>{draft.ageGroups.map((group) => <Chip key={group} onRemove={() => set("ageGroups", draft.ageGroups.filter((item) => item !== group))}>{group}</Chip>)}{!draft.ageGroups.length && <span className={styles.emptyHint}>Add the learners you’re best placed to help.</span>}<InlineAdder label="Add learner group" placeholder="e.g. Amateur fighters" onAdd={(value) => { if (!draft.ageGroups.includes(value)) set("ageGroups", [...draft.ageGroups, value]); }} /></div><FieldError errors={errors} fieldId="age-groups" /></section>
      </div>
      <div className={styles.twoColumnGrid}>
        <section className={styles.groupPanel} id="teaching-styles" tabIndex={-1} aria-describedby={hasError("teaching-styles") ? "teaching-styles-error" : undefined}><FieldLabel>Your teaching style</FieldLabel><p className={styles.fieldHint}>Describe the methods that make your lessons yours.</p><div className={styles.chipRow}>{draft.teachingStyles.map((style) => <Chip key={style} onRemove={() => set("teachingStyles", draft.teachingStyles.filter((item) => item !== style))}>{style}</Chip>)}{!draft.teachingStyles.length && <span className={styles.emptyHint}>Add the methods learners can expect from your lessons.</span>}<InlineAdder label="Add teaching style" placeholder="e.g. Sparring drills and video feedback" onAdd={(value) => { if (!draft.teachingStyles.includes(value)) set("teachingStyles", [...draft.teachingStyles, value]); }} /></div><FieldError errors={errors} fieldId="teaching-styles" /></section>
        <section className={styles.groupPanel} id="learner-goals" tabIndex={-1} aria-describedby={hasError("learner-goals") ? "learner-goals-error" : undefined}><FieldLabel>What can you help learners achieve?</FieldLabel><div className={styles.goalList}>{draft.goals.map((goal, index) => <div className={styles.goal} key={goal}><span>{String(index + 1).padStart(2, "0")}</span><strong>{goal}</strong><button type="button" onClick={() => set("goals", draft.goals.filter((item) => item !== goal))} aria-label={`Remove ${goal}`}><IconX size={15} /></button></div>)}{!draft.goals.length && <span className={styles.emptyHint}>No learner goals added yet.</span>}</div><InlineAdder label="Add another goal" placeholder="Learners will be able to..." onAdd={(value) => set("goals", [...draft.goals, value])} /><FieldError errors={errors} fieldId="learner-goals" /></section>
      </div>
      <div className={styles.formSection}><FieldLabel htmlFor="lesson-description">What happens in a typical lesson?</FieldLabel><textarea id="lesson-description" className={`${styles.input} ${styles.lessonInput}`} value={draft.lessonDescription} onChange={(event) => set("lessonDescription", event.target.value)} aria-invalid={hasError("lesson-description")} aria-describedby={hasError("lesson-description") ? "lesson-description-error" : "lesson-description-count"} /><span className={styles.counter} id="lesson-description-count">{draft.lessonDescription.length} characters</span><FieldError errors={errors} fieldId="lesson-description" /></div>
    </>
  );
}

function AvailabilityStep({ draft, update, errors }: { draft: TutorDraft; update: DraftUpdater; errors: ValidationError[] }) {
  const set = <K extends keyof TutorDraft>(key: K, value: TutorDraft[K]) => update((current) => ({ ...current, [key]: value }));
  const hasError = (fieldId: string) => errors.some((error) => error.fieldId === fieldId);
  return (
    <>
      <SectionHeading step={3} title="Availability & format" description="Set your teaching format, location, and schedule." />
      <div className={styles.availabilityGrid}>
        <div className={styles.availabilityLeft}>
          <section className={styles.groupPanel}><FieldLabel>Lesson format</FieldLabel><div className={styles.formatGrid}>{formatOptions.map((format) => <label className={`${styles.formatCard} ${draft.lessonFormat === format.value ? styles.formatCardActive : ""}`} key={format.value}><input type="radio" name="lesson-format" checked={draft.lessonFormat === format.value} onChange={() => set("lessonFormat", format.value)} /><span><strong>{format.value}</strong><small>{format.note}</small></span></label>)}</div></section>
          <section className={styles.groupPanel} id="session-lengths" tabIndex={-1} aria-describedby={hasError("session-lengths") ? "session-lengths-error" : undefined}><FieldLabel>Session lengths</FieldLabel><div className={styles.optionList}>{[30, 50, 60, 90].map((length) => <CheckRow key={length} label={`${length} minutes`} checked={draft.sessionLengths.includes(length)} onChange={() => set("sessionLengths", toggleValue(draft.sessionLengths, length).sort((a, b) => a - b))} />)}</div><InlineAdder label="Add another duration" placeholder="Minutes" numeric onAdd={(value) => { const minutes = Number(value); if (minutes >= 15 && !draft.sessionLengths.includes(minutes)) set("sessionLengths", [...draft.sessionLengths, minutes].sort((a, b) => a - b)); }} /><FieldError errors={errors} fieldId="session-lengths" /></section>
        </div>
        <div className={styles.availabilityRight}>
          <section className={styles.groupPanel} id="weekly-availability" tabIndex={-1} aria-describedby={hasError("weekly-availability") ? "weekly-availability-error" : undefined}><FieldLabel>Weekly availability</FieldLabel><div className={styles.calendarGrid}><span />{days.map((day) => <strong key={day}>{day}</strong>)}{draft.timeSlots.flatMap((slot) => [<small key={`${slot}-label`}>{slot}</small>, ...days.map((_, index) => { const key = `${slot}-${index}`; const active = draft.availability.includes(key); return <button className={active ? styles.timeActive : ""} key={key} type="button" onClick={() => set("availability", toggleValue(draft.availability, key))} aria-label={`${active ? "Remove" : "Add"} ${days[index]} ${slot}`} aria-pressed={active}>{active && <IconCheck size={15} />}</button>; })])}</div><div className={styles.intervalManager}><span>Teaching intervals</span><div className={styles.chipRow}>{draft.timeSlots.map((slot) => <Chip key={slot} onRemove={() => update((current) => ({ ...current, timeSlots: current.timeSlots.filter((item) => item !== slot), availability: current.availability.filter((item) => !item.startsWith(`${slot}-`)) }))}>{slot}</Chip>)}<InlineAdder label="Add interval" placeholder="e.g. 10:00-13:00" onAdd={(value) => { const interval = value.replace(/\s/g, ""); if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(interval) && !draft.timeSlots.includes(interval)) set("timeSlots", [...draft.timeSlots, interval]); }} /></div></div><FieldError errors={errors} fieldId="weekly-availability" /></section>
          <div className={styles.twoColumnGridCompact}>
            <section className={styles.groupPanel}><FieldLabel>Booking rules</FieldLabel><div className={styles.stackFields}><SelectControl label="Minimum booking notice" value={draft.bookingNotice} options={["2 hours", "6 hours", "12 hours", "24 hours", "48 hours"]} onChange={(value) => set("bookingNotice", value)} /><SelectControl label="Booking window" value={draft.bookingWindow} options={["14 days", "30 days", "60 days", "90 days"]} onChange={(value) => set("bookingWindow", value)} /><SelectControl label="Lesson buffer" value={draft.lessonBuffer} options={["No buffer", "10 minutes", "15 minutes", "30 minutes"]} onChange={(value) => set("lessonBuffer", value)} /><label className={styles.toggleRow}>Allow same-day booking <input className={styles.toggle} type="checkbox" checked={draft.sameDayBooking} onChange={(event) => set("sameDayBooking", event.target.checked)} /></label></div></section>
            <ExceptionsPanel draft={draft} setExceptions={(exceptions) => set("exceptions", exceptions)} />
          </div>
        </div>
        <aside className={styles.availabilityMeta}>
          <section className={styles.groupPanel}><FieldLabel>Time zone</FieldLabel><SelectControl label="Time zone" value={draft.timeZone} options={["GMT+7 - Asia/Bangkok", "GMT+8 - Asia/Singapore", "GMT+9 - Asia/Tokyo", "UTC - Coordinated Universal Time"]} onChange={(value) => set("timeZone", value)} /></section>
          <section className={styles.groupPanel}><FieldLabel>Calendar connection</FieldLabel><button className={styles.connectedField} type="button" onClick={() => set("calendarConnected", !draft.calendarConnected)}><span className={styles.googleDot}>G</span> Google Calendar <strong>{draft.calendarConnected ? "Connected" : "Connect"}</strong></button></section>
          <ExceptionsPanel draft={draft} setExceptions={(exceptions) => set("exceptions", exceptions)} />
        </aside>
      </div>
    </>
  );
}

function ExceptionsPanel({ draft, setExceptions }: { draft: TutorDraft; setExceptions: (exceptions: string[]) => void }) {
  return <section className={styles.groupPanel}><FieldLabel>Time off &amp; exceptions</FieldLabel>{draft.exceptions.map((exception) => <div className={styles.exception} key={exception}><strong>{exception}</strong><button type="button" onClick={() => setExceptions(draft.exceptions.filter((item) => item !== exception))} aria-label={`Remove ${exception}`}><IconX size={15} /></button></div>)}{!draft.exceptions.length && <p className={styles.emptyHint}>No time off added.</p>}<InlineAdder label="Add exception" placeholder="e.g. 12 Aug 2026: Unavailable" onAdd={(value) => setExceptions([...draft.exceptions, value])} /></section>;
}

function PricingStep({ draft, update, errors }: { draft: TutorDraft; update: DraftUpdater; errors: ValidationError[] }) {
  const set = <K extends keyof TutorDraft>(key: K, value: TutorDraft[K]) => update((current) => ({ ...current, [key]: value }));
  const hasError = (fieldId: string) => errors.some((error) => error.fieldId === fieldId);
  const selectedRate = draft.rates["60"] || draft.rates[String(draft.sessionLengths[0])] || 0;
  const tutorFee = Math.round(selectedRate * 0.1);
  const processingFee = Math.round(selectedRate * 0.03);
  const payout = selectedRate - tutorFee - processingFee;
  return (
    <>
      <SectionHeading step={4} title="Pricing & policies" description="Set your rates and lesson policies." />
      <div className={styles.pricingTopGrid}>
        <section className={styles.groupPanel} id="lesson-rates" tabIndex={-1} aria-describedby={hasError("lesson-rates") ? "lesson-rates-error" : undefined}><FieldLabel>Your lesson rates</FieldLabel><div className={styles.rateHeader}><span>Duration</span><span>Your rate (learners pay)</span></div>{draft.sessionLengths.map((duration) => <div className={styles.rateRow} key={duration}><span>{duration} minutes{duration === 60 && <em>Popular</em>}</span><label className={styles.rateEditor}><span className={styles.srOnly}>{duration} minute rate</span><input type="number" min="50000" step="10000" inputMode="numeric" value={draft.rates[String(duration)] || ""} onChange={(event) => set("rates", { ...draft.rates, [String(duration)]: Number(event.target.value) })} aria-invalid={hasError("lesson-rates")} /><small>đ</small></label></div>)}<InlineAdder label="Add duration" placeholder="Minutes" numeric onAdd={(value) => { const duration = Number(value); if (duration >= 15 && !draft.sessionLengths.includes(duration)) update((current) => ({ ...current, sessionLengths: [...current.sessionLengths, duration].sort((a, b) => a - b), rates: { ...current.rates, [String(duration)]: 100000 } })); }} /><FieldError errors={errors} fieldId="lesson-rates" /></section>
        <section className={styles.groupPanel}><FieldLabel>First session offer</FieldLabel><div className={styles.offerNumbers}><div><small>Learners pay</small><strong>{formatVnd(Math.round(selectedRate * .88))}</strong></div><div><small>You receive</small><strong>{formatVnd(Math.round(selectedRate * .8))}</strong></div></div><p className={styles.feeNote}>Tutoria promotion covers <strong>{formatVnd(Math.round(selectedRate * .12))}</strong></p></section>
        <section className={styles.groupPanel}><FieldLabel>Payout estimate ({draft.sessionLengths.includes(60) ? "60" : draft.sessionLengths[0] || "Not set"} min lesson)</FieldLabel><dl className={styles.payoutList}><div><dt>Learners pay</dt><dd>{formatVnd(selectedRate)}</dd></div><div><dt>Tutoria fee</dt><dd>-{formatVnd(tutorFee)}</dd></div><div><dt>Payment processing</dt><dd>-{formatVnd(processingFee)}</dd></div><div className={styles.payoutTotal}><dt>You receive</dt><dd>{formatVnd(payout)}</dd></div></dl><small className={styles.mutedSmall}>Fees may vary.</small></section>
      </div>
      <div className={styles.pricingBottomGrid}>
        <section className={styles.groupPanel}><FieldLabel>Cancellation policy</FieldLabel><div className={styles.policyGrid}><div><small>Learner cancellation</small><SelectControl label="Learner cancellation policy" value={draft.learnerCancellation} options={["Full refund until 12h before lesson", "Full refund until 24h before lesson", "Full refund until 48h before lesson"]} onChange={(value) => set("learnerCancellation", value)} /></div><div><small>Late cancellation</small><SelectControl label="Late cancellation policy" value={draft.lateCancellation} options={["No fee", "25% lesson fee", "50% lesson fee", "Full lesson fee"]} onChange={(value) => set("lateCancellation", value)} /></div><div><small>No-show</small><SelectControl label="No-show policy" value={draft.noShowPolicy} options={["No fee", "50% lesson fee", "Full lesson fee"]} onChange={(value) => set("noShowPolicy", value)} /></div></div></section>
        <section className={styles.groupPanel}><FieldLabel>Your cancellation</FieldLabel><ul className={styles.bulletList}><li>Learner gets a full refund</li><li>Learner can reschedule or choose another time</li><li>Repeated late cancellations may affect profile visibility</li></ul></section>
        <section className={styles.groupPanel}><label className={styles.toggleHeading}><span className={styles.label}>Short consultation (optional)</span><input className={styles.toggle} type="checkbox" checked={draft.consultationEnabled} onChange={(event) => set("consultationEnabled", event.target.checked)} /></label>{draft.consultationEnabled && <><div className={styles.consultGrid}><div><small>Duration</small><SelectControl label="Consultation duration" value={draft.consultationDuration} options={["10 minutes", "15 minutes", "20 minutes", "30 minutes"]} onChange={(value) => set("consultationDuration", value)} /></div><div><small>Price</small><SelectControl label="Consultation price" value={draft.consultationPrice} options={["Free", "50,000 đ", "100,000 đ"]} onChange={(value) => set("consultationPrice", value)} /></div></div><FieldLabel htmlFor="consultation-purpose">Purpose</FieldLabel><input id="consultation-purpose" className={styles.input} value={draft.consultationPurpose} onChange={(event) => set("consultationPurpose", event.target.value)} /></>}</section>
      </div>
      <section className={`${styles.groupPanel} ${styles.faqEditor}`} aria-labelledby="faq-editor-title">
        <div className={styles.faqEditorTop}><div><FieldLabel>Frequently asked questions</FieldLabel><h3 id="faq-editor-title">Help learners book with confidence</h3><p>Add the answers learners need before they decide to book a lesson.</p></div><button className={styles.addButton} type="button" onClick={() => set("faqs", [...draft.faqs, { id: `faq-${Date.now()}`, question: "", answer: "" }])}><IconPlus size={14} /> Add question</button></div>
        <div className={styles.faqEditorList}>
          {draft.faqs.map((faq, index) => <div className={styles.faqCard} key={faq.id}>
            <div className={styles.faqCardHeader}><span>FAQ {String(index + 1).padStart(2, "0")}</span><button type="button" onClick={() => set("faqs", draft.faqs.filter((item) => item.id !== faq.id))} disabled={draft.faqs.length === 1} aria-label={`Remove question ${index + 1}`}><IconTrash size={14} /> Remove</button></div>
            <label className={styles.faqField}><span>Question</span><input className={styles.input} value={faq.question} placeholder="What do learners often ask?" onChange={(event) => set("faqs", draft.faqs.map((item) => item.id === faq.id ? { ...item, question: event.target.value } : item))} /></label>
            <label className={styles.faqField}><span>Answer</span><textarea className={styles.input} rows={3} value={faq.answer} placeholder="Give a clear, helpful answer" onChange={(event) => set("faqs", draft.faqs.map((item) => item.id === faq.id ? { ...item, answer: event.target.value } : item))} /></label>
          </div>)}
        </div>
      </section>
    </>
  );
}

function StatusItem({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return <li className={warning ? styles.warningItem : ""}><span>{warning ? <IconAlertTriangle size={15} /> : <IconCheck size={15} />}</span>{children}</li>;
}

function PreviewStep({ draft, onOpenPreview, onMessage, onReset, onVisibilityChange }: { draft: TutorDraft; onOpenPreview: () => void; onMessage: () => void; onReset: () => void; onVisibilityChange: (visibility: TutorVisibility) => void }) {
  const submitted = draft.status === "pending_review";
  const primaryDuration = draft.sessionLengths.includes(60) ? 60 : draft.sessionLengths[0];
  const primaryRate = primaryDuration ? draft.rates[String(primaryDuration)] || 0 : 0;
  return (
    <>
      <SectionHeading step={5} title="Preview & publish" description="Review your profile before it goes live." />
      <div className={styles.previewTopGrid}>
        <section className={styles.groupPanel}><FieldLabel>Public profile preview</FieldLabel><div className={styles.publicProfile}><div className={`${styles.previewPhoto} ${!draft.photoUrl ? styles.photoPlaceholder : ""}`} style={draft.photoUrl ? { backgroundImage: `url(${draft.photoUrl})` } : undefined} role="img" aria-label={`${draft.displayName || "Tutor"} profile portrait`} /><div><h2>{draft.displayName || "Your name"} <em>New tutor</em></h2><p><strong>{draft.role || "Your role"}</strong><br />{draft.headline || "Your professional headline"}</p><small><IconMapPin size={15} /> Hà Nội, Vietnam</small><small><IconWorld size={15} /> {draft.languages.join(", ") || "Languages not set"}</small><small><IconDeviceLaptop size={15} /> {draft.lessonFormat}</small><strong>{formatVnd(primaryRate)} / {primaryDuration || "Not set"} min</strong></div></div><div className={styles.previewActions}><button className={styles.primaryButton} type="button" onClick={onOpenPreview}>View full profile</button><button className={styles.secondaryButton} type="button" onClick={onMessage}>Message</button></div></section>
        <section className={styles.groupPanel}><FieldLabel>What learners see</FieldLabel><ul className={styles.statusList}><StatusItem>About me</StatusItem><StatusItem>What I teach</StatusItem><StatusItem>Lesson format &amp; availability</StatusItem><StatusItem>Rates &amp; policies</StatusItem><StatusItem warning={!draft.faqs.some((faq) => faq.question.trim() && faq.answer.trim())}>Frequently asked questions</StatusItem><StatusItem warning={!draft.introVideoName}>Introduction video {draft.introVideoName ? "added" : "(optional)"}</StatusItem><li className={styles.pendingStatus}><span><IconClock size={15} /></span>Reviews (coming soon)</li></ul></section>
        <section className={styles.groupPanel}><FieldLabel>Publication checklist</FieldLabel><ul className={styles.statusList}><StatusItem warning={!draft.photoUrl}>Profile photo</StatusItem><StatusItem warning={draft.headline.length < 20}>Headline</StatusItem><StatusItem warning={draft.about.length < 80}>About you</StatusItem><StatusItem warning={!draft.skills.length}>Skills &amp; specialties</StatusItem><StatusItem warning={!draft.availability.length}>Availability set</StatusItem><StatusItem warning={!primaryRate}>Rates set</StatusItem><StatusItem>Policies set</StatusItem><StatusItem warning>Identity verified</StatusItem><StatusItem>Payout account connected</StatusItem></ul></section>
      </div>
      <div className={styles.previewBottomGrid}>
        <section className={styles.groupPanel}><FieldLabel>Visibility</FieldLabel><div className={styles.visibilityOptions}>{(["public", "unlisted", "paused"] as TutorVisibility[]).map((value) => <label key={value}><input type="radio" name="visibility" value={value} checked={draft.visibility === value} onChange={() => onVisibilityChange(value)} /><span><strong>{value[0].toUpperCase() + value.slice(1)}</strong><small>{value === "public" ? "Anyone can find and book you." : value === "unlisted" ? "Only people with your link can view your profile." : "Existing learners can contact you, but new learners can’t book."}</small></span></label>)}</div><div className={styles.dangerZone}><button className={styles.dangerButton} type="button" onClick={onReset}><IconTrash size={16} /> Reset application</button><small>Replace this draft with the original example.</small></div></section>
        <section className={styles.submitPanel}><IconRocket size={48} stroke={1.3} /><h2>{submitted ? "Profile submitted!" : "You’re almost there!"}</h2><p>{submitted ? "Your profile is now in review. We’ll let you know when it’s live." : "Use the review action above to send your profile. We’ll let you know once it’s live."}</p></section>
      </div>
    </>
  );
}

function TutorLivePreview({ draft }: { draft: TutorDraft }) {
  const duration = draft.sessionLengths.includes(60) ? 60 : draft.sessionLengths[0];
  const rate = duration ? draft.rates[String(duration)] || 0 : 0;
  return (
    <aside className={styles.livePreview} aria-label="Live tutor profile preview">
      <div className={styles.livePreviewTop}><strong>Live profile preview</strong><span>Updates as you type</span></div>
      <div className={`${styles.livePreviewImage} ${!draft.photoUrl ? styles.photoPlaceholder : ""}`} style={draft.photoUrl ? { backgroundImage: `url(${draft.photoUrl})` } : undefined} role="img" aria-label={`${draft.displayName || "Tutor"} profile portrait`}><span>{draft.lessonFormat}</span></div>
      <div className={styles.livePreviewBody}>
        <small>{draft.role || "Your role"}</small>
        <h2>{draft.displayName || "Your name"}</h2>
        <p>{draft.headline || "Add a clear headline so learners know how you can help."}</p>
        <dl>
          <div><dt>Based in</dt><dd>Hà Nội, Vietnam</dd></div>
          <div><dt>Languages</dt><dd>{draft.languages.slice(0, 2).join(", ") || "Not set"}</dd></div>
          <div><dt>Lesson</dt><dd>{duration ? `${duration} minutes` : "Not set"}</dd></div>
          <div><dt>From</dt><dd>{rate ? formatVnd(rate) : "Add your rates"}</dd></div>
        </dl>
      </div>
    </aside>
  );
}

function FullProfilePreview({ draft, onClose }: { draft: TutorDraft; onClose: () => void }) {
  const duration = draft.sessionLengths.includes(60) ? 60 : draft.sessionLengths[0];
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.previewModal} role="dialog" aria-modal="true" aria-labelledby="full-preview-title">
        <button className={styles.modalClose} type="button" onClick={onClose} aria-label="Close preview" autoFocus><IconX size={18} /></button>
        <div className={styles.modalHero}><div className={styles.modalPhoto} style={draft.photoUrl ? { backgroundImage: `url(${draft.photoUrl})` } : undefined} role="img" aria-label={`${draft.displayName || "Tutor"} profile portrait`} /><div><span className={styles.modalEyebrow}>Tutoria tutor preview</span><h2 id="full-preview-title">{draft.displayName || "Your name"}</h2><p>{draft.headline}</p><strong>{formatVnd(duration ? draft.rates[String(duration)] || 0 : 0)} / {duration || "Not set"} min</strong></div></div>
        <div className={styles.modalBody}><section><h3>About me</h3><p>{draft.about}</p></section><section><h3>What I teach</h3><div className={styles.chipRow}>{draft.skills.map((skill) => <span className={styles.chip} key={skill}>{skill}</span>)}</div></section><section><h3>What you’ll achieve</h3><ul>{draft.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul></section><section><h3>Lesson details</h3><p>{draft.lessonDescription}</p><p>{draft.lessonFormat}: {draft.sessionLengths.map((item) => `${item} min`).join(", ")}</p></section>{draft.faqs.some((faq) => faq.question.trim() && faq.answer.trim()) && <section><h3>Frequently asked questions</h3><div className={styles.previewFaqList}>{draft.faqs.filter((faq) => faq.question.trim() && faq.answer.trim()).map((faq) => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>}</div>
      </section>
    </div>
  );
}

export function TutorOnboarding() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [savedAt, setSavedAt] = useState("Draft saved just now");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [notice, setNotice] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [draft, setDraft] = useState<TutorDraft>(defaultDraft);

  useEffect(() => {
    const stored = window.localStorage.getItem(DRAFT_KEY);
    if (!stored) return;
    try {
      const savedDraft = normalizeDraft(JSON.parse(stored) as Partial<TutorDraft>);
      if (savedDraft.status === "pending_review") {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const frame = window.requestAnimationFrame(() => setDraft(savedDraft));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const persisted = { ...draft, updatedAt: new Date().toISOString() };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(persisted));
      setSavedAt(draft.status === "pending_review" ? "Submitted for review" : "Draft saved just now");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!showPreview && !showResetConfirm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowPreview(false);
      setShowResetConfirm(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showPreview, showResetConfirm]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeStep]);

  const updateDraft: DraftUpdater = (updater) => {
    setDraft((current) => ({ ...updater(current), status: current.status === "pending_review" ? "draft" : current.status, submittedAt: current.status === "pending_review" ? undefined : current.submittedAt }));
    setSavedAt("Saving changes...");
    setErrors([]);
  };

  const focusFirstError = (validation: ValidationError[]) => {
    window.requestAnimationFrame(() => document.getElementById(validation[0]?.fieldId)?.focus());
  };

  const saveDraft = () => {
    const persisted = { ...draft, updatedAt: new Date().toISOString() };
    setDraft(persisted);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(persisted));
    setSavedAt("Draft saved just now");
    setNotice("Draft saved.");
  };

  const continueToNextStep = () => {
    const validation = validateStep(activeStep, draft);
    if (validation.length) {
      setErrors(validation);
      focusFirstError(validation);
      return;
    }
    saveDraft();
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    setErrors([]);
  };

  const submitForReview = () => {
    const invalidStep = [0, 1, 2, 3].find((step) => validateStep(step, draft).length > 0);
    if (invalidStep !== undefined) {
      const validation = validateStep(invalidStep, draft);
      setActiveStep(invalidStep);
      setErrors(validation);
      setNotice("Complete the highlighted step before submitting.");
      window.setTimeout(() => focusFirstError(validation), 0);
      return;
    }
    const submittedDraft: TutorDraft = { ...draft, status: "pending_review", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setDraft(submittedDraft);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(submittedDraft));
    window.localStorage.setItem(SUBMISSION_KEY, JSON.stringify(submittedDraft));
    setSavedAt("Submitted for review");
    setNotice("Your tutor profile was submitted for review.");
    router.push(`/profile/${encodeURIComponent(submittedDraft.displayName)}`);
  };

  const resetDraft = () => {
    const freshDraft = { ...defaultDraft, updatedAt: new Date().toISOString() };
    setDraft(freshDraft);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(freshDraft));
    window.localStorage.removeItem(SUBMISSION_KEY);
    setActiveStep(0);
    setErrors([]);
    setSavedAt("Draft reset just now");
    setNotice("Tutor application reset.");
    setShowResetConfirm(false);
  };

  let mainContent: React.ReactNode;
  if (activeStep === 0) mainContent = <ProfileStep draft={draft} update={updateDraft} errors={errors} />;
  else if (activeStep === 1) mainContent = <TeachingStep draft={draft} update={updateDraft} errors={errors} />;
  else if (activeStep === 2) mainContent = <AvailabilityStep draft={draft} update={updateDraft} errors={errors} />;
  else if (activeStep === 3) mainContent = <PricingStep draft={draft} update={updateDraft} errors={errors} />;
  else mainContent = <PreviewStep draft={draft} onOpenPreview={() => setShowPreview(true)} onMessage={() => setNotice("Messaging becomes available after your profile is approved.")} onReset={() => setShowResetConfirm(true)} onVisibilityChange={(visibility) => updateDraft((current) => ({ ...current, visibility }))} />;

  const submitted = draft.status === "pending_review";

  return (
    <main className={styles.onboardingShell}>
      <header className={styles.topBar}>
        <div className={styles.headerInner}>
          <Link className={styles.backLink} href="/discover"><IconArrowLeft size={17} /> Back to Discover</Link>
          <div className={styles.headerTitle}><span>Tutoria creator studio</span><strong>Build your tutor profile</strong></div>
          <div className={styles.topActions}><span className={styles.savedState} aria-live="polite">{savedAt}</span><button className={styles.previewButton} type="button" onClick={saveDraft}>Save draft</button></div>
        </div>
      </header>
      <div className={styles.workspace}>
        <ProgressRail activeStep={activeStep} onSelect={(step) => { saveDraft(); setActiveStep(step); setErrors([]); }} />
        <div className={styles.mainForm}>
          <section className={styles.builderIntro}><div><span>Tutor profile builder</span><h1>Become a Tutoria tutor</h1></div><p>Show learners what you teach, how lessons work, and when they can book.</p></section>
          <section className={styles.stepSurface}><ValidationNotice errors={errors} />{mainContent}</section>
          <div className={styles.stepActions} aria-label="Step actions">
            <button className={styles.secondaryButton} type="button" onClick={() => { saveDraft(); setActiveStep((current) => Math.max(0, current - 1)); setErrors([]); }} disabled={activeStep === 0}><IconArrowLeft size={17} /> Back</button>
            <div className={styles.stepActionCopy}><span>Section {activeStep + 1} of {steps.length}</span>{errors.length > 0 && <p>{errors.length} {errors.length === 1 ? "item needs" : "items need"} attention</p>}</div>
            {activeStep === 4 ? <div className={styles.finalActions}><button className={styles.previewButton} type="button" onClick={() => setShowPreview(true)}>Preview</button><button className={styles.primaryButton} type="button" onClick={submitForReview} disabled={submitted}>{submitted ? "Submitted" : "Submit for review"}</button></div> : <button className={styles.primaryButton} type="button" onClick={continueToNextStep}>Continue <IconChevronRight size={17} /></button>}
          </div>
          <section className={styles.onboardingFaq} aria-labelledby="onboarding-faq-title">
            <div><span>Need help?</span><h2 id="onboarding-faq-title">Tutor application FAQ</h2></div>
            <div className={styles.onboardingFaqList}>
              {onboardingFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
            </div>
          </section>
        </div>
        <TutorLivePreview draft={draft} />
      </div>
      {notice && <div className={styles.noticeBar} role="status" aria-live="polite"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><IconX size={14} /></button></div>}
      {showPreview && <FullProfilePreview draft={draft} onClose={() => setShowPreview(false)} />}
      {showResetConfirm && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowResetConfirm(false); }}><section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="reset-draft-title"><h2 id="reset-draft-title">Reset tutor application?</h2><p>Your saved changes and submission status will be replaced with the original example.</p><div><button className={styles.secondaryButton} type="button" onClick={() => setShowResetConfirm(false)} autoFocus>Keep my draft</button><button className={styles.dangerButton} type="button" onClick={resetDraft}>Reset application</button></div></section></div>}
    </main>
  );
}
