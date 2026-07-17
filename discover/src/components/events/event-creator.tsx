"use client";

import Image from "next/image";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconCurrencyDong,
  IconLanguage,
  IconMapPin,
  IconPhoto,
  IconPlus,
  IconSchool,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";

import styles from "./event-creator.module.css";

type EventType = "Workshop" | "Event";
type EventFormat = "In person" | "Online" | "Hybrid";
type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced" | "All levels";
type AccessType = "Free" | "Paid" | "Request to join" | "Invitation only";

type PlanItem = {
  id: string;
  title: string;
  duration: number;
  description: string;
  image: string;
};

type TimeInterval = {
  id: string;
  title: string;
  start: string;
  end: string;
};

type SessionDate = {
  id: string;
  date: string;
  intervals: TimeInterval[];
};

type StoredSessionDate = Partial<SessionDate> & {
  title?: string;
  start?: string;
  end?: string;
};

type EventDraft = {
  type: EventType;
  format: EventFormat;
  category: string;
  title: string;
  promise: string;
  outcome: string;
  level: ExperienceLevel;
  included: string[];
  bring: string;
  languages: string[];
  coverImage: string;
  galleryImages: string[];
  plan: PlanItem[];
  sessions: SessionDate[];
  timezone: string;
  location: string;
  arrival: string;
  capacity: number;
  access: AccessType;
  price: number;
  cancellation: string;
  refund: string;
  visibility: "Public" | "Unlisted" | "Community only";
};

const DRAFT_KEY = "tutoria-event-draft";
const DRAFT_EVENT = "tutoria-event-draft-change";

const defaultDraft: EventDraft = {
  type: "Workshop",
  format: "In person",
  category: "Creative arts",
  title: "Beginner Pottery Workshop",
  promise: "Make and glaze your first ceramic cup in one afternoon.",
  outcome: "Learn hand-building techniques, surface decoration, and glazing with guidance from a working ceramic artist.",
  level: "Beginner",
  included: ["Clay", "Glazes", "Firing", "Apron", "Tools"],
  bring: "Comfortable clothes that can get a little messy",
  languages: ["English", "Vietnamese"],
  coverImage: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1400&q=85",
  galleryImages: [],
  plan: [
    { id: "welcome", title: "Welcome and introduction", duration: 15, description: "Meet the group and learn what you will make.", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=360&q=80" },
    { id: "demo", title: "Pottery demonstration", duration: 20, description: "See the hand-building technique from start to finish.", image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=360&q=80" },
    { id: "making", title: "Guided hand-building", duration: 60, description: "Build your ceramic cup with individual support.", image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=360&q=80" },
    { id: "glazing", title: "Decoration and glazing", duration: 40, description: "Finish the surface and prepare your piece for firing.", image: "https://images.unsplash.com/photo-1590422749897-47036da0b0ff?auto=format&fit=crop&w=360&q=80" },
  ],
  sessions: [
    {
      id: "date-1",
      date: "2026-07-19",
      intervals: [
        { id: "date-1-afternoon", title: "Afternoon session", start: "14:00", end: "17:00" },
      ],
    },
  ],
  timezone: "(GMT+7) Bangkok, Hanoi, Jakarta",
  location: "ClaySpace Studio, Tay Ho, Ha Noi",
  arrival: "Please arrive 10-15 minutes early. The studio is on the second floor.",
  capacity: 20,
  access: "Paid",
  price: 350000,
  cancellation: "24 hours before start",
  refund: "Full refund",
  visibility: "Public",
};

const defaultSnapshot = JSON.stringify(defaultDraft);

const steps = [
  { id: "idea", title: "The idea", description: "Name the experience." },
  { id: "experience", title: "The experience", description: "Shape what people will do." },
  { id: "schedule", title: "Time and place", description: "Set the practical details." },
  { id: "access", title: "Access and pricing", description: "Choose how people join." },
  { id: "publish", title: "Review and publish", description: "Check the public listing." },
] as const;

function subscribeToDraft(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DRAFT_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(DRAFT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DRAFT_EVENT, onStoreChange);
  };
}

function getDraftSnapshot() {
  return window.localStorage.getItem(DRAFT_KEY) || defaultSnapshot;
}

function getServerDraftSnapshot() {
  return defaultSnapshot;
}

function parseDraft(snapshot: string): EventDraft {
  try {
    const parsed = JSON.parse(snapshot) as Partial<EventDraft> & { sessions?: StoredSessionDate[] };
    const sourceSessions: StoredSessionDate[] = Array.isArray(parsed.sessions) ? parsed.sessions : defaultDraft.sessions;
    const sessions = sourceSessions.map((session, dateIndex) => {
      const id = typeof session.id === "string" ? session.id : `date-${dateIndex + 1}`;
      const intervals = Array.isArray(session.intervals) && session.intervals.length > 0
        ? session.intervals.map((interval, intervalIndex) => ({
            id: typeof interval.id === "string" ? interval.id : `${id}-interval-${intervalIndex + 1}`,
            title: typeof interval.title === "string" ? interval.title : `Session ${intervalIndex + 1}`,
            start: typeof interval.start === "string" ? interval.start : "10:00",
            end: typeof interval.end === "string" ? interval.end : "12:00",
          }))
        : [{
            id: `${id}-interval-1`,
            title: typeof session.title === "string" ? session.title : "Session 1",
            start: typeof session.start === "string" ? session.start : "10:00",
            end: typeof session.end === "string" ? session.end : "12:00",
          }];
      return {
        id,
        date: typeof session.date === "string" ? session.date : "",
        intervals,
      };
    });
    const coverImage = typeof parsed.coverImage === "string" ? parsed.coverImage : defaultDraft.coverImage;
    const galleryImages = Array.isArray(parsed.galleryImages)
      ? parsed.galleryImages.filter((image): image is string => typeof image === "string" && Boolean(image))
      : [];
    return { ...defaultDraft, ...parsed, coverImage, galleryImages, sessions } as EventDraft;
  } catch {
    return defaultDraft;
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function formatSessionDate(value: string) {
  if (!value) return "Date to be announced";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function intervalsAreValid(intervals: TimeInterval[]) {
  if (!intervals.length) return false;
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.every((interval, index) => {
    if (!interval.start || !interval.end || interval.end <= interval.start) return false;
    return index === 0 || interval.start >= sorted[index - 1].end;
  });
}

function ChoiceButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof IconSchool;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`${styles.choice} ${active ? styles.activeChoice : ""}`} onClick={onClick} aria-pressed={active}>
      <span className={styles.choiceIcon}><Icon size={22} stroke={1.55} /></span>
      <span><strong>{title}</strong><small>{description}</small></span>
      <span className={styles.radioMark}>{active && <span />}</span>
    </button>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{label}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <button key={option} type="button" className={value === option ? styles.activeSegment : ""} onClick={() => onChange(option)} aria-pressed={value === option}>
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function EventCreator() {
  const snapshot = useSyncExternalStore(subscribeToDraft, getDraftSnapshot, getServerDraftSnapshot);
  const draft = useMemo(() => parseDraft(snapshot), [snapshot]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [stepMessage, setStepMessage] = useState("");
  const [includedInput, setIncludedInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(() => draft.plan[0]?.id ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepSections = useRef<Array<HTMLElement | null>>([]);
  const hasChangedStep = useRef(false);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const previewModalRef = useRef<HTMLElement | null>(null);

  const saveDraft = useCallback((nextDraft: EventDraft, announce = false) => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
    window.dispatchEvent(new Event(DRAFT_EVENT));
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 550);
    if (announce) setNotice("Draft saved to this browser.");
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const returnFocus = previewButtonRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
      if (event.key !== "Tab" || !previewModalRef.current) return;
      const focusable = Array.from(previewModalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    previewCloseRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [previewOpen]);

  useEffect(() => {
    if (!hasChangedStep.current) return;
    stepSections.current[activeStep]?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  const patchDraft = useCallback(<K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    saveDraft({ ...draft, [key]: value });
  }, [draft, saveDraft]);

  const totalDuration = draft.plan.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const eventImages = [draft.coverImage, ...draft.galleryImages].filter(Boolean);
  const fee = draft.access === "Paid" ? Math.round(draft.price * 0.06) : 0;
  const payout = Math.max(0, draft.price - fee);
  const sessionTimesValid = draft.sessions.every((session) => session.date && intervalsAreValid(session.intervals));

  const checklist = [
    { label: "Essential details", complete: Boolean(draft.title.trim() && draft.promise.trim()), step: 0 },
    { label: "Experience and plan", complete: Boolean(draft.outcome.trim() && draft.plan.length), step: 1 },
    { label: "Time and location", complete: Boolean(sessionTimesValid && (draft.format === "Online" || draft.location.trim())), step: 2 },
    { label: "Capacity and price", complete: draft.capacity > 0 && (draft.access !== "Paid" || draft.price > 0), step: 3 },
    { label: "Cover image", complete: eventImages.length > 0, step: 0 },
    { label: "Cancellation policy", complete: Boolean(draft.cancellation && draft.refund), step: 3 },
  ];
  const readyToPublish = checklist.every((item) => item.complete);
  const stepComplete = [
    checklist[0].complete && checklist[4].complete,
    checklist[1].complete,
    checklist[2].complete,
    checklist[3].complete && checklist[5].complete,
    readyToPublish,
  ];
  const stepErrors = [
    "Add a title, one-sentence promise, and cover image before continuing.",
    "Add a learning outcome and at least one programme item before continuing.",
    "Add a valid date and time, then confirm the location or meeting link.",
    "Confirm capacity, pricing, cancellation, and refund details before continuing.",
  ];

  const goToStep = (index: number) => {
    hasChangedStep.current = true;
    setStepMessage("");
    setActiveStep(Math.max(0, Math.min(steps.length - 1, index)));
  };

  const continueToNextStep = () => {
    if (!stepComplete[activeStep]) {
      setStepMessage(stepErrors[activeStep] || "Complete the required details before continuing.");
      stepSections.current[activeStep]?.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }
    goToStep(activeStep + 1);
  };

  const updatePlan = (id: string, patch: Partial<PlanItem>) => {
    patchDraft("plan", draft.plan.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const uploadPlanImage = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updatePlan(id, { image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const addPlanItem = () => {
    const item: PlanItem = {
      id: createId("plan"),
      title: "New workshop moment",
      duration: 30,
      description: "Describe what happens during this part of the experience.",
      image: "",
    };
    setExpandedPlanId(item.id);
    patchDraft("plan", [...draft.plan, item]);
  };

  const removePlanItem = (id: string) => {
    const nextPlan = draft.plan.filter((item) => item.id !== id);
    if (expandedPlanId === id) setExpandedPlanId(nextPlan[0]?.id ?? null);
    patchDraft("plan", nextPlan);
  };

  const updateSession = (id: string, patch: Partial<SessionDate>) => {
    patchDraft("sessions", draft.sessions.map((session) => session.id === id ? { ...session, ...patch } : session));
  };

  const updateInterval = (sessionId: string, intervalId: string, patch: Partial<TimeInterval>) => {
    patchDraft("sessions", draft.sessions.map((session) => session.id === sessionId
      ? { ...session, intervals: session.intervals.map((interval) => interval.id === intervalId ? { ...interval, ...patch } : interval) }
      : session));
  };

  const addInterval = (sessionId: string) => {
    const session = draft.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    const previous = session.intervals[session.intervals.length - 1];
    patchDraft("sessions", draft.sessions.map((item) => item.id === sessionId
      ? {
          ...item,
          intervals: [...item.intervals, {
            id: createId("interval"),
            title: `Session ${item.intervals.length + 1}`,
            start: previous?.end || "14:00",
            end: "18:00",
          }],
        }
      : item));
  };

  const removeInterval = (sessionId: string, intervalId: string) => {
    patchDraft("sessions", draft.sessions.map((session) => session.id === sessionId
      ? { ...session, intervals: session.intervals.filter((interval) => interval.id !== intervalId) }
      : session));
  };

  const updateEventImages = (images: string[]) => {
    saveDraft({
      ...draft,
      coverImage: images[0] || "",
      galleryImages: images.slice(1),
    });
  };

  const uploadEventImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const images = await Promise.all(files.map(readFileAsDataUrl));
      updateEventImages([...eventImages, ...images]);
    } catch {
      setNotice("We could not add one or more images. Please try again.");
    } finally {
      event.target.value = "";
    }
  };

  const moveEventImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= eventImages.length) return;
    const nextImages = [...eventImages];
    const [image] = nextImages.splice(fromIndex, 1);
    nextImages.splice(toIndex, 0, image);
    updateEventImages(nextImages);
  };

  const removeEventImage = (index: number) => {
    updateEventImages(eventImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const publish = () => {
    if (!readyToPublish) {
      setNotice("Complete the highlighted review items before publishing.");
      return;
    }
    setPublished(true);
    setPreviewOpen(false);
    setNotice(`${draft.type} published successfully.`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/discover" className={styles.backLink}><IconArrowLeft size={17} /> Back to Discover</Link>
          <div className={styles.headerTitle}>
            <span>Tutoria creator studio</span>
            <strong>Create an event or workshop</strong>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.saveStatus} aria-live="polite">{saveStatus === "saving" ? "Saving draft" : "Draft saved"}</span>
            <button type="button" className={styles.saveButton} onClick={() => saveDraft(draft, true)}>Save draft</button>
          </div>
        </div>
        <div className={styles.mobileProgress} aria-label="Creation sections">
          {steps.map((step, index) => (
            <button type="button" key={step.id} className={activeStep === index ? styles.activeMobileStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
              {stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : <span>{index + 1}</span>}
              {step.title}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.stepRail}>
          <nav aria-label="Event creation sections">
            {steps.map((step, index) => (
              <button type="button" key={step.id} className={activeStep === index ? styles.activeStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
                <span>{stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.workspace}>
          <section className={styles.intro}>
            <div>
              <p>Event builder</p>
              <h1>Create an event or workshop</h1>
            </div>
            <p>Tell guests what they will do, when it happens, and how to join.</p>
          </section>

          <section id="idea" className={styles.section} hidden={activeStep !== 0} tabIndex={-1} ref={(node) => { stepSections.current[0] = node; }}>
            <div className={styles.sectionHeading}><span>The idea</span><h2>What are you creating?</h2></div>
            <div className={styles.choiceGrid}>
              <ChoiceButton active={draft.type === "Workshop"} icon={IconSchool} title="Workshop" description="A guided, participatory learning experience." onClick={() => patchDraft("type", "Workshop")} />
              <ChoiceButton active={draft.type === "Event"} icon={IconUsers} title="Event" description="A talk, meetup, gathering, or social experience." onClick={() => patchDraft("type", "Event")} />
            </div>
            <div className={styles.formGrid}>
              <SegmentedControl label="Format" options={["In person", "Online", "Hybrid"] as const} value={draft.format} onChange={(value) => patchDraft("format", value)} />
              <label className={styles.field}><span>Category</span><select value={draft.category} onChange={(event) => patchDraft("category", event.target.value)}><option>Creative arts</option><option>Business</option><option>Technology</option><option>Languages</option><option>Music</option><option>Wellness</option><option>Cooking</option></select></label>
              <label className={styles.field}><span>Working title</span><input required maxLength={80} value={draft.title} onChange={(event) => patchDraft("title", event.target.value)} /><small>{draft.title.length}/80</small></label>
              <label className={styles.field}><span>One-sentence promise</span><textarea required maxLength={120} rows={3} value={draft.promise} onChange={(event) => patchDraft("promise", event.target.value)} /><small>{draft.promise.length}/120</small></label>
            </div>

            <div className={styles.imageGalleryField}>
              <div className={styles.imageGalleryHeader}>
                <div><strong>Event images</strong><p>The first image is your cover. Add more to show the space, materials, or experience.</p></div>
                <span>{eventImages.length} {eventImages.length === 1 ? "image" : "images"}</span>
              </div>
              <div className={styles.imageGalleryGrid}>
                {eventImages.map((image, index) => (
                  <article className={`${styles.imageGalleryCard} ${index === 0 ? styles.primaryImageCard : ""}`} key={`${image.slice(0, 40)}-${index}`}>
                    <Image src={image} alt={index === 0 ? `${draft.title} cover` : `${draft.title} gallery image ${index + 1}`} fill unoptimized sizes="(max-width: 700px) 100vw, 240px" />
                    <span className={styles.imagePosition}>{index === 0 ? "Cover" : String(index + 1).padStart(2, "0")}</span>
                    <div className={styles.imageGalleryActions}>
                      {index > 0 && <button type="button" onClick={() => moveEventImage(index, 0)} aria-label={`Make image ${index + 1} the cover`}><IconPhoto size={15} /><span>Make cover</span></button>}
                      {index > 0 && <button type="button" onClick={() => moveEventImage(index, index - 1)} aria-label={`Move image ${index + 1} left`}><IconArrowLeft size={15} /></button>}
                      {index < eventImages.length - 1 && <button type="button" onClick={() => moveEventImage(index, index + 1)} aria-label={`Move image ${index + 1} right`}><IconChevronRight size={15} /></button>}
                      <button type="button" onClick={() => removeEventImage(index)} aria-label={`Remove image ${index + 1}`}><IconTrash size={15} /></button>
                    </div>
                  </article>
                ))}
                <label className={styles.imageAddCard}>
                  <IconPlus size={22} />
                  <strong>Add images</strong>
                  <span>Select one or several files</span>
                  <input type="file" accept="image/*" multiple onChange={uploadEventImages} />
                </label>
              </div>
            </div>
          </section>

          <section id="experience" className={styles.section} hidden={activeStep !== 1} tabIndex={-1} ref={(node) => { stepSections.current[1] = node; }}>
            <div className={styles.sectionHeading}><span>The experience</span><h2>What will people do and learn?</h2><p>Describe the outcome, then break the experience into clear moments.</p></div>
            <div className={styles.formGrid}>
              <label className={`${styles.field} ${styles.spanTwo}`}><span>What participants will make or learn</span><textarea required rows={4} maxLength={300} value={draft.outcome} onChange={(event) => patchDraft("outcome", event.target.value)} /><small>{draft.outcome.length}/300</small></label>
              <SegmentedControl label="Experience level" options={["Beginner", "Intermediate", "Advanced", "All levels"] as const} value={draft.level} onChange={(value) => patchDraft("level", value)} />
            </div>

            <div className={styles.planHeader}><strong>Workshop plan</strong><span>{totalDuration} minutes</span></div>
            <div className={styles.planList}>
              {draft.plan.map((item, index) => {
                const expanded = expandedPlanId === item.id;
                return (
                  <article className={`${styles.planItem} ${expanded ? styles.expandedPlanItem : ""}`} key={item.id}>
                    <div className={styles.planItemHeader}>
                      <span className={styles.planIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <input required className={styles.planTitleInput} aria-label={`Title for plan item ${index + 1}`} value={item.title} onChange={(event) => updatePlan(item.id, { title: event.target.value })} />
                      <label className={styles.durationField}><input aria-label={`Duration for ${item.title}`} type="number" min={1} value={item.duration} onChange={(event) => updatePlan(item.id, { duration: Number(event.target.value) })} /><span>min</span></label>
                      <button type="button" className={styles.planToggle} aria-label={`${expanded ? "Collapse" : "Expand"} ${item.title}`} aria-expanded={expanded} aria-controls={`plan-details-${item.id}`} onClick={() => setExpandedPlanId(expanded ? null : item.id)}>{expanded ? <IconChevronUp size={17} /> : <IconChevronDown size={17} />}</button>
                      <button type="button" className={styles.planDelete} aria-label={`Remove ${item.title}`} onClick={() => removePlanItem(item.id)}><IconTrash size={17} /></button>
                    </div>

                    {expanded && (
                      <div className={styles.planItemDetails} id={`plan-details-${item.id}`}>
                        <label className={styles.planDescription}>
                          <span>Description</span>
                          <textarea aria-label={`Description for plan item ${index + 1}`} rows={5} maxLength={500} value={item.description} onChange={(event) => updatePlan(item.id, { description: event.target.value })} />
                          <small>{item.description.length}/500</small>
                        </label>
                        <div className={styles.planImageField}>
                          <span>Image <small>(optional)</small></span>
                          {item.image ? (
                            <div className={styles.planImagePreview}>
                              <Image src={item.image} alt={`${item.title} workshop moment`} fill unoptimized sizes="(max-width: 700px) 100vw, 280px" />
                              <button type="button" aria-label={`Remove image from ${item.title}`} onClick={() => updatePlan(item.id, { image: "" })}><IconX size={15} /></button>
                              <label><IconPhoto size={16} /> Replace<input type="file" accept="image/*" onChange={(event) => uploadPlanImage(item.id, event)} /></label>
                            </div>
                          ) : (
                            <label className={styles.planImageEmpty}><IconPhoto size={20} /><strong>Add an image</strong><small>JPG or PNG</small><input type="file" accept="image/*" onChange={(event) => uploadPlanImage(item.id, event)} /></label>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <button type="button" className={styles.addButton} onClick={addPlanItem}><IconPlus size={17} /> Add another moment</button>

            <div className={styles.detailsGrid}>
              <div className={styles.tagField}>
                <span>What is included</span>
                <div className={styles.tags}>{draft.included.map((item) => <button type="button" key={item} onClick={() => patchDraft("included", draft.included.filter((value) => value !== item))}>{item}<IconX size={13} /></button>)}</div>
                <div className={styles.addRow}><input aria-label="Add an included item" value={includedInput} placeholder="Add an item" onChange={(event) => setIncludedInput(event.target.value)} /><button type="button" onClick={() => { const value = includedInput.trim(); if (value && !draft.included.includes(value)) patchDraft("included", [...draft.included, value]); setIncludedInput(""); }}>Add</button></div>
              </div>
              <div className={styles.tagField}>
                <span>Languages</span>
                <div className={styles.tags}>{draft.languages.map((item) => <button type="button" key={item} onClick={() => patchDraft("languages", draft.languages.filter((value) => value !== item))}>{item}<IconX size={13} /></button>)}</div>
                <div className={styles.addRow}><select aria-label="Choose a language" value={languageInput} onChange={(event) => setLanguageInput(event.target.value)}><option value="">Choose a language</option><option>English</option><option>Vietnamese</option><option>Mandarin</option><option>French</option><option>Japanese</option><option>Korean</option></select><button type="button" onClick={() => { if (languageInput && !draft.languages.includes(languageInput)) patchDraft("languages", [...draft.languages, languageInput]); setLanguageInput(""); }}>Add</button></div>
              </div>
              <label className={styles.field}><span>What participants should bring</span><textarea rows={3} value={draft.bring} onChange={(event) => patchDraft("bring", event.target.value)} /></label>
            </div>
          </section>

          <section id="schedule" className={styles.section} hidden={activeStep !== 2} tabIndex={-1} ref={(node) => { stepSections.current[2] = node; }}>
            <div className={styles.sectionHeading}><span>Time and place</span><h2>When and where is it happening?</h2><p>Add multiple time intervals to each date, or create another date when needed.</p></div>
            <div className={styles.sessionList}>
              {draft.sessions.map((session, index) => {
                const invalid = !intervalsAreValid(session.intervals);
                return (
                  <article className={`${styles.sessionDate} ${invalid ? styles.invalidSession : ""}`} key={session.id}>
                    <header className={styles.sessionDateHeader}>
                      <span className={styles.sessionNumber}>{String(index + 1).padStart(2, "0")}</span>
                      <label className={styles.field}><span>Date</span><input required type="date" value={session.date} onChange={(event) => updateSession(session.id, { date: event.target.value })} /></label>
                      <div><strong>Time intervals</strong><small>{session.intervals.length} {session.intervals.length === 1 ? "interval" : "intervals"} on this date</small></div>
                      <button type="button" className={styles.iconButton} disabled={draft.sessions.length === 1} aria-label={`Remove date ${index + 1}`} onClick={() => patchDraft("sessions", draft.sessions.filter((item) => item.id !== session.id))}><IconTrash size={17} /></button>
                    </header>
                    <div className={styles.intervalList}>
                      {session.intervals.map((interval, intervalIndex) => (
                        <div className={styles.interval} key={interval.id}>
                          <span>{String(intervalIndex + 1).padStart(2, "0")}</span>
                          <label className={styles.field}><span>Session title</span><input value={interval.title} onChange={(event) => updateInterval(session.id, interval.id, { title: event.target.value })} /></label>
                          <label className={styles.field}><span>Starts</span><input required type="time" value={interval.start} onChange={(event) => updateInterval(session.id, interval.id, { start: event.target.value })} /></label>
                          <label className={styles.field}><span>Ends</span><input required type="time" value={interval.end} onChange={(event) => updateInterval(session.id, interval.id, { end: event.target.value })} /></label>
                          <button type="button" className={styles.iconButton} disabled={session.intervals.length === 1} aria-label={`Remove time interval ${intervalIndex + 1} from date ${index + 1}`} onClick={() => removeInterval(session.id, interval.id)}><IconX size={17} /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={styles.addIntervalButton} onClick={() => addInterval(session.id)}><IconPlus size={16} /> Add time interval</button>
                    {invalid && <p className={styles.intervalError}>Intervals cannot overlap, and every end time must be later than its start time.</p>}
                  </article>
                );
              })}
            </div>
            <button type="button" className={styles.addButton} onClick={() => patchDraft("sessions", [...draft.sessions, { id: createId("date"), date: "2026-07-26", intervals: [{ id: createId("interval"), title: "Morning session", start: "10:00", end: "12:00" }] }])}><IconCalendarEvent size={17} /> Add another date</button>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Time zone</span><select value={draft.timezone} onChange={(event) => patchDraft("timezone", event.target.value)}><option>(GMT+7) Bangkok, Hanoi, Jakarta</option><option>(GMT+8) Singapore, Kuala Lumpur</option><option>(GMT+9) Tokyo, Seoul</option><option>(GMT+0) London</option></select></label>
              <label className={styles.field}><span>{draft.format === "Online" ? "Meeting link" : "Location"}</span><input required value={draft.location} onChange={(event) => patchDraft("location", event.target.value)} /></label>
              <label className={styles.field}><span>Arrival instructions</span><textarea rows={3} value={draft.arrival} onChange={(event) => patchDraft("arrival", event.target.value)} /></label>
              <label className={styles.field}><span>Capacity</span><input required type="number" min={1} value={draft.capacity} onChange={(event) => patchDraft("capacity", Number(event.target.value))} /></label>
            </div>
          </section>

          <section id="access" className={styles.section} hidden={activeStep !== 3} tabIndex={-1} ref={(node) => { stepSections.current[3] = node; }}>
            <div className={styles.sectionHeading}><span>Access and pricing</span><h2>How can people join?</h2><p>Choose the access model and tell guests what happens if plans change.</p></div>
            <div className={styles.accessGrid}>
              <fieldset className={styles.radioList}><legend>Access</legend>{(["Free", "Paid", "Request to join", "Invitation only"] as const).map((option) => <label key={option}><input type="radio" name="access" checked={draft.access === option} onChange={() => patchDraft("access", option)} /><span><strong>{option}</strong><small>{option === "Paid" ? "Set a price for each guest." : option === "Free" ? "No payment is required." : "You decide who can attend."}</small></span></label>)}</fieldset>
              <div className={styles.pricingPanel}>
                <label className={styles.field}><span>Price per person</span><div className={styles.priceInput}><IconCurrencyDong size={18} /><input required={draft.access === "Paid"} type="number" min={1} disabled={draft.access !== "Paid"} value={draft.access === "Paid" ? draft.price : 0} onChange={(event) => patchDraft("price", Number(event.target.value))} /></div></label>
                {draft.access === "Paid" ? <dl><div><dt>Guest pays</dt><dd>{formatPrice(draft.price)}</dd></div><div><dt>Platform fee (6%)</dt><dd>{formatPrice(fee)}</dd></div><div><dt>You receive</dt><dd>{formatPrice(payout)}</dd></div></dl> : <p>No payout details are needed for this access type.</p>}
              </div>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Cancellation deadline</span><select value={draft.cancellation} onChange={(event) => patchDraft("cancellation", event.target.value)}><option>24 hours before start</option><option>48 hours before start</option><option>7 days before start</option></select></label>
              <label className={styles.field}><span>Refund policy</span><select value={draft.refund} onChange={(event) => patchDraft("refund", event.target.value)}><option>Full refund</option><option>Partial refund</option><option>No refund</option></select></label>
            </div>
          </section>

          <section id="publish" className={styles.section} hidden={activeStep !== 4} tabIndex={-1} ref={(node) => { stepSections.current[4] = node; }}>
            <div className={styles.sectionHeading}><span>Review and publish</span><h2>Ready to go live?</h2><p>Review the essentials and choose who can discover the listing.</p></div>
            <div className={styles.publishGrid}>
              <div className={styles.checklist}>{checklist.map((item) => <button type="button" key={item.label} className={item.complete ? styles.complete : styles.incomplete} onClick={() => goToStep(item.step)}>{item.complete ? <IconCircleCheck size={19} /> : <IconClock size={19} />}<span>{item.label}</span><strong>{item.complete ? "Ready" : "Edit details"}</strong></button>)}</div>
              <fieldset className={styles.radioList}><legend>Visibility</legend>{(["Public", "Unlisted", "Community only"] as const).map((option) => <label key={option}><input type="radio" name="visibility" checked={draft.visibility === option} onChange={() => patchDraft("visibility", option)} /><span><strong>{option}</strong><small>{option === "Public" ? "Anyone can discover and join." : option === "Unlisted" ? "Only people with the link can view it." : "Only community members can view it."}</small></span></label>)}</fieldset>
              <div className={styles.publishPanel}><IconSparkles size={22} /><strong>{readyToPublish ? "Everything is ready." : "A few details need attention."}</strong><p>{readyToPublish ? "Preview the listing, then publish when it looks right." : "Use the review list to return to anything that still needs work."}</p></div>
            </div>
          </section>

          <div className={styles.stepActions}>
            <button type="button" className={styles.backButton} onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 0}><IconArrowLeft size={17} /> Back</button>
            <div className={styles.stepActionCopy}>
              <span>Section {activeStep + 1} of {steps.length}</span>
              {stepMessage && <p role="alert">{stepMessage}</p>}
            </div>
            {activeStep < steps.length - 1 ? (
              <button type="button" className={styles.primaryButton} onClick={continueToNextStep}>Continue <IconChevronRight size={17} /></button>
            ) : (
              <div className={styles.finalActions}>
                <button ref={previewButtonRef} type="button" className={styles.saveButton} onClick={() => setPreviewOpen(true)}>Preview</button>
                <button type="button" className={styles.publishButton} onClick={publish}>Publish {draft.type.toLowerCase()}</button>
              </div>
            )}
          </div>

          <footer className={styles.footer}><span>Tutoria hosting standards help keep every gathering clear, inclusive, and trustworthy.</span><Link href="/events">Browse events <IconChevronRight size={16} /></Link></footer>
        </div>

        <aside className={styles.livePreview} aria-label="Live listing preview">
          <div className={styles.livePreviewTop}>
            <strong>Live listing preview</strong>
            <span>Updates as you type</span>
          </div>
          <div className={styles.livePreviewImage}>
            {draft.coverImage ? <Image src={draft.coverImage} alt={`${draft.title} cover`} fill unoptimized sizes="320px" /> : <div className={styles.imageEmptyState}><IconPhoto size={24} /><span>Add a cover image</span></div>}
            <span>{draft.format}</span>
          </div>
          <div className={styles.livePreviewBody}>
            <small>{draft.type} / {draft.category}</small>
            <h2>{draft.title || `Untitled ${draft.type.toLowerCase()}`}</h2>
            <p>{draft.promise || "Add a short promise so guests know what to expect."}</p>
            <dl>
              <div><dt>Date</dt><dd>{formatSessionDate(draft.sessions[0]?.date || "")}</dd></div>
              <div><dt>Time</dt><dd>{draft.sessions[0]?.intervals[0] ? `${draft.sessions[0].intervals[0].start} - ${draft.sessions[0].intervals[0].end}` : "To be announced"}</dd></div>
              <div><dt>Access</dt><dd>{draft.access === "Paid" ? formatPrice(draft.price) : draft.access}</dd></div>
            </dl>
          </div>
        </aside>
      </main>

      {notice && <div className={styles.notice} role="status" aria-live="polite">{published && <IconCheck size={17} />}<span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification"><IconX size={15} /></button></div>}

      {previewOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
          <section ref={previewModalRef} className={styles.previewModal} role="dialog" aria-modal="true" aria-labelledby="preview-title" aria-describedby="preview-description">
            <div className={styles.previewTop}>
              <div>
                <div className={styles.previewEyebrow}><span>Public preview</span><small>{draft.type} · {draft.category}</small></div>
                <h2 id="preview-title">{draft.title || `Untitled ${draft.type.toLowerCase()}`}</h2>
              </div>
              <button ref={previewCloseRef} type="button" className={styles.iconButton} onClick={() => setPreviewOpen(false)} aria-label="Close preview"><IconX size={19} /></button>
            </div>
            <div className={styles.previewImage}>
              {draft.coverImage ? <Image src={draft.coverImage} alt={`${draft.title} cover`} fill unoptimized loading="eager" sizes="(max-width: 900px) 100vw, 1080px" /> : <div className={styles.imageEmptyState}><IconPhoto size={30} /><span>Cover image not added yet</span></div>}
              <div className={styles.previewImageLabel}>{draft.format}</div>
            </div>
            {draft.galleryImages.length > 0 && (
              <div className={styles.previewGallery} aria-label="Event gallery">
                {draft.galleryImages.map((image, index) => <div key={`${image.slice(0, 40)}-${index}`}><Image src={image} alt={`${draft.title} gallery image ${index + 2}`} fill unoptimized sizes="180px" /></div>)}
              </div>
            )}
            <div className={styles.previewBody}>
              <div className={styles.previewContent}>
                <p id="preview-description" className={styles.previewPromise}>{draft.promise}</p>

                <div className={styles.previewFacts}>
                  <div><IconSchool size={18} /><span><small>Level</small><strong>{draft.level}</strong></span></div>
                  <div><IconClock size={18} /><span><small>Programme</small><strong>{totalDuration ? `${totalDuration} minutes` : "Flexible"}</strong></span></div>
                  <div><IconLanguage size={18} /><span><small>Languages</small><strong>{draft.languages.join(", ") || "Not specified"}</strong></span></div>
                  <div><IconMapPin size={18} /><span><small>Format</small><strong>{draft.format}</strong></span></div>
                </div>

                <section className={styles.previewSection}>
                  <span className={styles.previewSectionLabel}>The experience</span>
                  <h3>What you will learn</h3>
                  <p className={styles.previewCopy}>{draft.outcome || "The learning outcome will be added before publishing."}</p>
                </section>

                <section className={styles.previewSection}>
                  <span className={styles.previewSectionLabel}>Programme</span>
                  <div className={styles.previewSectionHeading}><h3>What you will do</h3><small>{totalDuration} minutes total</small></div>
                  <div className={styles.previewPlan}>{draft.plan.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><small>{item.duration} min</small></article>)}</div>
                </section>

                <section className={styles.previewSection}>
                  <span className={styles.previewSectionLabel}>Dates and times</span>
                  <h3>Choose a session</h3>
                  <div className={styles.previewSchedule}>
                    {draft.sessions.map((session) => (
                      <article key={session.id}>
                        <div className={styles.previewDate}><IconCalendarEvent size={18} /><time dateTime={session.date}>{formatSessionDate(session.date)}</time></div>
                        <div className={styles.previewIntervals}>
                          {session.intervals.map((interval) => <div key={interval.id}><span>{interval.title}</span><time>{interval.start} - {interval.end}</time></div>)}
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className={styles.previewTimezone}>{draft.timezone}</p>
                </section>

                <div className={styles.previewDetailGrid}>
                  <section className={styles.previewDetailCard}>
                    <span className={styles.previewSectionLabel}>Included</span>
                    <h3>We provide</h3>
                    <ul>{draft.included.length ? draft.included.map((item) => <li key={item}><IconCheck size={15} />{item}</li>) : <li>Details will be confirmed before publishing.</li>}</ul>
                  </section>
                  <section className={styles.previewDetailCard}>
                    <span className={styles.previewSectionLabel}>Before you arrive</span>
                    <h3>What to bring</h3>
                    <p>{draft.bring || "Nothing special is required."}</p>
                  </section>
                </div>

                <section className={styles.previewSection}>
                  <span className={styles.previewSectionLabel}>{draft.format === "Online" ? "Joining" : "Location"}</span>
                  <h3>{draft.format === "Online" ? "How to join" : draft.location || "Location to be announced"}</h3>
                  <div className={styles.previewLocation}><IconMapPin size={18} /><p>{draft.format === "Online" ? draft.location || "The meeting link will be shared with confirmed guests." : draft.arrival || "Arrival details will be shared with confirmed guests."}</p></div>
                </section>
              </div>

              <aside className={styles.previewBooking}>
                <span className={styles.previewAccess}>{draft.access}</span>
                <small>{draft.access === "Paid" ? "Price per person" : "Access"}</small>
                <strong>{draft.access === "Paid" ? formatPrice(draft.price) : draft.access}</strong>
                <div className={styles.previewAvailability}><IconUsers size={17} /><span>{draft.capacity} places available</span></div>
                <dl>
                  <div><dt>Visibility</dt><dd>{draft.visibility}</dd></div>
                  <div><dt>Cancellation</dt><dd>{draft.cancellation}</dd></div>
                  <div><dt>Refund</dt><dd>{draft.refund}</dd></div>
                </dl>
                <p>You will review the final listing once more before it goes live.</p>
                <button type="button" className={styles.publishButton} onClick={publish}>Publish now</button>
              </aside>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
