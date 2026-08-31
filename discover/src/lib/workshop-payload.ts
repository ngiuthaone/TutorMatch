import type { EventDetail } from "@/lib/event-data";

export interface WorkshopDataHero {
  title: string;
  subtitle: string;
  duration: string;
  coverImage?: string;
  photos: string[];
}

export interface WorkshopDataPackage {
  id: string;
  name: string;
  price: number;
  description?: string;
  badge?: string;
  includes: string[];
}

export interface WorkshopDataLocation {
  name: string;
  area: string;
  note: string;
  mapQuery: string;
  mapUrl?: string;
  timezone?: string;
}

export interface WorkshopDataHost {
  name: string;
  role: string;
  bio: string;
  avatar?: string;
  recommendation?: string;
}

export interface WorkshopDataPlanStep {
  id: string;
  title: string;
  time: string;
  description: string;
  image?: string;
}

export interface WorkshopDataSession {
  id: string;
  start: string;
  end: string;
  label: string;
  minParticipants?: number;
  maxParticipants?: number;
  capacity?: number;
  bookedParticipants?: number;
  days?: string[];
  dateKey?: string;
}

export interface WorkshopDataFaq {
  id: string;
  question: string;
  answer: string;
}

export interface WorkshopDataReview {
  name: string;
  initials: string;
  rating: number;
  date: string;
  package?: string;
  text: string;
  photos?: Array<{ src: string; alt: string }>;
}

export interface WorkshopDataRecommendation {
  slug: string;
  title: string;
  category: string;
  host: string;
  rating: number;
  reviewCount: number;
  duration: string;
  location: string;
  priceFrom: number;
  image?: string;
  priority?: "host" | "other-hosts" | "default";
}

export interface WorkshopDataFacts {
  format?: string;
  duration?: string;
  languages?: string[];
  minimumAge?: string;
  minimumAgeNote?: string;
  accessibility?: string;
}

export interface WorkshopData {
  slug: string;
  hero: WorkshopDataHero;
  overview: { heading: string; paragraphs: string[] };
  details: { learn: string[]; included: string[]; bring: string[]; checklists?: Array<{ title: string; items: string[] }> };
  facts: WorkshopDataFacts;
  booking: {
    pricingMode: "single" | "multiple";
    defaultPackageId?: string;
    cancellation: string;
    packages: WorkshopDataPackage[];
  };
  location: WorkshopDataLocation;
  host: WorkshopDataHost;
  plan: { heading: string; intro: string; steps: WorkshopDataPlanStep[] };
  schedule: { heading: string; intro: string; sessions: WorkshopDataSession[] };
  faq: { heading: string; items: WorkshopDataFaq[] };
  reviews: { heading: string; rating: number; reviewCount: number; items: WorkshopDataReview[] };
  recommendations: WorkshopDataRecommendation[];
}

const unwrapVnd = (price?: string | number): number => {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    const digits = price.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
};

const asDateLabel = (isoOrLabel: string): string => {
  const d = new Date(isoOrLabel);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
  }
  return isoOrLabel;
};

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const VIETNAMESE_MONTHS: Record<string, number> = {
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5,
  "7": 6, "8": 7, "9": 8, "10": 9, "11": 10, "12": 11,
};

const toDateKey = (label?: string): string | undefined => {
  if (!label) return undefined;
  const raw = String(label).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const cleaned = raw.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,\s*/i, "");
  const vietnamese = cleaned.match(/^(\d{1,2})\s+thg\s+(\d{1,2})\s*,?\s*(\d{4})$/i);
  if (vietnamese) {
    const month = VIETNAMESE_MONTHS[vietnamese[2]];
    if (month === undefined) return undefined;
    return `${vietnamese[3]}-${String(month + 1).padStart(2, "0")}-${String(vietnamese[1]).padStart(2, "0")}`;
  }
  const dayFirst = cleaned.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (dayFirst) {
    const month = MONTH_INDEX[dayFirst[2].toLowerCase()];
    if (month === undefined) return undefined;
    return `${dayFirst[3]}-${String(month + 1).padStart(2, "0")}-${String(dayFirst[1]).padStart(2, "0")}`;
  }
  const monthFirst = cleaned.match(/^([a-z]{3})\s+(\d{1,2})(?:,)?\s+(\d{4})$/i);
  if (monthFirst) {
    const month = MONTH_INDEX[monthFirst[1].toLowerCase()];
    if (month === undefined) return undefined;
    return `${monthFirst[3]}-${String(month + 1).padStart(2, "0")}-${String(monthFirst[2]).padStart(2, "0")}`;
  }
  return undefined;
};

export function toWorkshopData(event: EventDetail, recommendations?: WorkshopDataRecommendation[]): WorkshopData {
  const packages: WorkshopDataPackage[] =
    (event.packages && event.packages.length ? event.packages : []).map((p, index) => ({
      id: p.id || `pkg-${index}`,
      name: p.name,
      price: p.price,
      description: p.description ?? "",
      badge: p.badge ?? "",
      includes: p.includes,
    }));

  if (!packages.length) {
    packages.push({
      id: "standard",
      name: "Standard",
      price: unwrapVnd(event.price),
      description: event.subtitle ?? "",
      badge: "",
      includes: [...(event.included ?? [])],
    });
  }

  const sessions: WorkshopDataSession[] = [];
  (event.sessions ?? []).forEach((s, sIndex) => {
    const times = Array.isArray(s.times) ? s.times : [];
    if (times.length === 0) {
      sessions.push({
        id: s.id || `session-${sIndex}`,
        start: "",
        end: "",
        label: s.date || "",
        minParticipants: 1,
        maxParticipants: event.capacity || 1,
        capacity: event.capacity || 1,
        bookedParticipants: event.attending || 0,
        days: [],
        dateKey: s.dateKey || toDateKey(s.date),
      });
    } else {
      times.forEach((time, tIndex) => {
        const [start, end] = String(time).split(" - ").map((p) => p.trim());
        sessions.push({
          id: `${s.id || `session-${sIndex}`}-${tIndex}`,
          start: start || "",
          end: end || "",
          label: s.date ? `${s.date}${time ? ` · ${time}` : ""}` : "",
          minParticipants: 1,
          maxParticipants: event.capacity || 1,
          capacity: event.capacity || 1,
          bookedParticipants: event.attending || 0,
          days: [],
          dateKey: s.dateKey || toDateKey(s.date),
        });
      });
    }
  });

  const location = {
    name: event.studioName || event.location || "",
    area: asDateLabel(event.location) === event.location ? "" : event.location,
    note: event.note && event.note !== "Accessibility: No requirements specified."
      ? event.note
      : (event.accessibility || ""),
    mapQuery: event.address || event.location || event.studioName || "",
    timezone: event.timezone,
  };

  const coverImage = event.image || event.galleryImage || undefined;

  return {
    slug: event.slug,
    hero: {
      title: event.title,
      subtitle: event.subtitle,
      duration: event.duration,
      coverImage,
      photos: [event.image, event.galleryImage, ...(event.plan ?? []).map((p) => p.image)].filter(
        (x): x is string => Boolean(x),
      ),
    },
    overview: {
      heading: event.subtitle || event.title,
      paragraphs: (event.about ?? []).length ? event.about : [event.note].filter(Boolean),
    },
    details: {
      learn: event.learn ?? [],
      included: event.included ?? [],
      bring: event.bring ?? [],
      checklists: (event.beforeYouAttend || [])
        .filter((g) => g.title && g.items?.length)
        .map((g) => ({ title: g.title, items: g.items })),
    },
    facts: {
      format: (event.type as string) || event.location,
      duration: event.duration,
      languages: event.languages ?? [],
      minimumAge: event.minimumAge,
      minimumAgeNote: "",
      accessibility: event.accessibility || "",
    },
    booking: {
      pricingMode: event.pricingMode === "single" || packages.length <= 1 ? "single" : "multiple",
      defaultPackageId: packages[0]?.id,
      cancellation: event.cancellation?.[0] ?? "",
      packages,
    },
    location,
    host: {
      name: event.host,
      role: event.hostRole || "",
      bio: event.hostBio || "",
      avatar: event.hostImage,
      recommendation: event.hostRecommendation,
    },
    plan: {
      heading: "",
      intro: "",
      steps: (event.plan ?? []).map((p, index) => ({
        id: `plan-${index}`,
        title: p.title,
        time: p.duration,
        description: p.description,
        image: p.image,
      })),
    },
    schedule: {
      heading: "",
      intro: "",
      sessions,
    },
    faq: {
      heading: "",
      items: (event.faqs ?? []).map((f, index) => ({
        id: `faq-${index}`,
        question: f.question,
        answer: f.answer,
      })),
    },
    reviews: {
      heading: event.reviewCount > 0 ? `${event.rating} from ${event.reviewCount} reviews` : "Community reviews",
      rating: event.rating,
      reviewCount: event.reviewCount,
      items: (event.reviews ?? []).map((r) => ({
        name: r.name,
        initials: r.name.slice(0, 2).toUpperCase(),
        rating: r.rating,
        date: r.attended,
        package: event.packages?.[0]?.name,
        text: r.body,
      })),
    },
    recommendations: recommendations ?? [],
  };
}
