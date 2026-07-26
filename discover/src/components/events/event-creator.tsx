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
  IconMenu,
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
import { savePublishedEvent, type EventDetail } from "@/lib/event-data";

type EventType = "Workshop" | "Event";
type EventFormat = "In person" | "Online";
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

type CreatorFaq = {
  id: string;
  question: string;
  answer: string;
};

type AttendGroup = {
  id: string;
  title: string;
  items: string[];
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
  requirements: string[];
  beforeAttendGroups: AttendGroup[];
  faqs: CreatorFaq[];
  languages: string[];
  coverImage: string;
  galleryImages: string[];
  plan: PlanItem[];
  sessions: SessionDate[];
  timezone: string;
  venueName: string;
  location: string;
  meetingLink: string;
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
  category: "",
  title: "",
  promise: "",
  outcome: "",
  level: "Beginner",
  included: [],
  bring: "",
  requirements: [],
  beforeAttendGroups: [
    { id: "attend-preparation", title: "Preparation", items: [] },
    { id: "attend-accessibility", title: "Accessibility", items: [] },
    { id: "attend-participation", title: "Participation", items: [] },
  ],
  faqs: [],
  languages: [],
  coverImage: "",
  galleryImages: [],
  plan: [],
  sessions: [
    {
      id: "date-1",
      date: "",
      intervals: [
        { id: "date-1-interval-1", title: "", start: "", end: "" },
      ],
    },
  ],
  timezone: "(GMT+7) Bangkok, Hanoi, Jakarta",
  venueName: "",
  location: "",
  meetingLink: "",
  arrival: "",
  capacity: 0,
  access: "Free",
  price: 0,
  cancellation: "",
  refund: "",
  visibility: "Public",
};

const defaultSnapshot = JSON.stringify(defaultDraft);

const steps = [
  { id: "idea", title: "The idea", description: "Name the experience." },
  { id: "experience", title: "The experience", description: "Shape what people will do." },
  { id: "before-booking", title: "Before booking", description: "Prepare guests to attend." },
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
  const stored = window.localStorage.getItem(DRAFT_KEY);
  if (!stored) return defaultSnapshot;
  try {
    const parsed = JSON.parse(stored) as Partial<EventDraft>;
    const isLegacyExample = parsed.title === "Beginner Pottery Workshop"
      && parsed.promise === "Make and glaze your first ceramic cup in one afternoon."
      && parsed.venueName === "ClaySpace Studio";
    return isLegacyExample ? defaultSnapshot : stored;
  } catch {
    return defaultSnapshot;
  }
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
    const format: EventFormat = parsed.format === "Online" ? "Online" : "In person";
    const beforeAttendGroups = Array.isArray(parsed.beforeAttendGroups)
      ? parsed.beforeAttendGroups.filter((group): group is AttendGroup => Boolean(group && typeof group.id === "string" && typeof group.title === "string" && Array.isArray(group.items)))
      : Array.isArray(parsed.requirements) && parsed.requirements.length
        ? [{ id: "attend-requirements", title: "Requirements", items: parsed.requirements.filter((item): item is string => typeof item === "string") }]
        : defaultDraft.beforeAttendGroups;
    return { ...defaultDraft, ...parsed, format, coverImage, galleryImages, sessions, beforeAttendGroups } as EventDraft;
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

function optimizeImageDataUrl(value: string, maxDimension = 1280, quality = 0.72) {
  if (!value.startsWith("data:image/")) return Promise.resolve(value);
  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, maxDimension / Math.max(largestSide, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(value);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const optimized = canvas.toDataURL("image/webp", quality);
      resolve(optimized.length < value.length ? optimized : value);
    };
    image.onerror = () => resolve(value);
    image.src = value;
  });
}

async function optimizePublishedEventImages(event: EventDetail, compact = false): Promise<EventDetail> {
  const image = await optimizeImageDataUrl(event.image, compact ? 900 : 1280, compact ? 0.52 : 0.72);
  const galleryImage = compact
    ? image
    : await optimizeImageDataUrl(event.galleryImage, 1280, 0.72);
  return { ...event, image, galleryImage };
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

function createSlug(title: string) {
  const base = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "event"}-${Date.now().toString(36)}`;
}

function toPublishedEvent(draft: EventDraft): EventDetail {
  const firstSession = draft.sessions[0];
  const firstInterval = firstSession?.intervals[0];
  const duration = draft.plan.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const isOnline = draft.format === "Online";
  const dateLabel = firstSession?.date ? new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${firstSession.date}T00:00:00`)) : "Date TBA";
  const location = isOnline ? "Online" : `${draft.venueName} · ${draft.location}`;
  const cancellation = [`Cancel ${draft.cancellation.toLowerCase()} for a ${draft.refund.toLowerCase()}.`, "If the host cancels, you can choose another session or receive a full refund."];
  return {
    slug: createSlug(draft.title), title: draft.title, host: "Sophia Nguyen", date: dateLabel,
    time: firstInterval?.start || "Time TBA", location, type: isOnline ? "Online" : "In person",
    price: draft.access === "Paid" ? formatPrice(draft.price) : "Free", attending: 0, capacity: draft.capacity,
    image: draft.coverImage, topic: draft.category, level: draft.level, subtitle: draft.promise,
    rating: 0, reviewCount: 0, duration: `${duration} minutes`, languages: draft.languages,
    minimumAge: "All ages", accessibility: isOnline ? "Join from any device" : "Contact the host for access details",
    studioName: isOnline ? "Online session" : draft.venueName, address: isOnline ? "Joining link shared after booking" : draft.location,
    sessions: draft.sessions.map((session) => ({ id: session.id, date: formatSessionDate(session.date), times: session.intervals.map((interval) => `${interval.start} - ${interval.end}`) })),
    spotsLeft: draft.capacity, about: [draft.promise, draft.outcome], note: draft.arrival || `Suitable for ${draft.level.toLowerCase()} participants.`,
    highlights: [
      { title: `${draft.capacity} places`, description: "A focused group experience." },
      { title: `${duration} minutes`, description: "A clearly structured programme." },
      { title: draft.format, description: isOnline ? "Join from wherever you are." : "Learn together in person." },
      { title: draft.level, description: `Designed for ${draft.level.toLowerCase()} participants.` },
    ],
    learn: [draft.outcome], included: draft.included, bring: draft.bring ? [draft.bring] : ["Nothing special is required"],
    plan: draft.plan.map((item) => ({ title: item.title, duration: `${item.duration} min`, description: item.description, image: item.image || undefined })),
    faqs: draft.faqs.map(({ question, answer }) => ({ question, answer })),
    galleryImage: draft.galleryImages[0] || draft.plan.find((item) => item.image)?.image || draft.coverImage,
    hostRole: "Tutoria host and educator", hostExperience: "Community educator", hostBio: "Sophia creates practical, welcoming learning experiences on Tutoria.",
    hostImage: "https://picsum.photos/seed/sophia-nguyen/240/240", hostRecommendation: "New host",
    beforeYouAttend: draft.beforeAttendGroups
      .map((group) => ({ title: group.title.trim(), items: group.items.map((item) => item.trim()).filter(Boolean) }))
      .filter((group) => group.title && group.items.length),
    cancellation, reviews: [],
  };
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [includedInput, setIncludedInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(() => draft.plan[0]?.id ?? null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepSections = useRef<Array<HTMLElement | null>>([]);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const previewModalRef = useRef<HTMLElement | null>(null);

  const saveDraft = useCallback((nextDraft: EventDraft, announce = false) => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
      window.dispatchEvent(new Event(DRAFT_EVENT));
    } catch {
      setSaveStatus("saved");
      setNotice("This draft is too large for browser storage. Remove an image or choose a smaller file.");
      return;
    }
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
    const sections = stepSections.current.filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = sections.indexOf(visible.target as HTMLElement);
      if (index >= 0) setActiveStep(index);
    }, { rootMargin: "-22% 0px -62% 0px", threshold: [0.05, 0.2, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const patchDraft = useCallback(<K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    saveDraft({ ...draft, [key]: value });
  }, [draft, saveDraft]);

  const totalDuration = draft.plan.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const eventImages = [draft.coverImage, ...draft.galleryImages].filter(Boolean);
  const fee = draft.access === "Paid" ? Math.round(draft.price * 0.06) : 0;
  const payout = Math.max(0, draft.price - fee);
  const sessionTimesValid = draft.sessions.every((session) => session.date && intervalsAreValid(session.intervals));
  const locationComplete = draft.format === "Online"
    ? Boolean(draft.meetingLink.trim())
    : Boolean(draft.venueName.trim() && draft.location.trim());

  const checklist = [
    { label: "Essential details", complete: Boolean(draft.title.trim() && draft.promise.trim()), step: 0 },
    { label: "Experience and FAQs", complete: Boolean(draft.outcome.trim() && draft.plan.length && draft.plan.every((item) => item.title.trim() && item.description.trim() && item.duration > 0) && draft.faqs.length && draft.faqs.every((faq) => faq.question.trim() && faq.answer.trim())), step: 1 },
    { label: "Time and location", complete: Boolean(sessionTimesValid && locationComplete), step: 3 },
    { label: "Capacity and price", complete: draft.capacity > 0 && (draft.access !== "Paid" || draft.price > 0), step: 4 },
    { label: "Cover image", complete: eventImages.length > 0, step: 0 },
    { label: "Cancellation policy", complete: Boolean(draft.cancellation && draft.refund), step: 4 },
  ];
  const readyToPublish = checklist.every((item) => item.complete);
  const stepComplete = [
    checklist[0].complete && checklist[4].complete,
    Boolean(draft.outcome.trim() && draft.plan.length && draft.plan.every((item) => item.title.trim() && item.description.trim() && item.duration > 0)),
    Boolean(draft.faqs.length && draft.faqs.every((faq) => faq.question.trim() && faq.answer.trim())),
    checklist[2].complete,
    checklist[3].complete && checklist[5].complete,
    readyToPublish,
  ];
  const goToStep = (index: number) => {
    const nextStep = Math.max(0, Math.min(steps.length - 1, index));
    setActiveStep(nextStep);
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => {
      stepSections.current[nextStep]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      title: "",
      duration: 0,
      description: "",
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

  const publish = async () => {
    if (!readyToPublish) {
      setNotice("Complete the highlighted review items before publishing.");
      return;
    }
    const eventData = toPublishedEvent(draft);
    setNotice("Optimizing images for browser storage…");
    window.localStorage.removeItem(DRAFT_KEY);
    let publishedEvent = await optimizePublishedEventImages(eventData);
    try {
      savePublishedEvent(publishedEvent);
    } catch {
      publishedEvent = await optimizePublishedEventImages(eventData, true);
      try {
        savePublishedEvent(publishedEvent);
      } catch {
        setNotice("Browser storage is full. Remove an uploaded image or clear an older local draft, then publish again.");
        return;
      }
    }
    setPublished(true);
    setPreviewOpen(false);
    setNotice(`${draft.type} published successfully. Opening its public page…`);
    window.setTimeout(() => { window.location.href = `/events/${publishedEvent.slug}`; }, 500);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBrandGroup}>
            <button type="button" className={styles.mobileMenuButton} onClick={() => setMobileNavOpen(true)} aria-label="Open section navigation"><IconMenu size={19} /></button>
            <Link href="/discover" className={styles.backLink}><span className={styles.brandMark}>T</span><strong>Tutoria</strong></Link>
            <span className={styles.headerContext}>/ Create experience</span>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.saveStatus} aria-live="polite">{saveStatus === "saving" ? "Saving changes" : "All changes saved"}</span>
            <button type="button" className={styles.saveButton} onClick={() => saveDraft(draft, true)}>Save draft</button>
            <button ref={previewButtonRef} type="button" className={styles.headerPreviewButton} onClick={() => setPreviewOpen(true)}>Preview</button>
          </div>
        </div>
        <div className={styles.progressTrack}><span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} /></div>
        <div className={`${styles.mobileProgress} ${mobileNavOpen ? styles.mobileProgressOpen : ""}`} aria-label="Creation sections">
          <div className={styles.mobileProgressHeader}><div><span>Create listing</span><strong>Your progress</strong></div><button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close section navigation"><IconX size={19} /></button></div>
          {steps.map((step, index) => (
            <button type="button" key={step.id} className={activeStep === index ? styles.activeMobileStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
              {stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : <span>{String(index + 1).padStart(2, "0")}</span>}
              {step.title}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <aside className={styles.stepRail}>
          <div className={styles.stepRailInner}>
            <p>Create listing</p>
            <h2>Your progress</h2>
            <nav aria-label="Event creation sections">
              {steps.map((step, index) => (
                <button type="button" key={step.id} className={activeStep === index ? styles.activeStep : ""} onClick={() => goToStep(index)} aria-current={activeStep === index ? "step" : undefined}>
                  <span>{stepComplete[index] && index !== activeStep ? <IconCheck size={15} /> : String(index + 1).padStart(2, "0")}</span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </button>
              ))}
            </nav>
            <div className={styles.railTip}><span><IconSparkles size={16} /></span><div><strong>Make it specific</strong><p>Clear outcomes, exact timing, and helpful preparation notes build trust.</p></div></div>
          </div>
        </aside>

        <div className={styles.workspace}>
          <section id="idea" className={styles.section} tabIndex={-1} ref={(node) => { stepSections.current[0] = node; }}>
            <div className={styles.sectionHeading}><span><b>1</b>The idea</span><h1>What are you creating?</h1><p>Start with the concept. You can refine the details before publishing.</p></div>
            <div className={styles.choiceGrid}>
              <ChoiceButton active={draft.type === "Workshop"} icon={IconSchool} title="Workshop" description="A guided, participatory learning experience." onClick={() => patchDraft("type", "Workshop")} />
              <ChoiceButton active={draft.type === "Event"} icon={IconUsers} title="Event" description="A talk, meetup, gathering, or social experience." onClick={() => patchDraft("type", "Event")} />
            </div>
            <div className={styles.formGrid}>
              <SegmentedControl label="Format" options={["In person", "Online"] as const} value={draft.format} onChange={(value) => patchDraft("format", value)} />
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

          <section id="experience" className={styles.section} tabIndex={-1} ref={(node) => { stepSections.current[1] = node; }}>
            <div className={styles.sectionHeading}><span><b>2</b>The experience</span><h2>What will people do and learn?</h2><p>Describe the outcome, then break the experience into clear moments.</p></div>
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
                      <strong className={`${styles.planTitleSummary} ${item.title ? "" : styles.emptyPlanTitle}`}>{item.title || "Untitled moment"}</strong>
                      <span className={styles.planDurationSummary}>{item.duration > 0 ? `${item.duration} min` : "Set duration"}</span>
                      <button type="button" className={styles.planToggle} aria-label={`${expanded ? "Collapse" : "Expand"} ${item.title}`} aria-expanded={expanded} aria-controls={`plan-details-${item.id}`} onClick={() => setExpandedPlanId(expanded ? null : item.id)}>{expanded ? <IconChevronUp size={17} /> : <IconChevronDown size={17} />}</button>
                      <button type="button" className={styles.planDelete} aria-label={`Remove ${item.title}`} onClick={() => removePlanItem(item.id)}><IconTrash size={17} /></button>
                    </div>

                    {expanded && (
                      <div className={styles.planItemDetails} id={`plan-details-${item.id}`}>
                        <div className={styles.planCopyFields}>
                          <div className={styles.planTitleRow}>
                            <label className={styles.planTitleField}>
                              <span>Moment title</span>
                              <input required maxLength={80} placeholder="e.g. Pottery demonstration" value={item.title} onChange={(event) => updatePlan(item.id, { title: event.target.value })} />
                              <small>{item.title.length}/80</small>
                            </label>
                            <label className={styles.durationField}>
                              <span>Duration</span>
                              <div><input required aria-label={`Duration for ${item.title || `plan item ${index + 1}`}`} type="number" min={1} value={item.duration || ""} onChange={(event) => updatePlan(item.id, { duration: Number(event.target.value) })} /><small>min</small></div>
                            </label>
                          </div>
                          <label className={styles.planDescription}>
                            <span>Description</span>
                            <textarea required aria-label={`Description for plan item ${index + 1}`} rows={5} maxLength={500} placeholder="Explain what participants will do during this moment" value={item.description} onChange={(event) => updatePlan(item.id, { description: event.target.value })} />
                            <small>{item.description.length}/500</small>
                          </label>
                        </div>
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
            <section className={styles.enrollmentInfo} aria-labelledby="event-guest-info-title">
              <header className={styles.enrollmentInfoHeader}><div><span>Before booking</span><h3 id="event-guest-info-title">Help guests arrive prepared.</h3><p>Edit the exact sections and checklist items shown in “Before you attend.”</p></div><strong>{draft.beforeAttendGroups.reduce((total, group) => total + group.items.filter((item) => item.trim()).length, 0) + draft.faqs.length} items</strong></header>
              <div className={styles.infoBuilderGrid}>
                <section className={`${styles.infoBuilder} ${styles.attendBuilder}`} aria-labelledby="event-attend-title">
                  <div className={styles.infoBuilderTitle}><span><IconCheck size={17} /></span><div><strong id="event-attend-title">Before you attend <small>(optional)</small></strong><p>Use one line per checklist item. Leave every section empty to hide this card.</p></div><button type="button" onClick={() => patchDraft("beforeAttendGroups", [...draft.beforeAttendGroups, { id: createId("attend"), title: "", items: [] }])}><IconPlus size={15} /> Add section</button></div>
                  <div className={styles.attendBuilderList}>
                    {draft.beforeAttendGroups.map((group, index) => (
                      <article key={group.id}>
                        <header><span>Section {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove ${group.title || `section ${index + 1}`}`} onClick={() => patchDraft("beforeAttendGroups", draft.beforeAttendGroups.filter((item) => item.id !== group.id))}><IconTrash size={15} /> Remove</button></header>
                        <label className={styles.field}><span>Section title</span><input value={group.title} placeholder="e.g. Accessibility" onChange={(event) => patchDraft("beforeAttendGroups", draft.beforeAttendGroups.map((item) => item.id === group.id ? { ...item, title: event.target.value } : item))} /></label>
                        <label className={styles.field}><span>Checklist items</span><textarea rows={4} value={group.items.join("\n")} placeholder={"One item per line\nExample: Step-free entrance"} onChange={(event) => patchDraft("beforeAttendGroups", draft.beforeAttendGroups.map((item) => item.id === group.id ? { ...item, items: event.target.value.split("\n") } : item))} /></label>
                      </article>
                    ))}
                  </div>
                </section>
                <section className={styles.infoBuilder} aria-labelledby="event-faq-title">
                  <div className={styles.infoBuilderTitle}><span><IconCircleCheck size={17} /></span><div><strong id="event-faq-title">Frequently asked questions</strong><p>Give a direct answer to each common concern.</p></div><button type="button" onClick={() => patchDraft("faqs", [...draft.faqs, { id: createId("faq"), question: "", answer: "" }])}><IconPlus size={15} /> Add question</button></div>
                  <div className={styles.faqBuilderList}>{draft.faqs.map((faq, index) => <article key={faq.id}><header><span>Question {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove FAQ ${index + 1}`} onClick={() => patchDraft("faqs", draft.faqs.filter((item) => item.id !== faq.id))}><IconTrash size={15} /> Remove</button></header><label className={styles.field}><span>Question</span><input value={faq.question} placeholder="What do guests usually ask?" onChange={(event) => patchDraft("faqs", draft.faqs.map((item) => item.id === faq.id ? { ...item, question: event.target.value } : item))} /></label><label className={styles.field}><span>Answer</span><textarea rows={3} value={faq.answer} placeholder="Give a concise, useful answer" onChange={(event) => patchDraft("faqs", draft.faqs.map((item) => item.id === faq.id ? { ...item, answer: event.target.value } : item))} /></label></article>)}</div>
                </section>
              </div>
            </section>
          </section>

          <section id="schedule" className={styles.section} tabIndex={-1} ref={(node) => { stepSections.current[2] = node; }}>
            <div className={styles.sectionHeading}><span><b>3</b>Time and place</span><h2>When and where is it happening?</h2><p>Add multiple time intervals to each date, or create another date when needed.</p></div>
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
            <button type="button" className={styles.addButton} onClick={() => patchDraft("sessions", [...draft.sessions, { id: createId("date"), date: "", intervals: [{ id: createId("interval"), title: "", start: "", end: "" }] }])}><IconCalendarEvent size={17} /> Add another date</button>
            <div className={styles.scheduleBasics}>
              <label className={styles.field}><span>Time zone</span><select value={draft.timezone} onChange={(event) => patchDraft("timezone", event.target.value)}><option>(GMT+7) Bangkok, Hanoi, Jakarta</option><option>(GMT+8) Singapore, Kuala Lumpur</option><option>(GMT+9) Tokyo, Seoul</option><option>(GMT+0) London</option></select></label>
              <label className={styles.field}><span>Capacity</span><input required type="number" min={1} value={draft.capacity} onChange={(event) => patchDraft("capacity", Number(event.target.value))} /></label>
            </div>
            <section className={styles.locationPanel} aria-labelledby="event-location-title">
              <div className={styles.locationHeading}><span><IconMapPin size={20} /></span><div><strong id="event-location-title">{draft.format === "Online" ? "Online joining details" : "Venue and location"}</strong><p>Choose the format here, then add the details guests need to attend.</p></div></div>
              <fieldset className={styles.locationFormat}>
                <legend>Event format</legend>
                <div>{(["In person", "Online"] as const).map((format) => <button key={format} type="button" className={draft.format === format ? styles.activeLocationFormat : ""} aria-pressed={draft.format === format} onClick={() => patchDraft("format", format)}>{format}</button>)}</div>
                <p>{draft.format === "In person" ? "Add a venue name and complete street address." : "Only a meeting link is needed for an online event."}</p>
              </fieldset>
              <div className={styles.formGrid}>
                {draft.format !== "Online" && <label className={styles.field}><span>Venue name</span><input required value={draft.venueName} placeholder="e.g. ClaySpace Studio" onChange={(event) => patchDraft("venueName", event.target.value)} /></label>}
                {draft.format !== "Online" && <label className={styles.field}><span>Full address</span><input required value={draft.location} placeholder="Street, district, city" onChange={(event) => patchDraft("location", event.target.value)} /></label>}
                {draft.format === "Online" && <label className={`${styles.field} ${styles.spanTwo}`}><span>Meeting link</span><input required type="url" value={draft.meetingLink} placeholder="https://…" onChange={(event) => patchDraft("meetingLink", event.target.value)} /></label>}
                {draft.format !== "Online" && <label className={`${styles.field} ${styles.spanTwo}`}><span>Arrival instructions</span><textarea rows={3} value={draft.arrival} placeholder="Entrance, floor, parking, or check-in details" onChange={(event) => patchDraft("arrival", event.target.value)} /></label>}
              </div>
            </section>
          </section>

          <section id="access" className={styles.section} tabIndex={-1} ref={(node) => { stepSections.current[3] = node; }}>
            <div className={styles.sectionHeading}><span><b>4</b>Access and pricing</span><h2>How can people join?</h2><p>Choose the access model and tell guests what happens if plans change.</p></div>
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

          <section id="publish" className={styles.section} tabIndex={-1} ref={(node) => { stepSections.current[4] = node; }}>
            <div className={styles.sectionHeading}><span><b>5</b>Review and publish</span><h2>Ready to go live?</h2><p>Review the essentials and choose who can discover the listing.</p></div>
            <div className={styles.publishGrid}>
              <div className={styles.checklist}>{checklist.map((item) => <button type="button" key={item.label} className={item.complete ? styles.complete : styles.incomplete} onClick={() => goToStep(item.step)}>{item.complete ? <IconCircleCheck size={19} /> : <IconClock size={19} />}<span>{item.label}</span><strong>{item.complete ? "Ready" : "Edit details"}</strong></button>)}</div>
              <fieldset className={styles.radioList}><legend>Visibility</legend>{(["Public", "Unlisted", "Community only"] as const).map((option) => <label key={option}><input type="radio" name="visibility" checked={draft.visibility === option} onChange={() => patchDraft("visibility", option)} /><span><strong>{option}</strong><small>{option === "Public" ? "Anyone can discover and join." : option === "Unlisted" ? "Only people with the link can view it." : "Only community members can view it."}</small></span></label>)}</fieldset>
              <div className={styles.publishPanel}><IconSparkles size={22} /><strong>{readyToPublish ? "Everything is ready." : "A few details need attention."}</strong><p>{readyToPublish ? "Preview the listing, then publish when it looks right." : "Use the review list to return to anything that still needs work."}</p></div>
            </div>
          </section>

          <div className={styles.stepActions}>
            <button type="button" className={styles.backButton} onClick={() => saveDraft(draft, true)}>Save and exit</button>
            <div className={styles.finalActions}>
              <button type="button" className={styles.saveButton} onClick={() => setPreviewOpen(true)}>Preview</button>
              <button type="button" className={styles.publishButton} onClick={publish}>Review and publish</button>
            </div>
          </div>

          <footer className={styles.footer}><span>Tutoria hosting standards help keep every gathering clear, inclusive, and trustworthy.</span><Link href="/events">Browse events <IconChevronRight size={16} /></Link></footer>
        </div>

        <aside className={styles.livePreview} aria-label="Live listing preview">
          <div className={styles.livePreviewTop}>
            <strong>Live preview</strong>
            <span>Draft</span>
          </div>
          <div className={styles.livePreviewCard}>
            <div className={styles.livePreviewImage}>
              {draft.coverImage ? <Image src={draft.coverImage} alt={`${draft.title} cover`} fill unoptimized sizes="320px" /> : <div className={styles.imageEmptyState}><IconPhoto size={24} /><span>Cover image</span></div>}
              <span>{draft.type} · {draft.format}</span>
            </div>
            <div className={styles.livePreviewBody}>
              <small>{draft.category || "Category"} · {draft.level}</small>
              <h2>{draft.title || "Your experience title"}</h2>
              <p>{draft.promise || "Your one-sentence promise will appear here."}</p>
              <dl>
                <div><dt>Date</dt><dd>{draft.sessions[0]?.date ? formatSessionDate(draft.sessions[0].date) : "Not set"}</dd></div>
                <div><dt>Capacity</dt><dd>{draft.capacity > 0 ? `${draft.capacity} guests` : "Not set"}</dd></div>
              </dl>
              <div className={styles.livePreviewFooter}>
                <div><span>From</span><strong>{draft.access === "Paid" ? formatPrice(draft.price) : draft.access}</strong></div>
                <button type="button">Reserve</button>
              </div>
            </div>
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
