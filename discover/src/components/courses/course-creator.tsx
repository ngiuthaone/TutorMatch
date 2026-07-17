"use client";

import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconBook2,
  IconCertificate,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconCurrencyDong,
  IconGripVertical,
  IconLanguage,
  IconLayoutSidebarRight,
  IconLock,
  IconMessageCircle,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconRocket,
  IconSchool,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import styles from "./course-creator.module.css";

type CourseLevel = "Beginner" | "Intermediate" | "Advanced" | "All levels";
type CourseAccess = "Free" | "One-time purchase";
type Progression = "Self-paced" | "Complete lessons in order";
type Visibility = "Public" | "Unlisted";
type LessonType = "Video" | "Article" | "Quiz" | "Assignment";

type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  duration: number;
  description: string;
  ready: boolean;
};

type Chapter = {
  id: string;
  title: string;
  open: boolean;
  lessons: Lesson[];
};

type CourseDraft = {
  title: string;
  promise: string;
  category: string;
  topic: string;
  level: CourseLevel;
  languages: string[];
  learners: string;
  outcomes: string[];
  chapters: Chapter[];
  progression: Progression;
  discussions: boolean;
  community: boolean;
  instructorFeedback: boolean;
  requireLessons: boolean;
  requireProject: boolean;
  certificate: boolean;
  certificateTitle: string;
  coverImage: string;
  shortDescription: string;
  fullDescription: string;
  access: CourseAccess;
  price: number;
  visibility: Visibility;
};

const DRAFT_KEY = "tutoria-course-draft-v1";

const defaultDraft: CourseDraft = {
  title: "Complete Web Development Bootcamp",
  promise: "Build and publish responsive websites using HTML, CSS, JavaScript, and React.",
  category: "Technology",
  topic: "Web development",
  level: "Beginner",
  languages: ["Vietnamese", "English"],
  learners: "Beginners who want to build and publish their first polished website.",
  outcomes: [
    "Build responsive pages with HTML and CSS",
    "Add interactions using JavaScript",
    "Create reusable React components",
  ],
  chapters: [
    {
      id: "getting-started",
      title: "Getting started",
      open: true,
      lessons: [
        { id: "welcome", title: "Welcome to the course", type: "Video", duration: 6, description: "Meet your instructor and see the project you will build.", ready: true },
        { id: "how-it-works", title: "How this course works", type: "Article", duration: 4, description: "Learn how lessons, projects, and feedback fit together.", ready: true },
        { id: "first-page", title: "Build your first page", type: "Assignment", duration: 13, description: "Create and publish a simple semantic HTML page.", ready: false },
      ],
    },
    {
      id: "html-foundations",
      title: "HTML foundations",
      open: false,
      lessons: [
        { id: "semantic-html", title: "Semantic HTML", type: "Video", duration: 11, description: "Use meaningful elements to structure content.", ready: true },
        { id: "html-practice", title: "HTML practice", type: "Quiz", duration: 8, description: "Check your understanding of the core elements.", ready: true },
      ],
    },
  ],
  progression: "Self-paced",
  discussions: true,
  community: true,
  instructorFeedback: true,
  requireLessons: true,
  requireProject: true,
  certificate: true,
  certificateTitle: "Certificate of Completion",
  coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=85",
  shortDescription: "A practical course that takes complete beginners from their first HTML page to a published portfolio website.",
  fullDescription: "You will learn by building real projects step by step. We begin with the foundations of HTML, CSS, and JavaScript, then move into modern React development. By the end of the course, you will build, deploy, and share a responsive portfolio website with confidence.",
  access: "One-time purchase",
  price: 699000,
  visibility: "Public",
};

const steps = [
  { title: "Course setup", description: "Define, present, and price the course." },
  { title: "Curriculum & lessons", description: "Build chapters and lesson content." },
  { title: "Learning experience", description: "Set progress and completion rules." },
  { title: "Review & publish", description: "Check everything before launch." },
] as const;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function lessonIcon(type: LessonType) {
  if (type === "Video") return <IconPlayerPlay size={15} />;
  if (type === "Quiz") return <IconCircleCheck size={15} />;
  if (type === "Assignment") return <IconSchool size={15} />;
  return <IconBook2 size={15} />;
}

export function CourseCreator() {
  const [draft, setDraft] = useState<CourseDraft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedLessonId, setSelectedLessonId] = useState(defaultDraft.chapters[0].lessons[0].id);
  const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving…">("Saved");
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [languageInput, setLanguageInput] = useState("");
  const [outcomeInput, setOutcomeInput] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = window.localStorage.getItem(DRAFT_KEY);
        if (stored) setDraft({ ...defaultDraft, ...(JSON.parse(stored) as Partial<CourseDraft>) });
      } catch {
        setNotice("The saved draft could not be loaded. A fresh draft is open instead.");
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSaveStatus("Saved");
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [activeStep]);

  const patchDraft = useCallback(<K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => {
    setSaveStatus("Saving…");
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const lessons = useMemo(() => draft.chapters.flatMap((chapter) => chapter.lessons), [draft.chapters]);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const duration = lessons.reduce((total, lesson) => total + Number(lesson.duration || 0), 0);
  const readyLessons = lessons.filter((lesson) => lesson.ready).length;
  const fee = draft.access === "One-time purchase" ? Math.round(draft.price * 0.1) : 0;
  const payout = Math.max(0, draft.price - fee);

  const checklist = useMemo(() => [
    { label: "Course title and promise", complete: draft.title.trim().length >= 8 && draft.promise.trim().length >= 20, step: 0 },
    { label: "Learner outcomes", complete: draft.outcomes.length >= 3, step: 0 },
    { label: "Curriculum", complete: draft.chapters.length > 0 && lessons.length >= 3, step: 1 },
    { label: "Learning experience", complete: draft.requireLessons || draft.requireProject, step: 2 },
    { label: "Course page", complete: Boolean(draft.coverImage) && draft.fullDescription.trim().length >= 80, step: 0 },
    { label: "Pricing and visibility", complete: draft.access === "Free" || draft.price > 0, step: 0 },
  ], [draft, lessons.length]);

  const progress = Math.round((checklist.filter((item) => item.complete).length / checklist.length) * 100);
  const readyToPublish = checklist.every((item) => item.complete);
  const stepComplete = [
    [...checklist.slice(0, 2), ...checklist.slice(4)].every((item) => item.complete),
    checklist[2].complete,
    checklist[3].complete,
    readyToPublish,
  ];
  const setupGroups = [
    {
      id: "course-essentials",
      number: "01",
      title: "Essentials",
      description: "Set the promise and position.",
      complete: draft.title.trim().length >= 8 && draft.promise.trim().length >= 20 && Boolean(draft.category && draft.topic),
    },
    {
      id: "course-learners",
      number: "02",
      title: "Learners & outcomes",
      description: "Clarify who it serves and why.",
      complete: draft.languages.length > 0 && draft.learners.trim().length >= 20 && draft.outcomes.length >= 3,
    },
    {
      id: "course-listing",
      number: "03",
      title: "Listing & access",
      description: "Present, price, and package it.",
      complete: Boolean(draft.coverImage) && draft.fullDescription.trim().length >= 80 && (draft.access === "Free" || draft.price > 0),
    },
  ];

  const goToStep = (step: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, step));
    setActiveStep(next);
    requestAnimationFrame(() => {
      sectionRef.current?.focus({ preventScroll: true });
    });
  };

  const goToSetupGroup = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const saveNow = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaveStatus("Saved");
    setNotice("Draft saved to this browser.");
  };

  const updateChapter = (chapterId: string, changes: Partial<Chapter>) => {
    patchDraft("chapters", draft.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, ...changes } : chapter));
  };

  const updateLesson = (lessonId: string, changes: Partial<Lesson>) => {
    patchDraft("chapters", draft.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...changes } : lesson),
    })));
  };

  const addChapter = () => {
    const chapter: Chapter = { id: createId("chapter"), title: "New chapter", open: true, lessons: [] };
    patchDraft("chapters", [...draft.chapters, chapter]);
    setNotice("Chapter added.");
  };

  const removeChapter = (chapterId: string) => {
    const chapter = draft.chapters.find((item) => item.id === chapterId);
    const next = draft.chapters.filter((item) => item.id !== chapterId);
    patchDraft("chapters", next);
    if (chapter?.lessons.some((lesson) => lesson.id === selectedLessonId)) setSelectedLessonId(next[0]?.lessons[0]?.id ?? "");
  };

  const addLesson = (chapterId: string) => {
    const lesson: Lesson = { id: createId("lesson"), title: "New lesson", type: "Video", duration: 8, description: "", ready: false };
    patchDraft("chapters", draft.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, open: true, lessons: [...chapter.lessons, lesson] } : chapter));
    setSelectedLessonId(lesson.id);
  };

  const removeLesson = (chapterId: string, lessonId: string) => {
    const next = draft.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, lessons: chapter.lessons.filter((lesson) => lesson.id !== lessonId) } : chapter);
    patchDraft("chapters", next);
    if (selectedLessonId === lessonId) setSelectedLessonId(next.flatMap((chapter) => chapter.lessons)[0]?.id ?? "");
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      patchDraft("coverImage", await readFileAsDataUrl(file));
      setNotice("Cover image updated.");
    } catch {
      setNotice("That image could not be uploaded. Choose another JPG or PNG file.");
    }
    event.target.value = "";
  };

  const publish = () => {
    if (!readyToPublish) {
      setNotice("Complete the remaining review items before publishing.");
      goToStep(3);
      return;
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setPublished(true);
    setNotice("Course published.");
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/discover" className={styles.backLink}><IconArrowLeft size={17} /> Back to Discover</Link>
          <div className={styles.headerTitle}><span>Tutoria creator studio</span><strong>Create a course</strong></div>
          <div className={styles.headerActions}>
            <span className={styles.saveStatus} aria-live="polite">{saveStatus === "Saving…" ? "Saving draft" : "Draft saved"}</span>
            <button type="button" className={styles.saveButton} onClick={saveNow}>Save draft</button>
          </div>
        </div>
        <div className={styles.mobileProgress} aria-label="Course creation sections">
          {steps.map((step, index) => (
            <button type="button" key={step.title} className={activeStep === index ? styles.activeMobileStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
              {stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : <span>{index + 1}</span>}
              {step.title}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.stepRail} aria-label="Course creation sections">
          <nav>
            {steps.map((step, index) => (
              <button type="button" key={step.title} className={activeStep === index ? styles.activeStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
                <span>{stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : index + 1}</span><strong>{step.title}</strong><small>{step.description}</small>
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.workspace}>
          <section className={styles.intro}>
            <div><p>Course builder</p><h1>Create a course</h1></div>
            <p>Tell learners what they will achieve, how the lessons work, and how to enroll.</p>
          </section>

          <section ref={sectionRef} className={styles.section} tabIndex={-1}>
            {activeStep === 0 && (
              <>
                <div className={styles.sectionHeading}><span>Course setup</span><h2>Shape the complete course offer.</h2><p>Build the foundation and public listing together, so every promise, outcome, and price tells one coherent story.</p></div>

                <nav className={styles.setupMap} aria-label="Course setup sections">
                  {setupGroups.map((group) => (
                    <button type="button" key={group.id} onClick={() => goToSetupGroup(group.id)} aria-label={`${group.title}: ${group.complete ? "complete" : "in progress"}`}>
                      <span className={group.complete ? styles.setupMapComplete : ""}>{group.complete ? <IconCheck size={15} /> : group.number}</span>
                      <span><strong>{group.title}</strong><small>{group.description}</small></span>
                      <em>{group.complete ? "Complete" : "In progress"}</em>
                    </button>
                  ))}
                </nav>

                <section id="course-essentials" className={styles.setupGroup} aria-labelledby="course-essentials-title">
                  <header className={styles.setupGroupHeader}><span>01</span><div><p>Essentials</p><h3 id="course-essentials-title">Give it a clear direction.</h3><small>The core promise learners see first.</small></div></header>
                  <div className={styles.setupGroupBody}>
                    <div className={styles.formGrid}>
                      <label className={`${styles.field} ${styles.spanTwo}`}><span>Course title</span><input value={draft.title} maxLength={100} onChange={(event) => patchDraft("title", event.target.value)} /><small>{draft.title.length}/100</small></label>
                      <label className={`${styles.field} ${styles.spanTwo}`}><span>One-sentence promise</span><textarea rows={3} maxLength={160} value={draft.promise} onChange={(event) => patchDraft("promise", event.target.value)} /><small>{draft.promise.length}/160</small></label>
                      <label className={styles.field}><span>Category</span><select value={draft.category} onChange={(event) => patchDraft("category", event.target.value)}><option>Technology</option><option>Languages</option><option>Creative arts</option><option>Business</option><option>Personal development</option></select></label>
                      <label className={styles.field}><span>Primary topic</span><input value={draft.topic} onChange={(event) => patchDraft("topic", event.target.value)} /></label>
                      <fieldset className={`${styles.fieldset} ${styles.spanTwo}`}><legend>Level</legend><div className={styles.segmented}>{(["Beginner", "Intermediate", "Advanced", "All levels"] as const).map((level) => <button type="button" key={level} className={draft.level === level ? styles.activeSegment : ""} onClick={() => patchDraft("level", level)}>{level}</button>)}</div></fieldset>
                    </div>
                  </div>
                </section>

                <section id="course-learners" className={styles.setupGroup} aria-labelledby="course-learners-title">
                  <header className={styles.setupGroupHeader}><span>02</span><div><p>Learners & outcomes</p><h3 id="course-learners-title">Design for one learner.</h3><small>Make the transformation specific and useful.</small></div></header>
                  <div className={styles.setupGroupBody}>
                    <div className={styles.foundationGrid}>
                      <div className={styles.tagPanel}><div className={styles.panelTitle}><IconLanguage size={18} /><strong>Languages</strong></div><div className={styles.tags}>{draft.languages.map((language) => <button type="button" key={language} aria-label={`Remove ${language}`} onClick={() => patchDraft("languages", draft.languages.filter((item) => item !== language))}>{language}<IconX size={13} /></button>)}</div><div className={styles.addRow}><select value={languageInput} aria-label="Choose a course language" onChange={(event) => setLanguageInput(event.target.value)}><option value="">Choose a language</option><option>English</option><option>Vietnamese</option><option>Mandarin</option><option>French</option><option>Japanese</option><option>Korean</option></select><button type="button" onClick={() => { if (languageInput && !draft.languages.includes(languageInput)) patchDraft("languages", [...draft.languages, languageInput]); setLanguageInput(""); }}>Add</button></div></div>
                      <label className={`${styles.field} ${styles.learnersField}`}><span>Intended learners</span><textarea rows={6} value={draft.learners} onChange={(event) => patchDraft("learners", event.target.value)} /></label>
                    </div>
                    <div className={styles.outcomesPanel}><div className={styles.panelTitle}><IconSparkles size={18} /><div><strong>Learning outcomes</strong><p>Start each outcome with an action learners can demonstrate.</p></div></div><ol>{draft.outcomes.map((outcome, index) => <li key={`${outcome}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><input aria-label={`Learning outcome ${index + 1}`} value={outcome} onChange={(event) => patchDraft("outcomes", draft.outcomes.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button type="button" aria-label={`Remove learning outcome ${index + 1}`} onClick={() => patchDraft("outcomes", draft.outcomes.filter((_, itemIndex) => itemIndex !== index))}><IconX size={15} /></button></li>)}</ol><div className={styles.addRow}><input value={outcomeInput} aria-label="New learning outcome" placeholder="Learners will be able to…" onChange={(event) => setOutcomeInput(event.target.value)} /><button type="button" onClick={() => { const value = outcomeInput.trim(); if (value) patchDraft("outcomes", [...draft.outcomes, value]); setOutcomeInput(""); }}>Add outcome</button></div></div>
                  </div>
                </section>

                <section id="course-listing" className={styles.setupGroup} aria-labelledby="course-listing-title">
                  <header className={styles.setupGroupHeader}><span>03</span><div><p>Listing & access</p><h3 id="course-listing-title">Turn interest into enrollment.</h3><small>Present the course, then make access clear.</small></div></header>
                  <div className={styles.setupGroupBody}>
                    <label className={styles.coverUpload}><span>Course cover</span><div>{draft.coverImage ? <Image src={draft.coverImage} alt={`${draft.title} cover`} fill unoptimized sizes="(max-width: 800px) 100vw, 760px" /> : <span className={styles.coverEmpty}><IconPhoto size={28} /> Add a course cover</span>}<b><IconPhoto size={15} /> Change image</b></div><input type="file" accept="image/*" onChange={uploadCover} /></label>
                    <div className={styles.formGrid}><label className={`${styles.field} ${styles.spanTwo}`}><span>Short description</span><textarea rows={3} maxLength={180} value={draft.shortDescription} onChange={(event) => patchDraft("shortDescription", event.target.value)} /><small>{draft.shortDescription.length}/180</small></label><label className={`${styles.field} ${styles.spanTwo}`}><span>Full course description</span><textarea rows={7} value={draft.fullDescription} onChange={(event) => patchDraft("fullDescription", event.target.value)} /></label></div>
                    <div className={styles.pricingGrid}>
                      <fieldset className={styles.radioList}><legend>Course access</legend>{(["Free", "One-time purchase"] as const).map((option) => <label key={option}><input type="radio" name="access" checked={draft.access === option} onChange={() => patchDraft("access", option)} /><span><strong>{option}</strong><small>{option === "Free" ? "Anyone can enroll without payment." : "Learners pay once for ongoing access."}</small></span></label>)}</fieldset>
                      {draft.access === "One-time purchase" ? <div className={styles.pricingPanel}><label className={styles.field}><span>Course price</span><div className={styles.priceInput}><IconCurrencyDong size={18} /><input type="number" min={0} value={draft.price} onChange={(event) => patchDraft("price", Number(event.target.value))} /></div></label><dl><div><dt>Learner pays</dt><dd>{formatPrice(draft.price)}</dd></div><div><dt>Platform fee (10%)</dt><dd>{formatPrice(fee)}</dd></div><div><dt>You receive</dt><dd>{formatPrice(payout)}</dd></div></dl></div> : <div className={styles.freeAccessPanel}><IconUsers size={22} /><div><strong>Free enrollment</strong><p>No payment details are needed. Anyone with access to the listing can enroll.</p></div></div>}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeStep === 1 && (
              <>
                <div className={styles.sectionHeading}><span>Curriculum & lessons</span><h2>Build the learning path</h2><p>Organize the course into chapters, then shape each lesson without leaving the curriculum.</p></div>
                <div className={styles.statsRow}><div><IconBook2 size={18} /><strong>{draft.chapters.length}</strong><span>Chapters</span></div><div><IconLayoutSidebarRight size={18} /><strong>{lessons.length}</strong><span>Lessons</span></div><div><IconCircleCheck size={18} /><strong>{readyLessons}</strong><span>Ready</span></div><div><IconClock size={18} /><strong>{duration}m</strong><span>Total content</span></div></div>
                <div className={styles.curriculumGrid}>
                  <div className={styles.structurePanel}>
                    <div className={styles.panelTitle}><strong>Course structure</strong><button type="button" onClick={addChapter}><IconPlus size={15} /> Chapter</button></div>
                    <div className={styles.chapterList}>
                      {draft.chapters.map((chapter, chapterIndex) => <article key={chapter.id} className={styles.chapter}>
                        <header><span>{String(chapterIndex + 1).padStart(2, "0")}</span><input aria-label={`Chapter ${chapterIndex + 1} title`} value={chapter.title} onChange={(event) => updateChapter(chapter.id, { title: event.target.value })} /><button type="button" aria-label={`${chapter.open ? "Collapse" : "Expand"} ${chapter.title}`} onClick={() => updateChapter(chapter.id, { open: !chapter.open })}>{chapter.open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}</button><button type="button" aria-label={`Remove ${chapter.title}`} onClick={() => removeChapter(chapter.id)}><IconTrash size={15} /></button></header>
                        {chapter.open && <div className={styles.lessonList}>{chapter.lessons.map((lesson, lessonIndex) => <button type="button" key={lesson.id} className={selectedLesson?.id === lesson.id ? styles.selectedLesson : ""} onClick={() => setSelectedLessonId(lesson.id)}><span className={styles.drag}><IconGripVertical size={14} /></span><span className={styles.lessonType}>{lessonIcon(lesson.type)}</span><span className={styles.lessonCopy}><strong>{chapterIndex + 1}.{lessonIndex + 1} {lesson.title}</strong><small>{lesson.duration} min · {lesson.ready ? "Ready" : "Draft"}</small></span><i className={lesson.ready ? styles.readyDot : styles.draftDot} /></button>)}</div>}
                        {chapter.open && <div className={styles.chapterActions}><button type="button" onClick={() => addLesson(chapter.id)}><IconPlus size={14} /> Add lesson</button></div>}
                      </article>)}
                    </div>
                    {!draft.chapters.length && <button type="button" className={styles.emptyState} onClick={addChapter}><IconBook2 size={25} /><strong>Add your first chapter</strong><span>Give the course a clear starting point.</span></button>}
                  </div>
                  <div className={styles.lessonEditor}>
                    {selectedLesson ? <><div className={styles.panelTitle}><div><span>Selected lesson</span><strong>{selectedLesson.title}</strong></div><button type="button" onClick={() => setPreviewOpen(true)}><IconPlayerPlay size={15} /> Preview</button></div><label className={styles.field}><span>Lesson type</span><select value={selectedLesson.type} onChange={(event) => updateLesson(selectedLesson.id, { type: event.target.value as LessonType })}><option>Video</option><option>Article</option><option>Quiz</option><option>Assignment</option></select></label><label className={styles.field}><span>Lesson title</span><input value={selectedLesson.title} onChange={(event) => updateLesson(selectedLesson.id, { title: event.target.value })} /></label><div className={styles.lessonMeta}><label className={styles.field}><span>Duration</span><div className={styles.durationInput}><input type="number" min={1} value={selectedLesson.duration} onChange={(event) => updateLesson(selectedLesson.id, { duration: Number(event.target.value) })} /><b>min</b></div></label><label className={styles.checkField}><input type="checkbox" checked={selectedLesson.ready} onChange={(event) => updateLesson(selectedLesson.id, { ready: event.target.checked })} /><span><strong>Ready to publish</strong><small>Include this lesson in the course.</small></span></label></div><label className={styles.field}><span>Short description</span><textarea rows={5} value={selectedLesson.description} onChange={(event) => updateLesson(selectedLesson.id, { description: event.target.value })} /></label><div className={styles.contentDrop}><span className={styles.lessonType}>{lessonIcon(selectedLesson.type)}</span><div><strong>{selectedLesson.type} content</strong><p>Add or replace the learning material for this lesson.</p></div><button type="button" onClick={() => setNotice(`${selectedLesson.type} content picker opened.`)}>Choose file</button></div>{draft.chapters.map((chapter) => chapter.lessons.some((lesson) => lesson.id === selectedLesson.id) ? <button type="button" key={chapter.id} className={styles.dangerButton} onClick={() => removeLesson(chapter.id, selectedLesson.id)}><IconTrash size={15} /> Remove lesson</button> : null)}</> : <div className={styles.emptyEditor}><IconLayoutSidebarRight size={28} /><strong>Select or add a lesson</strong><p>Lesson settings and content will appear here.</p></div>}
                  </div>
                </div>
              </>
            )}

            {activeStep === 2 && (
              <>
                <div className={styles.sectionHeading}><span>Learning experience</span><h2>How should the course work?</h2><p>Set the pace, interaction, and completion signals that keep learners moving.</p></div>
                <div className={styles.experienceStack}>
                  <article><div className={styles.numberTitle}><span>01</span><div><strong>Course progression</strong><p>Choose how learners move through the curriculum.</p></div></div><div className={styles.choiceGrid}>{(["Self-paced", "Complete lessons in order"] as const).map((option) => <label key={option} className={draft.progression === option ? styles.activeChoice : ""}><input type="radio" name="progression" checked={draft.progression === option} onChange={() => patchDraft("progression", option)} /><span><strong>{option}</strong><small>{option === "Self-paced" ? "Learners choose when and where to continue." : "Each lesson unlocks after the previous one is complete."}</small></span></label>)}</div></article>
                  <article><div className={styles.numberTitle}><span>02</span><div><strong>Interaction & community</strong><p>Choose how learners can ask, connect, and receive feedback.</p></div></div><div className={styles.toggleList}><label><IconMessageCircle size={18} /><span><strong>Lesson discussions</strong><small>Questions stay beside the lesson that inspired them.</small></span><input type="checkbox" checked={draft.discussions} onChange={(event) => patchDraft("discussions", event.target.checked)} /></label><label><IconUsers size={18} /><span><strong>Course community</strong><small>Give learners a dedicated place to connect.</small></span><input type="checkbox" checked={draft.community} onChange={(event) => patchDraft("community", event.target.checked)} /></label><label><IconSchool size={18} /><span><strong>Instructor feedback</strong><small>Review final project submissions.</small></span><input type="checkbox" checked={draft.instructorFeedback} onChange={(event) => patchDraft("instructorFeedback", event.target.checked)} /></label></div></article>
                  <article><div className={styles.numberTitle}><span>03</span><div><strong>Completion requirements</strong><p>Define the work that marks the course complete.</p></div></div><div className={styles.requirementGrid}><label><input type="checkbox" checked={draft.requireLessons} onChange={(event) => patchDraft("requireLessons", event.target.checked)} /> Complete all required lessons</label><label><input type="checkbox" checked={draft.requireProject} onChange={(event) => patchDraft("requireProject", event.target.checked)} /> Submit a final project</label></div></article>
                  <article><div className={styles.numberTitle}><span>04</span><div><strong>Completion certificate</strong><p>Recognize learners when they meet every requirement.</p></div><input className={styles.switch} aria-label="Enable completion certificate" type="checkbox" checked={draft.certificate} onChange={(event) => patchDraft("certificate", event.target.checked)} /></div>{draft.certificate && <label className={styles.field}><span>Certificate title</span><input value={draft.certificateTitle} maxLength={80} onChange={(event) => patchDraft("certificateTitle", event.target.value)} /></label>}</article>
                </div>
                <div className={styles.journey}><div><IconSchool size={20} /><span>Enroll</span></div><i /><div><IconBook2 size={20} /><span>Learn</span></div><i /><div><IconCircleCheck size={20} /><span>Complete</span></div><i /><div><IconCertificate size={20} /><span>Earn certificate</span></div></div>
              </>
            )}

            {activeStep === 3 && (
              <>
                <div className={styles.sectionHeading}><span>Review & publish</span><h2>{readyToPublish ? "Ready to publish?" : "What still needs attention?"}</h2><p>Review the learning path and public listing, then choose how people can discover it.</p></div>
                <div className={styles.readiness}><div className={styles.readinessRing} style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div><div><small>Course readiness</small><strong>{readyToPublish ? "Ready to publish" : "Almost there"}</strong><p>{readyToPublish ? "Everything required for launch is complete." : "Open an incomplete item below to finish the course."}</p></div></div>
                <div className={styles.reviewGrid}>
                  <div className={styles.checklist}><div className={styles.panelTitle}><strong>Publication checklist</strong><span>{checklist.filter((item) => item.complete).length}/{checklist.length} complete</span></div>{checklist.map((item) => <button type="button" key={item.label} className={item.complete ? styles.complete : styles.incomplete} onClick={() => goToStep(item.step)}>{item.complete ? <IconCircleCheck size={19} /> : <IconClock size={19} />}<span>{item.label}</span><strong>{item.complete ? "Ready" : "Edit"}</strong><IconChevronRight size={16} /></button>)}</div>
                  <fieldset className={styles.radioList}><legend>Visibility</legend>{(["Public", "Unlisted"] as const).map((option) => <label key={option}><input type="radio" name="visibility" checked={draft.visibility === option} onChange={() => patchDraft("visibility", option)} /><span>{option === "Public" ? <IconWorld size={18} /> : <IconLock size={18} />}<span><strong>{option}</strong><small>{option === "Public" ? "Anyone can discover and enroll." : "Only people with the link can view it."}</small></span></span></label>)}</fieldset>
                </div>
                <div className={styles.previewActions}><button type="button" onClick={() => setPreviewOpen(true)}><IconWorld size={18} /><span><strong>Preview public page</strong><small>See the listing as learners will.</small></span><IconChevronRight size={16} /></button><button type="button" onClick={() => setPreviewOpen(true)}><IconPlayerPlay size={18} /><span><strong>Preview course player</strong><small>Step through the learning experience.</small></span><IconChevronRight size={16} /></button><button type="button" onClick={() => setPreviewOpen(true)}><IconCertificate size={18} /><span><strong>Preview certificate</strong><small>Check the completion reward.</small></span><IconChevronRight size={16} /></button></div>
                <div className={styles.publishPanel}><IconRocket size={22} /><div><strong>{published ? "Course published" : "Publication workflow"}</strong><p>{published ? `Your course is now ${draft.visibility.toLowerCase()}. You can keep improving it at any time.` : "Publishing saves this draft and makes the course available based on the visibility you selected."}</p></div><button type="button" disabled={!readyToPublish || published} onClick={publish}>{published ? <><IconCheck size={17} /> Published</> : "Publish course"}</button></div>
              </>
            )}
          </section>

          <div className={styles.stepActions}>
            <button type="button" className={styles.backButton} disabled={activeStep === 0} onClick={() => goToStep(activeStep - 1)}><IconArrowLeft size={17} /> Back</button>
            <div className={styles.stepActionCopy}><span>Section {activeStep + 1} of {steps.length}</span></div>
            {activeStep < steps.length - 1 ? (
              <button type="button" className={styles.primaryButton} onClick={() => goToStep(activeStep + 1)}>Continue <IconChevronRight size={17} /></button>
            ) : (
              <div className={styles.finalActions}>
                <button type="button" className={styles.saveButton} onClick={() => setPreviewOpen(true)}>Preview</button>
                <button type="button" className={styles.publishButton} onClick={publish} disabled={!readyToPublish || published}>{published ? "Published" : "Publish course"}</button>
              </div>
            )}
          </div>
          <footer className={styles.footer}><span>Tutoria course standards help every learning path stay clear, useful, and trustworthy.</span><Link href="/courses">Browse courses <IconChevronRight size={16} /></Link></footer>
        </div>

        <aside className={styles.livePreview} aria-label="Live course preview">
          <div className={styles.livePreviewTop}><strong>Live course preview</strong><span>Updates as you type</span></div>
          <div className={styles.livePreviewImage}>
            {draft.coverImage ? <Image src={draft.coverImage} alt={`${draft.title} cover`} fill unoptimized sizes="320px" /> : <div className={styles.coverEmpty}><IconPhoto size={24} /><span>Add a cover image</span></div>}
            <span>{draft.level}</span>
          </div>
          <div className={styles.livePreviewBody}>
            <small>{draft.category} / {draft.topic}</small>
            <h2>{draft.title || "Untitled course"}</h2>
            <p>{draft.promise || "Add a short promise so learners know what they will achieve."}</p>
            <dl>
              <div><dt>Lessons</dt><dd>{lessons.length} lessons</dd></div>
              <div><dt>Duration</dt><dd>{duration} minutes</dd></div>
              <div><dt>Access</dt><dd>{draft.access === "Free" ? "Free" : formatPrice(draft.price)}</dd></div>
            </dl>
          </div>
        </aside>
      </main>

      {notice && <div className={styles.toast} role="status">{notice}</div>}
      {previewOpen && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="course-preview-title"><button type="button" className={styles.modalClose} aria-label="Close preview" onClick={() => setPreviewOpen(false)}><IconX size={18} /></button><div className={styles.modalCover}>{draft.coverImage && <Image src={draft.coverImage} alt="" fill unoptimized sizes="(max-width: 700px) 100vw, 720px" />}</div><div className={styles.modalBody}><small>{draft.category} / {draft.level}</small><h2 id="course-preview-title">{draft.title}</h2><p>{draft.promise}</p><div className={styles.modalStats}><span><IconBook2 size={16} /> {draft.chapters.length} chapters</span><span><IconPlayerPlay size={16} /> {lessons.length} lessons</span><span><IconClock size={16} /> {duration} min</span></div><div className={styles.modalColumns}><div><strong>What you will learn</strong><ul>{draft.outcomes.map((outcome) => <li key={outcome}><IconCheck size={15} /> {outcome}</li>)}</ul></div><div><strong>Course access</strong><p>{draft.access === "Free" ? "Free" : formatPrice(draft.price)} · {draft.visibility}</p><button type="button" onClick={() => setPreviewOpen(false)}>Return to editor</button></div></div></div></section></div>}
    </div>
  );
}
