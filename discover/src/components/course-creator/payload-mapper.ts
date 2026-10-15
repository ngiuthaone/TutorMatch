import type { CourseDraft, CourseDraftPayload } from "./course-creator-page";
import { getLiveIdentity } from "@/lib/auth/identity";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface InstructorInfo {
  role: string;
  bio: string;
  image: string;
}

export interface FlatCourseBody {
  title: string;
  subtitle: string;
  description: string;
  language: string;
  level: string;
  category: string;
  subcategory: string;
  topics: string[];
  cover_url: string;
  promo_video_url: string;
  welcome_message: string;
  completion_message: string;
  intended_learners: string;
  requirements: string;
  what_you_will_learn: string;
  who_is_this_for: string;
  weekly_time_estimate: string | null;
  accessibility_captions_claimed: boolean;
  accessibility_audio_claimed: boolean;
  accessibility_materials_claimed: boolean;
  price: number | null;
  currency: string;
  certificate: boolean;
  faqs: FaqItem[];
  instructor: InstructorInfo;
}

export interface FlatCourseItem extends FlatCourseBody {
  id: string;
  slug: string;
  status: string;
  version: number;
  publishedAt?: string;
  sections?: unknown[];
}

export function payloadToFlatBody(draft: CourseDraft): FlatCourseBody {
  const lp = draft.payload.landingPage;
  const il = draft.payload.intendedLearners;
  const cm = draft.payload.courseMessages;
  const ac = (draft.payload as unknown as { accessibility?: { groups: { id: string; enabled?: boolean }[] } }).accessibility;
  const captionsGroup = ac?.groups.find((g) => g.id === "captions");

  const intendedLearnersLines = [
    ...il.outcomes.filter((o) => o.trim()),
    ...il.requirements.filter((r) => r.trim()),
  ];
  const intended_learners = intendedLearnersLines.join("\n") || "";

  const requirements = il.requirements.filter((r) => r.trim()).join("\n") || "";
  const whatYouWillLearn = il.outcomes.filter((o) => o.trim()).join("\n") || "";

  const audiences = il.audiences.filter((a) => a.trim()).join("\n") || "";
  const whoIsThisFor = audiences;

  const cover_url =
    lp.coverMode === "url" && lp.coverUrlInput.trim() ? lp.coverUrlInput.trim() : lp.coverUrl;

  const promo_video_url =
    lp.promoMode === "url" && lp.promoUrlInput.trim() ? lp.promoUrlInput.trim() : lp.promoUrl;

  const accessibility_captions_claimed =
    captionsGroup?.enabled ?? false;
  const accessibility_audio_claimed = false;
  const accessibility_materials_claimed = false;

  const pricing = draft.payload.pricing;
  const price =
    pricing.priceMode === "paid" && pricing.priceTier
      ? Number(pricing.priceTier) || null
      : null;

  const faqs: FaqItem[] = (draft.payload.faq?.faqs ?? [])
    .filter((f) => f.question.trim() || f.answer.trim())
    .map((f) => ({ question: f.question, answer: f.answer }));

  const identity = getLiveIdentity();
  const instructor: InstructorInfo = {
    role: identity?.role ?? "Instructor",
    bio: "",
    image: identity?.avatarUrl ?? "",
  };

  return {
    title: lp.title || draft.title,
    subtitle: lp.subtitle,
    description: lp.description,
    language: lp.language,
    level: lp.level,
    category: lp.category,
    subcategory: lp.subcategory,
    topics: lp.topics,
    cover_url,
    promo_video_url,
    welcome_message: cm.welcome,
    completion_message: cm.completion,
    intended_learners,
    requirements,
    what_you_will_learn: whatYouWillLearn,
    who_is_this_for: whoIsThisFor,
    weekly_time_estimate: draft.weeklyTime === "undecided" ? null : draft.weeklyTime,
    accessibility_captions_claimed,
    accessibility_audio_claimed,
    accessibility_materials_claimed,
    price,
    currency: pricing.currency || "VND",
    certificate: false,
    faqs,
    instructor,
  };
}

export function flatToPayload(item: FlatCourseItem): CourseDraftPayload {
  const intended_learnersRaw = (item as unknown as { intended_learners?: string }).intended_learners ?? "";
  const requirementsRaw = (item as unknown as { requirements?: string }).requirements ?? "";
  const whatYouWillLearnRaw = (item as unknown as { what_you_will_learn?: string }).what_you_will_learn ?? "";
  const whoIsThisForRaw = (item as unknown as { who_is_this_for?: string }).who_is_this_for ?? "";

  const splitNonEmpty = (raw: string): string[] => {
    const parts = raw.split("\n").map((s) => s.trim());
    return parts.filter((s) => s.length > 0);
  };

  const outcomes = splitNonEmpty(whatYouWillLearnRaw);
  const requirements = splitNonEmpty(requirementsRaw);
  const audiences = splitNonEmpty(whoIsThisForRaw);

  const defaultOutcomes = ["", "", "", ""];
  const defaultRequirements = ["No prior experience is required."];
  const defaultAudiences = [""];

  const landingPage = {
    title: item.title,
    subtitle: item.subtitle ?? "",
    description: item.description ?? "",
    language: item.language ?? "English",
    level: item.level ?? "all",
    category: item.category ?? "",
    subcategory: item.subcategory ?? "",
    topics: item.topics ?? [],
    topicDraft: "",
    coverName: "",
    coverUrl: item.cover_url ?? "",
    coverMode: "file" as const,
    coverUrlInput: item.cover_url ?? "",
    promoName: "",
    promoUrl: item.promo_video_url ?? "",
    promoMode: "file" as const,
    promoUrlInput: item.promo_video_url ?? "",
  };

  const captionsGroup = {
    id: "captions" as const,
    icon: "captions" as const,
    title: "Captions meet accessibility standards",
    description: "Claim this only after reviewing every published video.",
    enabled: item.accessibility_captions_claimed ?? false,
    items: [
      { key: "accurate", label: "Captions accurately represent spoken words", checked: false },
      { key: "synced", label: "Caption timing is synchronized with speech", checked: false },
      { key: "speakers", label: "Speaker changes are identified when needed", checked: false },
      { key: "sounds", label: "Meaningful sounds and music are described", checked: false },
    ],
  };

  return {
    intendedLearners: {
      outcomes: outcomes.length >= 4 ? outcomes : [...outcomes, ...defaultOutcomes.slice(outcomes.length)],
      requirements: requirements.length >= 1 ? requirements : defaultRequirements,
      audiences: audiences.length >= 1 ? audiences : defaultAudiences,
    },
    landingPage,
    pricing: {
      priceMode: (item.price !== null && item.price ? "paid" : "free") as "free" | "paid",
      priceTier: item.price !== null ? String(item.price) : "",
      currency: item.currency || "VND",
      premiumInstructor: false,
      payoutReady: false,
      taxInfo: false,
    },
    curriculum: {
      sections: [
        {
          id: "section-intro",
          title: "Introduction",
          goal: "Understand what the course covers and how to use it.",
          items: [
            {
              id: "item-welcome",
              type: "lecture" as const,
              title: "Welcome to the course",
              fileName: "welcome.mp4",
              videoMinutes: 4,
              complete: true,
            },
          ],
        },
      ],
      addingSection: false,
    },
    courseMessages: {
      welcome: item.welcome_message ?? "",
      completion: item.completion_message ?? "",
      messagePreview: "welcome" as const,
      instructorName: getLiveIdentity()?.name ?? "Instructor",
    },
    submitReview: {
      courseUrl: "",
      identityVerified: false,
      termsAccepted: false,
      ready: false,
    },
    promotions: { coupons: [] },
    captions: { languages: ["English"], activeLanguage: "English", tracks: [] },
    accessibility: {
      groups: [captionsGroup],
    },
    courseStructure: { sections: [], planChecks: { outcomes: false, practice: false, sections: false }, structureNotes: "" },
    videoSetup: { status: "empty" as const, progress: 0, submitted: false, setupChecks: { audio: false, lighting: false, video: false, background: false } },
    faq: {
      faqs:
        item.faqs && item.faqs.length > 0
          ? item.faqs.map((f, i) => ({ id: "faq-" + i, question: f.question, answer: f.answer }))
          : [{ id: "faq-default", question: "", answer: "" }],
    },
  };
}
