export interface EventListing {
  slug: string;
  title: string;
  host: string;
  date: string;
  time: string;
  location: string;
  type: "In person" | "Online";
  price: string;
  attending: number;
  capacity: number;
  image: string;
  topic: string;
  level: string;
}

export interface EventSession {
  id: string;
  date: string;
  times: string[];
}

export interface EventPlanItem {
  title: string;
  duration: string;
  description: string;
}

export interface EventReview {
  name: string;
  attended: string;
  rating: number;
  body: string;
  avatar: string;
}

export interface EventFaq {
  question: string;
  answer: string;
}

export interface EventDetail extends EventListing {
  subtitle: string;
  rating: number;
  reviewCount: number;
  duration: string;
  languages: string[];
  minimumAge: string;
  accessibility: string;
  studioName: string;
  address: string;
  sessions: EventSession[];
  spotsLeft: number;
  about: string[];
  note: string;
  highlights: { title: string; description: string }[];
  learn: string[];
  included: string[];
  bring: string[];
  plan: EventPlanItem[];
  faqs: EventFaq[];
  galleryImage: string;
  hostRole: string;
  hostExperience: string;
  hostBio: string;
  hostImage: string;
  hostRecommendation: string;
  beforeYouAttend: { title: string; items: string[] }[];
  cancellation: string[];
  reviews: EventReview[];
}

export const PUBLISHED_EVENTS_KEY = "tutoria-published-events";
export const PUBLISHED_EVENTS_EVENT = "tutoria-published-events-change";

export function readPublishedEvents(): EventDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PUBLISHED_EVENTS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePublishedEvent(event: EventDetail) {
  const events = readPublishedEvents();
  const next = [event, ...events.filter((item) => item.slug !== event.slug)];
  window.localStorage.setItem(PUBLISHED_EVENTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PUBLISHED_EVENTS_EVENT));
}

export const allEvents: EventListing[] = [
  {
    slug: "beginner-pottery-workshop",
    title: "Beginner Pottery Workshop",
    host: "Thu Ha",
    date: "Sunday, 19 Jul",
    time: "2:00 PM",
    location: "Tay Ho, Ha Noi",
    type: "In person",
    price: "350,000 đ",
    attending: 12,
    capacity: 20,
    image: "/images/pottery-workshop-hero-optimized.jpg",
    topic: "Creative arts",
    level: "Beginner",
  },
  {
    slug: "ielts-speaking-practice-group",
    title: "IELTS Speaking Practice Group",
    host: "Linh Nguyen",
    date: "Saturday, 18 Jul",
    time: "10:00 AM",
    location: "Online",
    type: "Online",
    price: "Free",
    attending: 8,
    capacity: 15,
    image: "https://picsum.photos/seed/ev-ielts/1200/800",
    topic: "Languages",
    level: "Intermediate",
  },
  {
    slug: "startup-networking-night",
    title: "Startup Networking Night",
    host: "Bao Long",
    date: "Friday, 24 Jul",
    time: "6:30 PM",
    location: "Hoan Kiem, Ha Noi",
    type: "In person",
    price: "Free",
    attending: 45,
    capacity: 60,
    image: "https://picsum.photos/seed/ev-startup/1200/800",
    topic: "Business",
    level: "All levels",
  },
  {
    slug: "watercolor-painting-session",
    title: "Watercolor Painting Session",
    host: "Duc Pham",
    date: "Tuesday, 21 Jul",
    time: "3:00 PM",
    location: "Online",
    type: "Online",
    price: "200,000 đ",
    attending: 20,
    capacity: 25,
    image: "https://picsum.photos/seed/ev-watercolor/1200/800",
    topic: "Creative arts",
    level: "Beginner",
  },
  {
    slug: "photography-walk-old-quarter",
    title: "Photography Walk: Old Quarter",
    host: "Duc Pham",
    date: "Sunday, 26 Jul",
    time: "7:00 AM",
    location: "Hoan Kiem, Ha Noi",
    type: "In person",
    price: "Free",
    attending: 15,
    capacity: 15,
    image: "https://picsum.photos/seed/ev-photowalk/1200/800",
    topic: "Photography",
    level: "All levels",
  },
  {
    slug: "yoga-in-the-park",
    title: "Yoga in the Park",
    host: "Ngoc Tram",
    date: "Saturday, 25 Jul",
    time: "6:30 AM",
    location: "Tay Ho, Ha Noi",
    type: "In person",
    price: "Free",
    attending: 28,
    capacity: 30,
    image: "https://picsum.photos/seed/ev-yoga/1200/800",
    topic: "Wellness",
    level: "Beginner",
  },
  {
    slug: "pho-masterclass",
    title: "Cooking Class: Pho Masterclass",
    host: "Thu Ha",
    date: "Wednesday, 22 Jul",
    time: "5:00 PM",
    location: "Online",
    type: "Online",
    price: "400,000 đ",
    attending: 10,
    capacity: 12,
    image: "https://picsum.photos/seed/ev-pho/1200/800",
    topic: "Cooking",
    level: "Intermediate",
  },
  {
    slug: "public-speaking-workshop",
    title: "Public Speaking Workshop",
    host: "Minh Anh",
    date: "Thursday, 23 Jul",
    time: "7:00 PM",
    location: "Online",
    type: "Online",
    price: "Free",
    attending: 35,
    capacity: 50,
    image: "https://picsum.photos/seed/ev-speaking/1200/800",
    topic: "Personal development",
    level: "All levels",
  },
];

const potteryDetail: Omit<EventDetail, keyof EventListing> = {
  subtitle: "Make and glaze your first ceramic cup in one relaxed afternoon.",
  rating: 4.9,
  reviewCount: 128,
  duration: "3.5 hours",
  languages: ["Vietnamese", "English", "Mandarin"],
  minimumAge: "12+",
  accessibility: "Wheelchair accessible",
  studioName: "ClaySpace Studio",
  address: "123 Ceramic Road, Tay Ho, Ha Noi",
  sessions: [
    { id: "sun-19-jul", date: "Sun, 19 Jul 2026", times: ["09:00 - 12:30", "14:00 - 17:30"] },
    { id: "sat-25-jul", date: "Sat, 25 Jul 2026", times: ["09:00 - 12:30", "14:00 - 17:30"] },
    { id: "sun-02-aug", date: "Sun, 02 Aug 2026", times: ["10:00 - 13:30"] },
  ],
  spotsLeft: 8,
  about: [
    "Join a small group in a working pottery studio and learn the foundations of hand-building, wheel shaping, and glazing.",
    "You will shape one ceramic cup, decorate it, and select a glaze. The studio will fire it after the workshop for later collection.",
  ],
  note: "No previous pottery experience is required.",
  highlights: [
    { title: "All materials included", description: "Clay, tools, glaze, and firing are covered." },
    { title: "Take home your creation", description: "Collect your finished cup after firing." },
    { title: "Small group experience", description: "Personal guidance with no more than 16 learners." },
    { title: "Beginner friendly", description: "Clear demonstrations and patient support throughout." },
  ],
  learn: [
    "Understand basic hand-building techniques",
    "Shape a functional ceramic cup",
    "Decorate and glaze your work",
    "Understand the firing and collection process",
  ],
  included: ["Clay and pottery tools", "Glazes and firing", "Apron", "Tea, coffee, and water", "Protective packaging"],
  bring: ["Comfortable clothes that may get dirty", "Closed-toe shoes", "A hair tie if needed"],
  plan: [
    { title: "Welcome and introduction", duration: "15 min", description: "Meet your host and the other participants, review the materials, and cover studio safety." },
    { title: "Pottery demonstration", duration: "20 min", description: "Watch a live demonstration of the techniques you will use during the session." },
    { title: "Guided hand-building", duration: "60 min", description: "Create your cup with individual guidance and support from your host." },
    { title: "Decoration and glazing", duration: "40 min", description: "Refine your piece, choose a glaze, and prepare your work for firing." },
  ],
  faqs: [
    { question: "Do I need pottery experience?", answer: "No. This workshop is designed for beginners, and the host demonstrates every technique before you try it." },
    { question: "When can I collect my finished cup?", answer: "The studio will fire and finish your piece after the workshop. Collection details are normally shared within two to three weeks." },
    { question: "Can I bring a friend who has not booked?", answer: "Only registered participants can enter the working studio area. Ask your friend to reserve a place before the session." },
    { question: "What should I wear?", answer: "Wear comfortable clothes that may get dirty and closed-toe shoes. Aprons are provided by the studio." },
    { question: "Can the workshop support accessibility needs?", answer: "The studio has step-free access and an accessible restroom. Share any additional requirements during booking so the host can prepare." },
  ],
  galleryImage: "/images/pottery-workshop-class-optimized.jpg",
  hostRole: "Ceramic artist and educator",
  hostExperience: "8+ years of experience",
  hostBio: "Thu Ha makes functional ceramics and has taught welcoming beginner workshops in Ha Noi since 2018.",
  hostImage: "/images/tutor-profile-thu-ha.png",
  hostRecommendation: "98% recommend",
  beforeYouAttend: [
    { title: "Minimum age", items: ["Participants must be at least 12 years old.", "Learners aged 12-15 must attend with an adult."] },
    { title: "Accessibility", items: ["Step-free entrance", "Wheelchair-accessible workspace", "Accessible restroom"] },
    { title: "Safety", items: ["Participants do not operate the kiln.", "Share relevant allergies or accessibility needs during booking."] },
  ],
  cancellation: [
    "Cancel at least 24 hours before the session for a full refund.",
    "If the host cancels, move your booking to another available session or receive a full refund.",
  ],
  reviews: [
    { name: "Linh Nguyen", attended: "Attended 19 Jul", rating: 5, body: "The instructions were clear and the studio felt calm. I was surprised by how much I could make as a complete beginner.", avatar: "https://picsum.photos/seed/reviewer-linh/96/96" },
    { name: "Minh Tran", attended: "Attended 12 Jul", rating: 5, body: "Thu Ha was patient and gave each person useful feedback. The small group made it easy to ask questions.", avatar: "https://picsum.photos/seed/reviewer-minh/96/96" },
    { name: "Huong Pham", attended: "Attended 05 Jul", rating: 5, body: "I love my cup and cannot wait to collect it after firing. The afternoon was thoughtful and well paced.", avatar: "https://picsum.photos/seed/reviewer-huong/96/96" },
  ],
};

function createDefaultDetail(event: EventListing): EventDetail {
  const remaining = Math.max(event.capacity - event.attending, 0);
  const isOnline = event.type === "Online";

  return {
    ...event,
    subtitle: `A welcoming ${event.level.toLowerCase()} session led by ${event.host}.`,
    rating: 4.8,
    reviewCount: 42,
    duration: "2 hours",
    languages: ["Vietnamese", "English"],
    minimumAge: "16+",
    accessibility: isOnline ? "Join from any device" : "Accessibility details available",
    studioName: isOnline ? "Live online room" : "Tutoria partner venue",
    address: isOnline ? "Joining link shared after booking" : event.location,
    sessions: [
      { id: `${event.slug}-primary`, date: `${event.date} 2026`, times: [event.time] },
      { id: `${event.slug}-next`, date: "Following week", times: [event.time] },
    ],
    spotsLeft: remaining,
    about: [
      `Learn alongside a small group in this practical ${event.topic.toLowerCase()} experience.`,
      `${event.host} will guide the session with demonstrations, supported practice, and time for questions.`,
    ],
    note: `Suitable for ${event.level.toLowerCase()} learners.`,
    highlights: [
      { title: "Guided practice", description: "Follow a clear, supportive learning sequence." },
      { title: "Small group", description: "Get useful feedback during the session." },
      { title: "Materials provided", description: isOnline ? "A preparation list is sent in advance." : "Essential session materials are included." },
      { title: "Practical outcome", description: "Leave with a result you can build on." },
    ],
    learn: ["Understand the core ideas", "Practice with clear guidance", "Get feedback from your host", "Know what to work on next"],
    included: ["Live instruction", "Session resources", "Practice activities", "Follow-up notes"],
    bring: isOnline ? ["A laptop or tablet", "A stable internet connection", "A quiet place to participate"] : ["Comfortable clothing", "A notebook", "Water"],
    plan: [
      { title: "Welcome and orientation", duration: "15 min", description: "Meet the group, set expectations, and prepare for the session." },
      { title: "Live demonstration", duration: "30 min", description: "See the core approach in action and ask focused questions." },
      { title: "Guided practice", duration: "55 min", description: "Work through the activity with feedback from your host." },
      { title: "Review and next steps", duration: "20 min", description: "Share outcomes, clarify questions, and plan your next practice." },
    ],
    faqs: [
      { question: "Do I need previous experience?", answer: `No special experience is required beyond the listed ${event.level.toLowerCase()} level. The host explains each activity before guided practice begins.` },
      { question: "What happens after I book?", answer: "You will receive a confirmation with the session time, preparation details, and venue or joining instructions." },
      { question: "Can I change to another session?", answer: "Contact the host before the cancellation deadline to ask about moving your booking to an available session." },
      { question: "What should I bring?", answer: `Use the preparation list above. Any extra materials needed for ${event.title} will be included in your confirmation email.` },
      { question: "Can I ask the host about accessibility?", answer: "Yes. Share access requirements during booking or message the host before the event so suitable arrangements can be confirmed." },
    ],
    galleryImage: event.image,
    hostRole: `${event.topic} host and tutor`,
    hostExperience: "Experienced community educator",
    hostBio: `${event.host} creates practical learning experiences that help people build confidence through shared practice.`,
    hostImage: `https://picsum.photos/seed/host-${event.slug}/240/240`,
    hostRecommendation: "96% recommend",
    beforeYouAttend: [
      { title: "Preparation", items: ["Check your booking email before the session.", "Arrive or join 10 minutes early."] },
      { title: "Accessibility", items: [isOnline ? "Join from a laptop, tablet, or phone." : "Contact the host with access requirements."] },
      { title: "Participation", items: ["Respect the learning pace of the group.", "Share any relevant needs during booking."] },
    ],
    cancellation: ["Cancel at least 24 hours before the session for a full refund.", "If the host cancels, choose another session or receive a full refund."],
    reviews: [
      { name: "Mai Le", attended: "Attended this month", rating: 5, body: "A friendly, well-organized session with practical guidance I could use straight away.", avatar: "https://picsum.photos/seed/reviewer-mai/96/96" },
      { name: "Quang Vu", attended: "Attended last month", rating: 5, body: "The group size was comfortable and the host made time for every question.", avatar: "https://picsum.photos/seed/reviewer-quang/96/96" },
      { name: "Nhi Dao", attended: "Attended last month", rating: 4, body: "Clear pacing, useful feedback, and a relaxed atmosphere from start to finish.", avatar: "https://picsum.photos/seed/reviewer-nhi/96/96" },
    ],
  };
}

export function getEventBySlug(slug: string): EventDetail | undefined {
  const event = allEvents.find((item) => item.slug === slug);
  if (!event) return undefined;
  if (event.slug === "beginner-pottery-workshop") return { ...event, ...potteryDetail };
  return createDefaultDetail(event);
}

export function getSimilarEvents(slug: string, limit = 3): EventListing[] {
  return allEvents.filter((event) => event.slug !== slug).slice(0, limit);
}
