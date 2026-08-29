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

export interface WorkshopData {
  slug: string;
  hero: WorkshopDataHero;
  overview: { heading: string; paragraphs: string[] };
  details: { learn: string[]; included: string[]; bring: string[] };
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
      includes: [...event.included],
    });
  }

  const sessions: WorkshopDataSession[] = event.sessions.map((s, index) => ({
    id: s.id || `session-${index}`,
    start: s.times?.[0]?.split(" - ")[0]?.trim() || "09:00",
    end: s.times?.[0]?.split(" - ")[1]?.trim() || s.times?.[0] || "18:00",
    label: `${s.date}${s.times?.[0] ? ` · ${s.times[0]}` : ""}`,
    minParticipants: 1,
    maxParticipants: event.capacity || 1,
    capacity: event.capacity || 1,
    bookedParticipants: event.attending || 0,
    days: [],
  }));

  const location = {
    name: event.studioName || event.location || "Tutoria venue",
    area: asDateLabel(event.location) === event.location ? "" : event.location,
    note: event.accessibility || "Exact arrival instructions are provided after booking.",
    mapQuery: event.address || event.location || event.studioName || "",
  };

  const coverImage = event.image || event.galleryImage || undefined;

  return {
    slug: event.slug,
    hero: {
      title: event.title,
      subtitle: event.subtitle,
      duration: event.duration,
      coverImage,
      photos: [event.image, event.galleryImage, ...event.plan.map((p) => p.image)].filter(
        (x): x is string => Boolean(x),
      ),
    },
    overview: {
      heading: event.subtitle || event.title,
      paragraphs: event.about.length ? event.about : [event.note].filter(Boolean),
    },
    details: {
      learn: event.learn,
      included: event.included,
      bring: event.bring,
    },
    booking: {
      pricingMode: event.pricingMode === "single" || packages.length <= 1 ? "single" : "multiple",
      defaultPackageId: packages[0]?.id,
      cancellation: event.cancellation?.[0] ?? "Free cancellation up to 24 hours before the start.",
      packages,
    },
    location,
    host: {
      name: event.host,
      role: event.hostRole || "Workshop host",
      bio: event.hostBio || "",
      avatar: event.hostImage,
      recommendation: event.hostRecommendation,
    },
    plan: {
      heading: "How the session flows",
      intro: "A guided, hands-on sequence from welcome to wrap-up.",
      steps: event.plan.map((p, index) => ({
        id: `plan-${index}`,
        title: p.title,
        time: p.duration,
        description: p.description,
        image: p.image,
      })),
    },
    schedule: {
      heading: "Pick a session",
      intro: "Choose a date and time that works for you.",
      sessions,
    },
    faq: {
      heading: "Practical details before you book.",
      items: event.faqs.map((f, index) => ({
        id: `faq-${index}`,
        question: f.question,
        answer: f.answer,
      })),
    },
    reviews: {
      heading: event.reviewCount > 0 ? `${event.rating} from ${event.reviewCount} reviews` : "Community reviews",
      rating: event.rating,
      reviewCount: event.reviewCount,
      items: event.reviews.map((r) => ({
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
