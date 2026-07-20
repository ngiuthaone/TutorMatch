export interface CourseListing {
  slug: string;
  title: string;
  instructor: string;
  category: string;
  lessons: number;
  duration: string;
  rating: number;
  students: number;
  level: string;
  price: string;
  image: string;
}

export interface CourseSection {
  title: string;
  duration: string;
  lessons: string[];
}

export interface CourseReview {
  name: string;
  rating: number;
  date: string;
  body: string;
  avatar: string;
}

export interface CourseFaq {
  question: string;
  answer: string;
}

export interface CourseDetail extends CourseListing {
  subtitle: string;
  reviewCount: number;
  updated: string;
  language: string;
  certificate: boolean;
  description: string[];
  outcomes: string[];
  requirements: string[];
  faqs: CourseFaq[];
  curriculum: CourseSection[];
  instructorRole: string;
  instructorBio: string;
  instructorImage: string;
  reviews: CourseReview[];
}

export const PUBLISHED_COURSES_KEY = "tutoria-published-courses";
export const PUBLISHED_COURSES_EVENT = "tutoria-published-courses-change";

export function readPublishedCourses(): CourseDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PUBLISHED_COURSES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function savePublishedCourse(course: CourseDetail) {
  const courses = readPublishedCourses();
  const next = [course, ...courses.filter((item) => item.slug !== course.slug)];
  window.localStorage.setItem(PUBLISHED_COURSES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PUBLISHED_COURSES_EVENT));
}

export const allCourses: CourseListing[] = [
  { slug: "complete-web-development-bootcamp-2026", title: "Complete Web Development Bootcamp 2026", instructor: "Huy Tran", category: "Technology", lessons: 48, duration: "16h", rating: 4.8, students: 1200, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/web-cat/1200/800" },
  { slug: "ielts-speaking-masterclass", title: "IELTS Speaking Masterclass", instructor: "Linh Nguyen", category: "Languages", lessons: 24, duration: "8h", rating: 4.9, students: 890, level: "Intermediate", price: "499,000 đ", image: "https://picsum.photos/seed/ielts-cat/1200/800" },
  { slug: "public-speaking-for-professionals", title: "Public Speaking for Professionals", instructor: "Minh Anh", category: "Personal development", lessons: 16, duration: "6h", rating: 4.7, students: 650, level: "All levels", price: "350,000 đ", image: "https://picsum.photos/seed/speaking-cat/1200/800" },
  { slug: "digital-photography-fundamentals", title: "Digital Photography Fundamentals", instructor: "Duc Pham", category: "Creative", lessons: 32, duration: "12h", rating: 4.8, students: 720, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/photo-cat/1200/800" },
  { slug: "vietnamese-home-cooking", title: "Vietnamese Home Cooking", instructor: "Thu Ha", category: "Lifestyle", lessons: 20, duration: "10h", rating: 4.9, students: 2100, level: "Beginner", price: "299,000 đ", image: "https://picsum.photos/seed/cooking-cat/1200/800" },
  { slug: "startup-fundamentals", title: "Startup Fundamentals", instructor: "Bao Long", category: "Business", lessons: 12, duration: "5h", rating: 4.6, students: 430, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/startup-cat/1200/800" },
  { slug: "advanced-react-and-nextjs", title: "Advanced React & Next.js", instructor: "Huy Tran", category: "Technology", lessons: 36, duration: "14h", rating: 4.8, students: 560, level: "Advanced", price: "599,000 đ", image: "https://picsum.photos/seed/react-cat/1200/800" },
  { slug: "english-for-beginners", title: "English for Beginners", instructor: "Linh Nguyen", category: "Languages", lessons: 30, duration: "20h", rating: 4.8, students: 3400, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/english-cat/1200/800" },
  { slug: "music-production-with-ableton", title: "Music Production with Ableton", instructor: "Quoc Anh", category: "Creative", lessons: 28, duration: "18h", rating: 4.6, students: 320, level: "Intermediate", price: "750,000 đ", image: "https://picsum.photos/seed/music-cat/1200/800" },
  { slug: "yoga-for-beginners", title: "Yoga for Beginners", instructor: "Ngoc Tram", category: "Sports", lessons: 40, duration: "15h", rating: 4.8, students: 980, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/yoga-cat/1200/800" },
  { slug: "makeup-and-nail-art", title: "Makeup & Nail Art", instructor: "Phuong Anh", category: "Beauty", lessons: 18, duration: "7h", rating: 4.5, students: 410, level: "Beginner", price: "249,000 đ", image: "https://picsum.photos/seed/beauty-cat/1200/800" },
  { slug: "ielts-writing-workshop", title: "IELTS Writing Workshop", instructor: "Linh Nguyen", category: "Academic", lessons: 12, duration: "6h", rating: 4.7, students: 1100, level: "Intermediate", price: "399,000 đ", image: "https://picsum.photos/seed/writing-cat/1200/800" },
];

const webBootcamp: Omit<CourseDetail, keyof CourseListing> = {
  subtitle: "Build responsive websites and full-stack applications through practical projects, with no previous coding experience required.",
  reviewCount: 286,
  updated: "July 2026",
  language: "English with Vietnamese captions",
  certificate: true,
  description: [
    "Learn the foundations of modern web development through short explanations, guided exercises, and projects that grow with your skills.",
    "You will move from semantic HTML and responsive CSS to JavaScript, React, Next.js, APIs, and deployment. Each module ends with a practical checkpoint.",
  ],
  outcomes: [
    "Build accessible, responsive websites from scratch",
    "Write modern JavaScript with confidence",
    "Create reusable interfaces with React",
    "Build full-stack applications with Next.js",
    "Work with APIs, forms, and persistent data",
    "Deploy and present a polished portfolio project",
  ],
  requirements: [
    "A laptop capable of running a modern browser",
    "A stable internet connection",
    "No previous programming experience required",
  ],
  faqs: [
    { question: "Do I need previous coding experience?", answer: "No. The course begins with web fundamentals and explains each concept before you use it in a project." },
    { question: "How long will I have access to the course?", answer: "You receive lifetime access, including future lesson updates and downloadable course resources." },
    { question: "Can I learn on a phone or tablet?", answer: "You can watch lessons on mobile devices, but a laptop or desktop computer is recommended for coding exercises and projects." },
    { question: "Will I receive a certificate?", answer: "Yes. Complete every module and the final project to receive a certificate of completion for your Tutoria profile." },
    { question: "What happens if I get stuck?", answer: "You can revisit lessons, use the guided project checkpoints, and ask questions in the course discussion area." },
  ],
  curriculum: [
    { title: "Web foundations", duration: "2h 20m", lessons: ["How the web works", "Semantic HTML", "Accessible forms", "Project: personal profile"] },
    { title: "Responsive CSS", duration: "3h 10m", lessons: ["The cascade and layout", "Flexbox and Grid", "Responsive type and media", "Project: editorial landing page"] },
    { title: "JavaScript essentials", duration: "4h 05m", lessons: ["Values, functions, and state", "Working with the DOM", "Async data and APIs", "Project: interactive planner"] },
    { title: "React and Next.js", duration: "4h 15m", lessons: ["Components and props", "Client and server rendering", "Routing and data", "Project: learning marketplace"] },
    { title: "Ship your final project", duration: "2h 10m", lessons: ["Testing the core journey", "Performance basics", "Deployment", "Portfolio presentation"] },
  ],
  instructorRole: "Full-stack developer and educator",
  instructorBio: "Huy Tran has spent nine years building web products and teaching new developers. His lessons focus on clear mental models and practical repetition.",
  instructorImage: "https://picsum.photos/seed/instructor-huy-tran/320/320",
  reviews: [
    { name: "Mai Pham", rating: 5, date: "July 2026", body: "The projects made each new concept feel concrete. I finally understand how the pieces of a web app connect.", avatar: "https://picsum.photos/seed/course-review-mai/96/96" },
    { name: "Nam Le", rating: 5, date: "June 2026", body: "Clear explanations, sensible pacing, and enough practice to build confidence without feeling overwhelmed.", avatar: "https://picsum.photos/seed/course-review-nam/96/96" },
    { name: "An Nguyen", rating: 4, date: "June 2026", body: "A strong starting point with useful projects. The deployment module was especially helpful.", avatar: "https://picsum.photos/seed/course-review-an/96/96" },
  ],
};

function createDefaultDetail(course: CourseListing): CourseDetail {
  return {
    ...course,
    subtitle: `A practical ${course.level.toLowerCase()} course taught by ${course.instructor}. Learn at your own pace through focused lessons and guided practice.`,
    reviewCount: Math.max(48, Math.round(course.students * 0.16)),
    updated: "July 2026",
    language: "Vietnamese and English",
    certificate: true,
    description: [
      `Develop useful ${course.category.toLowerCase()} skills through a clear sequence of demonstrations, activities, and review checkpoints.`,
      `${course.instructor} guides each topic with practical examples so you can apply what you learn beyond the course.`,
    ],
    outcomes: ["Understand the core concepts", "Practice through guided activities", "Apply the skills to a finished project", "Identify useful next steps"],
    requirements: ["A laptop, tablet, or phone", "A stable internet connection", `Suitable for ${course.level.toLowerCase()} learners`],
    faqs: [
      { question: "How long will I have access?", answer: "You receive lifetime access to every lesson and can return whenever you want to refresh your skills." },
      { question: "Can I study at my own pace?", answer: `Yes. ${course.title} is self-paced, so you can pause between lessons and continue when your schedule allows.` },
      { question: "Do I need previous experience?", answer: `This course is designed for ${course.level.toLowerCase()} learners. Review the requirements above to make sure it matches your starting point.` },
      { question: "Will I receive a certificate?", answer: "Yes. A certificate of completion is available after you finish all lessons and course activities." },
      { question: "Which devices can I use?", answer: "Lessons work on mobile, tablet, and desktop. A larger screen may be more comfortable for exercises and projects." },
    ],
    curriculum: [
      { title: "Start with the essentials", duration: "1h 30m", lessons: ["Course orientation", "Core concepts", "Guided example"] },
      { title: "Build practical skills", duration: "2h 15m", lessons: ["Focused practice", "Common challenges", "Knowledge check"] },
      { title: "Apply what you learned", duration: "2h", lessons: ["Project brief", "Step-by-step build", "Review and refine"] },
      { title: "Continue your progress", duration: "45m", lessons: ["Final review", "Resources", "Next steps"] },
    ],
    instructorRole: `${course.category} tutor and course creator`,
    instructorBio: `${course.instructor} creates structured, practical learning experiences that help learners build skill through focused practice.`,
    instructorImage: `https://picsum.photos/seed/instructor-${course.slug}/320/320`,
    reviews: [
      { name: "Thao Vu", rating: 5, date: "July 2026", body: "The course was easy to follow and gave me useful ways to practice after every lesson.", avatar: "https://picsum.photos/seed/course-review-thao/96/96" },
      { name: "Khanh Do", rating: 5, date: "June 2026", body: "Well organized, clearly explained, and practical from the first module to the last.", avatar: "https://picsum.photos/seed/course-review-khanh/96/96" },
      { name: "Vy Ho", rating: 4, date: "June 2026", body: "A thoughtful introduction with a good balance of explanation and hands-on work.", avatar: "https://picsum.photos/seed/course-review-vy/96/96" },
    ],
  };
}

export function getCourseBySlug(slug: string): CourseDetail | undefined {
  const course = allCourses.find((item) => item.slug === slug);
  if (!course) return undefined;
  if (course.slug === "complete-web-development-bootcamp-2026") return { ...course, ...webBootcamp };
  return createDefaultDetail(course);
}

export function getSimilarCourses(slug: string, limit = 3): CourseListing[] {
  const current = allCourses.find((course) => course.slug === slug);
  return allCourses
    .filter((course) => course.slug !== slug)
    .sort((a, b) => Number(b.category === current?.category) - Number(a.category === current?.category))
    .slice(0, limit);
}
