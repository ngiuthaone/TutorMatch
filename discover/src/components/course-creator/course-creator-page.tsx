"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { CourseCreatorShell, NAV_PAGES, type SaveStatus } from "./course-creator-shell";
import { OnboardingWizard, type CourseType, type WeeklyTime } from "./onboarding-wizard";
import { payloadToFlatBody, flatToPayload, type FlatCourseItem } from "./payload-mapper";
import { publishBackendCourse } from "@/lib/courses/backend-courses-api";
import { isLiveMode } from "@/lib/auth/config";

import { IntendedLearnersPage } from "./pages/intended-learners-page";
import type { IntendedLearnersData } from "./pages/intended-learners-page";
import { LandingPagePage } from "./pages/landing-page-page";
import type { LandingPageData } from "./pages/landing-page-page";
import { PricingPage } from "./pages/pricing-page";
import type { PricingData } from "./pages/pricing-page";
import CurriculumPage from "./pages/curriculum-page";
import type { CurriculumData } from "./pages/curriculum-page";
import CourseMessagesPage from "./pages/course-messages-page";
import type { CourseMessagesData } from "./pages/course-messages-page";
import SubmitReviewPage from "./pages/submit-review-page";
import type { SubmitReviewData } from "./pages/submit-review-page";
import PromotionsPage from "./pages/promotions-page";
import type { PromotionsData } from "./pages/promotions-page";
import CaptionsPage from "./pages/captions-page";
import type { CaptionsData } from "./pages/captions-page";
import VideoSetupPage from "./pages/video-setup-page";
import type { VideoSetupData } from "./pages/video-setup-page";
import type { SetupTestVideoData } from "./pages/setup-test-video-page";
import type { FilmEditData } from "./pages/film-edit-page";
import FaqPage from "./pages/faq-page";
import type { FaqData } from "./pages/faq-page";

export interface CourseDraftPayload {
  intendedLearners: IntendedLearnersData;
  landingPage: LandingPageData;
  pricing: PricingData;
  curriculum: CurriculumData;
  courseMessages: CourseMessagesData;
  submitReview: SubmitReviewData;
  promotions: PromotionsData;
  captions: CaptionsData;
  videoSetup: VideoSetupData;
  faq: FaqData;
  // Deprecated — kept for migration
  accessibility?: unknown;
  courseStructure?: unknown;
  setupTestVideo?: unknown;
  filmEdit?: unknown;
}

export interface CourseDraftMeta {
  courseType: CourseType;
  category: string;
  weeklyTime: WeeklyTime;
}

export interface CourseDraft extends CourseDraftMeta {
  id?: string;
  title: string;
  slug?: string;
  status: "draft" | "published";
  createdAt?: string;
  updatedAt?: string;
  payload: CourseDraftPayload;
  version?: number;
}

export type CourseCreatorMode = "new" | "edit";

export interface CourseCreatorPageProps {
  mode: CourseCreatorMode;
  courseId?: string;
}

const DEFAULT_INTENDED_LEARNERS: IntendedLearnersData = {
  outcomes: [
    "Bake naturally leavened sourdough bread from scratch",
    "Manage a healthy starter and control fermentation",
    "Shape, score, and bake loaves in a home oven",
    "Troubleshoot common sourdough problems confidently"
  ],
  requirements: ["No prior experience is required."],
  audiences: ["Home bakers wanting to master artisan bread"],
};

const DEFAULT_LANDING_PAGE: LandingPageData = {
  title: "",
  subtitle: "",
  description: "",
  language: "English",
  level: "all",
  category: "",
  subcategory: "",
  topics: [],
  topicDraft: "",
  coverName: "",
  coverUrl: "",
  coverMode: "file",
  coverUrlInput: "",
  promoName: "",
  promoUrl: "",
  promoMode: "file",
  promoUrlInput: "",
};

const DEFAULT_PRICING: PricingData = {
  priceMode: "free",
  priceTier: "",
  currency: "VND",
  premiumInstructor: false,
  payoutReady: false,
  taxInfo: false,
};

const DEFAULT_CURRICULUM: CurriculumData = {
  sections: [
    {
      id: "section-intro",
      title: "Introduction",
      goal: "Understand what the course covers and how to use it.",
      items: [
        {
          id: "item-welcome",
          type: "lecture",
          title: "Welcome to the course",
          fileName: "welcome.mp4",
          videoMinutes: 4,
          complete: true,
        },
      ],
    },
  ],
  addingSection: false,
};

const DEFAULT_COURSE_MESSAGES: CourseMessagesData = {
  welcome: "",
  completion: "",
  messagePreview: "welcome",
  instructorName: "Instructor",
};
const DEFAULT_SUBMIT_REVIEW: SubmitReviewData = {
  courseUrl: "master-sourdough-baking",
  identityVerified: true,
  termsAccepted: true,
  ready: false,
};
const DEFAULT_PROMOTIONS: PromotionsData = {
  coupons: [],
};
const DEFAULT_CAPTIONS: CaptionsData = {
  languages: ["English"],
  activeLanguage: "English",
  tracks: [],
};
const DEFAULT_VIDEO_SETUP: VideoSetupData = {
  status: "empty",
  progress: 0,
  submitted: false,
  setupChecks: { audio: true, lighting: true, video: true, background: true },
};
const DEFAULT_FAQ: FaqData = {
  faqs: [{ id: "faq-default", question: "", answer: "" }],
};

function migratePayload(raw: Record<string, unknown>): Partial<CourseDraftPayload> {
  const r = raw as Record<string, unknown> & {
    setupTestVideo?: SetupTestVideoData;
    filmEdit?: FilmEditData;
  };
  if (r.videoSetup) return r as Partial<CourseDraftPayload>;
  if (r.setupTestVideo) {
    const s = r.setupTestVideo as SetupTestVideoData;
    return {
      ...r,
      videoSetup: {
        status: s.videoFileName ? (s.submitted ? "submitted" : "ready") : "empty",
        progress: s.videoFileName ? 100 : 0,
        videoFileName: s.videoFileName,
        submitted: s.submitted ?? false,
        setupChecks: s.setupChecks ?? DEFAULT_VIDEO_SETUP.setupChecks,
      } as VideoSetupData,
    } as Partial<CourseDraftPayload>;
  }
  return r as Partial<CourseDraftPayload>;
}

function emptyPayload(): CourseDraftPayload {
  return {
    intendedLearners: DEFAULT_INTENDED_LEARNERS,
    landingPage: DEFAULT_LANDING_PAGE,
    pricing: DEFAULT_PRICING,
    curriculum: DEFAULT_CURRICULUM,
    courseMessages: DEFAULT_COURSE_MESSAGES,
    submitReview: DEFAULT_SUBMIT_REVIEW,
    promotions: DEFAULT_PROMOTIONS,
    captions: DEFAULT_CAPTIONS,
    videoSetup: DEFAULT_VIDEO_SETUP,
    faq: DEFAULT_FAQ,
  };
}

function emptyDraft(): CourseDraft {
  return {
    courseType: "course",
    title: "",
    category: "",
    weeklyTime: "undecided",
    status: "draft",
    payload: emptyPayload(),
  };
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled-course"
  );
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  code?: string;
  message?: string;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  try {
    const cfg = window.localStorage.getItem("tutoria_api_base_url") || "";
    return cfg.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function readErrorCode(payload: unknown, status: number, fallback: string): string {
  const obj = payload as { error?: { code?: unknown } } | null;
  const code = obj?.error?.code;
  if (typeof code === "string") return code;
  if (status === 401) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return fallback;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const obj = payload as { error?: { message?: unknown } } | null;
  const msg = obj?.error?.message;
  if (typeof msg === "string") return msg;
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("tutoria_session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { access_token?: unknown };
    return typeof parsed.access_token === "string" ? parsed.access_token : "";
  } catch {
    return "";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const base = getApiBase();
  const url = `${base}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      credentials: "omit",
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: readErrorCode(payload, response.status, "REQUEST_FAILED"),
        message: readErrorMessage(payload, "Request failed"),
      };
    }
    return { ok: true, status: response.status, data: payload as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: "NETWORK",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

interface BackendCourseResponse {
  ok?: boolean;
  item?: FlatCourseItem & {
    id: string;
    kind?: string;
    slug: string;
    payload?: Record<string, unknown>;
    publishedAt?: string;
    status?: string;
    version?: number;
  };
}

async function refreshSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("tutoria_session");
    if (!raw) return false;
    const session = JSON.parse(raw) as {
      refresh_token?: unknown;
      refreshToken?: unknown;
      expires_at?: number;
      expiresAt?: number;
    };
    const refreshToken =
      typeof session.refresh_token === "string"
        ? session.refresh_token
        : typeof session.refreshToken === "string"
          ? session.refreshToken
          : "";
    if (!refreshToken) return false;

    const base = getApiBase();
    const res = await fetch(`${base}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      credentials: "omit",
    });

    if (!res.ok) return false;

    const data = (await parseJson(res)) as { access_token?: string; refresh_token?: string } | null;
    if (!data?.access_token) return false;

    const updatedSession = {
      ...session,
      access_token: data.access_token,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    };
    window.localStorage.setItem("tutoria_session", JSON.stringify(updatedSession));
    return true;
  } catch {
    return false;
  }
}

function hydrateDraftFromBackend(item: NonNullable<BackendCourseResponse["item"]>): CourseDraft {
  const payload = flatToPayload(item);
  return {
    id: item.id,
    courseType: "course",
    title: item.title ?? "",
    slug: item.slug,
    category: payload.landingPage.category ?? "",
    weeklyTime: "undecided",
    status: item.status === "published" ? "published" : "draft",
    updatedAt: item.publishedAt,
    version: item.version,
    payload,
  };
}

const PAGE_META: Record<string, { kicker: string; title: string; description: string; optional: boolean }> = {
  "intended-learners": {
    kicker: "Plan",
    title: "Intended learners",
    description: "The following descriptions will be publicly visible on your course landing page and help learners decide whether the course is right for them.",
    optional: false,
  },
  "course-structure": {
    kicker: "Plan your course",
    title: "Course structure",
    description: "Decide how many sections and lectures you will produce for this course.",
    optional: false,
  },
  "video-setup": {
    kicker: "Plan",
    title: "Video & setup",
    description: "Prepare your video workflow and test your recording setup before you publish.",
    optional: false,
  },
  "curriculum": {
    kicker: "Create your content",
    title: "Curriculum",
    description: "Build the section and lecture outline that learners will follow.",
    optional: false,
  },
  "captions": {
    kicker: "Create your content",
    title: "Captions",
    description: "Add caption tracks to make your course accessible across languages.",
    optional: true,
  },
  "landing-page": {
    kicker: "Publish",
    title: "Course landing page",
    description: "Craft the page learners see first — title, description, cover image, and preview video.",
    optional: false,
  },
  "pricing": {
    kicker: "Publish",
    title: "Pricing",
    description: "Set your price, payouts, and tax information for this course.",
    optional: false,
  },
  "promotions": {
    kicker: "Publish",
    title: "Promotions",
    description: "Create a coupon code to drive enrollment during launch.",
    optional: true,
  },
  "course-messages": {
    kicker: "Publish",
    title: "Course messages",
    description: "Welcome new learners with an automatic message after enrollment.",
    optional: true,
  },
  "submit-review": {
    kicker: "Publish",
    title: "Submit for review",
    description: "Resolve every required item, confirm ownership and identity, then submit the course to the quality review queue.",
    optional: false,
  },
};

const DEBOUNCE_MS = 1500;

export function CourseCreatorPage({ mode, courseId }: CourseCreatorPageProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<string>(NAV_PAGES[0].id);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [draft, setDraft] = useState<CourseDraft>(() => emptyDraft());
  const draftRef = useRef<CourseDraft>(draft);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  async function reFetchCourse(courseId: string): Promise<CourseDraft | null> {
    const result = await apiRequest<BackendCourseResponse>(
      `/api/v1/courses/${encodeURIComponent(courseId)}`,
      { method: "GET" }
    );
    if (!result.ok || !result.data?.item) return null;
    return hydrateDraftFromBackend(result.data.item);
  }

  async function attempt401Recovery(): Promise<boolean> {
    const recovered = await refreshSession();
    if (!recovered) {
      setSaveStatus("error");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("tutoria_session");
      }
      return false;
    }
    return true;
  }

  const performSave = useCallback(async (snapshot: CourseDraft): Promise<boolean> => {
    if (!snapshot.id) return false;
    if (saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
    setSaveStatus("saving");
    const flat = payloadToFlatBody(snapshot);
    const result = await apiRequest<BackendCourseResponse>(
      `/api/v1/courses/${encodeURIComponent(snapshot.id)}`,
      { method: "PATCH", body: { ...flat, version: snapshot.version ?? 1 } }
    );
    if (result.status === 401) {
      saveInFlightRef.current = false;
      const recovered = await attempt401Recovery();
      if (recovered) {
        const retryFlat = payloadToFlatBody(draftRef.current);
        const retryResult = await apiRequest<BackendCourseResponse>(
          `/api/v1/courses/${encodeURIComponent(snapshot.id)}`,
          { method: "PATCH", body: { ...retryFlat, version: draftRef.current.version ?? 1 } }
        );
        saveInFlightRef.current = false;
        if (!retryResult.ok) {
          setSaveStatus("error");
          return false;
        }
        const updated = retryResult.data?.item ? hydrateDraftFromBackend(retryResult.data.item) : null;
        if (!updated) {
          setSaveStatus("error");
          return false;
        }
        setDraft(updated);
        lastSavedRef.current = JSON.stringify(updated.payload);
        setSaveStatus("saved");
        return true;
      }
      setSaveStatus("error");
      return false;
    }
    if (result.status === 409) {
      saveInFlightRef.current = false;
      const refreshed = await reFetchCourse(snapshot.id);
      if (refreshed) {
        setDraft(refreshed);
        lastSavedRef.current = JSON.stringify(refreshed.payload);
      }
      setSaveStatus("error");
      return false;
    }
    saveInFlightRef.current = false;
    if (!result.ok) {
      setSaveStatus("error");
      return false;
    }
    const updated = result.data?.item ? hydrateDraftFromBackend(result.data.item) : null;
    if (!updated) {
      setSaveStatus("error");
      return false;
    }
    setDraft(updated);
    lastSavedRef.current = JSON.stringify(updated.payload);
    setSaveStatus("saved");
    return true;
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (!draftRef.current.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus((prev) => (prev === "error" ? prev : "idle"));
    debounceRef.current = setTimeout(() => {
      void performSave(draftRef.current);
    }, DEBOUNCE_MS);
  }, [performSave]);

  const updatePayload = useCallback(
    <K extends keyof CourseDraftPayload>(key: K, value: CourseDraftPayload[K]) => {
      setDraft((prev) => ({
        ...prev,
        payload: { ...prev.payload, [key]: value },
        updatedAt: new Date().toISOString(),
      }));
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  const updateMeta = useCallback(
    (patch: Partial<Pick<CourseDraft, "title" | "slug" | "category" | "weeklyTime">>) => {
      setDraft((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  useEffect(() => {
    if (mode !== "edit" || !courseId) return;
    let cancelled = false;
    queueMicrotask(() => {
      setLoadStatus("loading");
      setLoadError(null);
      void (async () => {
        const result = await apiRequest<BackendCourseResponse>(
          `/api/v1/courses/${encodeURIComponent(courseId)}`,
          { method: "GET" }
        );
        if (cancelled) return;
        if (!result.ok || !result.data?.item) {
          setLoadStatus("error");
          setLoadError(result.message ?? "Could not load this course.");
          return;
        }
        const hydrated = hydrateDraftFromBackend(result.data.item);
        setDraft(hydrated);
        lastSavedRef.current = JSON.stringify(hydrated.payload);
        setLoadStatus("ready");
        setSaveStatus("saved");
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [mode, courseId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleOnboardingComplete = useCallback(
    async (data: { type: CourseType; title: string; category: string; weeklyTime: WeeklyTime }) => {
      const base: CourseDraft = {
        ...emptyDraft(),
        courseType: data.type,
        title: data.title,
        slug: slugify(data.title),
        category: data.category,
        weeklyTime: data.weeklyTime,
        payload: {
          ...emptyPayload(),
          landingPage: { ...DEFAULT_LANDING_PAGE, title: data.title, category: data.category },
        },
      };
      setDraft(base);
      setShowWizard(false);
      setSaveStatus("saving");
      const flat = payloadToFlatBody(base);
      const result = await apiRequest<BackendCourseResponse>("/api/v1/courses", {
        method: "POST",
        body: flat,
      });
      if (!result.ok || !result.data?.item) {
        setSaveStatus("error");
        return;
      }
      const created = result.data.item;
      const next: CourseDraft = { ...base, id: created.id, slug: created.slug, version: created.version };
      setDraft(next);
      lastSavedRef.current = JSON.stringify(next.payload);
      setSaveStatus("saved");
      if (typeof window !== "undefined" && created.id) {
        window.history.replaceState({}, "", `/courses/${encodeURIComponent(created.id)}/edit`);
      }
    },
    []
  );

  const handleExit = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    router.push("/discussions");
  }, [router]);

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleSaveNow = useCallback(() => {
    if (!draftRef.current.id) {
      setSaveStatus("error");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void performSave(draftRef.current);
  }, [performSave]);

  const handlePrev = useCallback(() => {
    const idx = NAV_PAGES.findIndex((p) => p.id === currentPage);
    if (idx > 0) {
      const prevItem = NAV_PAGES[idx - 1];
      handleNavigate(prevItem.id);
    }
  }, [currentPage, handleNavigate]);

  const handleNext = useCallback(async () => {
    const idx = NAV_PAGES.findIndex((p) => p.id === currentPage);
    if (idx < NAV_PAGES.length - 1) {
      const nextItem = NAV_PAGES[idx + 1];
      handleNavigate(nextItem.id);
    } else {
      await handleSaveNow();
    }
  }, [currentPage, handleNavigate, handleSaveNow]);

  const handlePublish = useCallback(async () => {
    const current = draftRef.current;
    if (!current.id) {
      setSaveStatus("error");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    const ok = await performSave(current);
    if (!ok) return;
    const flat = payloadToFlatBody(current);
    if (isLiveMode()) {
      try {
        const published = await publishBackendCourse({
          slug: current.slug || slugify(flat.title),
          title: flat.title,
          payload: flat as unknown as Record<string, unknown>,
        });
        setSaveStatus("saved");
        router.push(`/courses/${encodeURIComponent(published.slug)}`);
        return;
      } catch {
        setSaveStatus("error");
        return;
      }
    }
    const result = await apiRequest<BackendCourseResponse>(
      `/api/v1/courses/${encodeURIComponent(current.id)}/publish`,
      { method: "POST" }
    );
    if (!result.ok) {
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saved");
    if (current.slug) {
      router.push(`/courses/${encodeURIComponent(current.slug)}`);
    }
  }, [performSave, router]);

  const handleSubmitForReview = useCallback(() => {
    updatePayload("submitReview", { ...draft.payload.submitReview, ready: true });
    setCurrentPage("submit-review");
  }, [updatePayload, draft.payload.submitReview]);

  const handlePreview = useCallback(() => {
    const slug = draftRef.current.slug;
    if (slug) router.push(`/courses/${encodeURIComponent(slug)}`);
  }, [router]);

  const handleShare = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard && draftRef.current.slug) {
      void navigator.clipboard.writeText(
        `${window.location.origin}/courses/${encodeURIComponent(draftRef.current.slug)}`
      );
    }
  }, []);

  const pageMeta = useMemo(
    () => PAGE_META[currentPage] ?? PAGE_META["intended-learners"],
    [currentPage]
  );

  const isPracticeTestMode = draft.courseType === "practice-test";

  const isLoading = mode === "edit" && loadStatus === "loading";
  const loadFailed = mode === "edit" && loadStatus === "error";

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e9ebed",
          color: "#17181a",
          fontFamily: '"Instrument Sans", "SF Pro Text", -apple-system, sans-serif',
        }}
      >
        <span style={{ fontSize: 14, color: "#73777d" }}>Loading course…</span>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e9ebed",
          color: "#17181a",
          fontFamily: '"Instrument Sans", "SF Pro Text", -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>Could not load this course</h1>
          <p style={{ fontSize: 14, color: "#73777d", margin: "0 0 16px" }}>{loadError}</p>
          <button
            type="button"
            onClick={handleExit}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #cfd1d4",
              background: "#fff",
              color: "#17181a",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (showWizard) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onExit={handleExit}
        initial={{
          type: draft.courseType,
          title: draft.title,
          category: draft.category,
          weeklyTime: draft.weeklyTime,
        }}
      />
    );
  }

  return (
    <CourseCreatorShell
      courseId={draft.id}
      courseTitle={draft.title || draft.payload.landingPage.title}
      saveStatus={saveStatus}
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onSave={handleSaveNow}
      onPrev={currentPage === NAV_PAGES[0].id ? undefined : handlePrev}
      onNext={handleNext}
      onSubmitForReview={handleSubmitForReview}
      onPreview={handlePreview}
      onShare={handleShare}
      onExit={handleExit}
      onPublish={handlePublish}
      isPracticeTestMode={isPracticeTestMode}
      pageKicker={pageMeta.kicker}
      pageTitle={pageMeta.title}
      pageDescription={pageMeta.description}
      isOptionalPage={pageMeta.optional}
      completedPages={
        draft.payload.submitReview.ready
          ? ["intended-learners", "course-structure", "submit-review"]
          : []
      }
    >
      <PageRenderer
        pageId={currentPage}
        payload={draft.payload}
        updatePayload={updatePayload}
        updateMeta={updateMeta}
      />
    </CourseCreatorShell>
  );
}

function PageRenderer({
  pageId,
  payload,
  updatePayload,
  updateMeta,
}: {
  pageId: string;
  payload: CourseDraftPayload;
  updatePayload: <K extends keyof CourseDraftPayload>(key: K, value: CourseDraftPayload[K]) => void;
  updateMeta: (patch: Partial<Pick<CourseDraft, "title" | "slug" | "category" | "weeklyTime">>) => void;
}): ReactNode {
  switch (pageId) {
    case "intended-learners":
      return (
        <IntendedLearnersPage
          initialData={payload.intendedLearners}
          onChange={(data) => updatePayload("intendedLearners", data)}
        />
      );
    case "landing-page":
      return (
        <LandingPagePage
          initialData={payload.landingPage}
          onChange={(data) => {
            updatePayload("landingPage", data);
            updateMeta({ title: data.title });
          }}
        />
      );
    case "pricing":
      return (
        <PricingPage
          initialData={payload.pricing}
          onChange={(data) => updatePayload("pricing", data)}
        />
      );
    case "curriculum":
      return (
        <CurriculumPage
          initialData={payload.curriculum}
          onChange={(data) => updatePayload("curriculum", data)}
        />
      );
    case "course-messages":
      return (
        <CourseMessagesPage
          initialData={payload.courseMessages}
          onChange={(data) => updatePayload("courseMessages", data)}
        />
      );
    case "submit-review":
      return (
        <SubmitReviewPage
          initialData={payload.submitReview}
          onChange={(data) => updatePayload("submitReview", data)}
        />
      );
    case "promotions":
      return (
        <PromotionsPage
          initialData={payload.promotions}
          onChange={(data) => updatePayload("promotions", data)}
        />
      );
    case "captions":
      return (
        <CaptionsPage
          initialData={payload.captions}
          onChange={(data) => updatePayload("captions", data)}
          isComingSoon={false}
        />
      );
    case "video-setup":
      return (
        <VideoSetupPage
          initialData={payload.videoSetup}
          onChange={(data) => updatePayload("videoSetup", data)}
        />
      );
    case "faq":
      return (
        <FaqPage
          initialData={payload.faq}
          onChange={(data) => updatePayload("faq", data)}
        />
      );
    default:
      return null;
  }
}
