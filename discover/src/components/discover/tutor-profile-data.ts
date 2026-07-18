export interface TutorReview {
  name: string;
  date: string;
  text: string;
}

export interface TutorProfile {
  name: string;
  role: string;
  tagline: string;
  image: string;
  rating: number;
  reviewCount: number;
  lessons: number;
  responseTime: string;
  location: string;
  price: number;
  languages: string[];
  subjects: string[];
  about: string[];
  learnerLevels: string[];
  ageGroups: string[];
  teachingStyles: string[];
  outcomes: string[];
  typicalLesson: string;
  reviews: TutorReview[];
}

const sharedReviews: TutorReview[] = [
  {
    name: "Mai Phuong",
    date: "Apr 28, 2026",
    text: "Patient, clear, and encouraging. I left the first lesson with a plan I could use right away.",
  },
  {
    name: "Huyen Trang",
    date: "Apr 12, 2026",
    text: "The feedback is specific and practical. Every session feels focused on what I need most.",
  },
  {
    name: "Jason L.",
    date: "Mar 31, 2026",
    text: "Great structure and thoughtful pacing. I can see my progress from one week to the next.",
  },
  {
    name: "Thanh Vy",
    date: "Mar 18, 2026",
    text: "The lesson activities are useful, and the follow-up notes make it easy to keep practicing.",
  },
];

export const tutorProfiles: TutorProfile[] = [
  {
    name: "Minh Anh",
    role: "Public Speaking Coach",
    tagline: "Build a clear voice, calm delivery, and the confidence to speak when it matters.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85",
    rating: 4.9,
    reviewCount: 124,
    lessons: 386,
    responseTime: "about 1 hour",
    location: "Cau Giay, Ha Noi",
    price: 250000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["Public speaking", "Presentation skills", "Communication"],
    about: [
      "I coach students and working professionals who want to speak with more clarity and confidence.",
      "Lessons combine practical drills, supportive feedback, and real speaking scenarios, from classroom presentations to high-stakes meetings.",
    ],
    learnerLevels: ["Complete beginners", "Developing speakers", "Experienced presenters"],
    ageGroups: ["Teenagers", "University students", "Adults", "Professionals"],
    teachingStyles: ["Guided demonstration", "Practice exercises", "Personalized feedback", "Recorded review"],
    outcomes: ["Structure a persuasive talk", "Manage nerves before speaking", "Use voice and body language well", "Handle questions with confidence"],
    typicalLesson: "We begin with a short speaking prompt, choose one skill to improve, then practice it through guided exercises. You finish with direct feedback and a simple plan for the week.",
    reviews: sharedReviews,
  },
  {
    name: "Huy Tran",
    role: "Full-stack Developer",
    tagline: "Learn modern web development by building useful products from interface to deployment.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85",
    rating: 4.8,
    reviewCount: 89,
    lessons: 274,
    responseTime: "under 2 hours",
    location: "Ba Dinh, Ha Noi",
    price: 350000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["JavaScript", "React", "Node.js", "Python"],
    about: [
      "I have spent eight years building web products for startups and helping new developers turn scattered tutorials into practical skills.",
      "You will learn by making real features, reading code carefully, and understanding the choices behind a maintainable application.",
    ],
    learnerLevels: ["First-time coders", "Junior developers", "Career switchers"],
    ageGroups: ["Teenagers", "University students", "Adults", "Professionals"],
    teachingStyles: ["Live coding", "Project-based learning", "Code review", "Debugging practice"],
    outcomes: ["Build a complete web feature", "Debug code systematically", "Understand frontend and backend flow", "Prepare a portfolio project"],
    typicalLesson: "We review your current code, select one focused objective, and build it together. I explain the tradeoffs as we work, then leave you with a small challenge and review notes.",
    reviews: sharedReviews,
  },
  {
    name: "Linh Nguyen",
    role: "English & IELTS Coach",
    tagline: "Improve your English with precise feedback, useful strategies, and confident daily practice.",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85",
    rating: 4.9,
    reviewCount: 156,
    lessons: 512,
    responseTime: "about 1 hour",
    location: "Dong Da, Ha Noi",
    price: 200000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["IELTS", "English", "TOEFL", "Academic writing"],
    about: [
      "I help learners strengthen the English they need for study, work, and international exams.",
      "My lessons turn broad goals into small, measurable improvements in speaking, writing, listening, and reading.",
    ],
    learnerLevels: ["A2 learners", "Intermediate learners", "Advanced learners"],
    ageGroups: ["Teenagers", "University students", "Adults", "Professionals"],
    teachingStyles: ["Exam strategy", "Speaking practice", "Writing feedback", "Weekly study plan"],
    outcomes: ["Answer speaking prompts clearly", "Write stronger task responses", "Recognize common exam patterns", "Build a consistent study routine"],
    typicalLesson: "We check your current goal, work through one exam or communication skill, and apply it under realistic timing. You receive corrections, model answers, and a focused practice task.",
    reviews: sharedReviews,
  },
  {
    name: "Duc Pham",
    role: "Photography Artist",
    tagline: "Develop your visual eye and make stronger photographs with intentional light and composition.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=85",
    rating: 4.7,
    reviewCount: 67,
    lessons: 198,
    responseTime: "under 3 hours",
    location: "Tay Ho, Ha Noi",
    price: 400000,
    languages: ["Vietnamese (Native)", "English (Conversational)"],
    subjects: ["Photography", "Lightroom", "Photoshop", "Composition"],
    about: [
      "I am a commercial photographer and exhibition curator with a practical approach to image-making.",
      "We study light, framing, editing, and sequencing so your photographs feel deliberate and recognizably yours.",
    ],
    learnerLevels: ["Complete beginners", "Developing photographers", "Portfolio builders"],
    ageGroups: ["Teenagers", "University students", "Adults", "Professionals"],
    teachingStyles: ["Photo critique", "Live demonstration", "Location practice", "Portfolio feedback"],
    outcomes: ["Control exposure and focus", "Compose with clearer intent", "Edit a consistent photo series", "Prepare a concise portfolio"],
    typicalLesson: "We review a small set of your photographs, identify one visual pattern to improve, and test it with a practical exercise. You leave with edits, references, and a new shooting brief.",
    reviews: sharedReviews,
  },
  {
    name: "Thu Ha",
    role: "Cooking Instructor",
    tagline: "Cook Vietnamese and French-inspired dishes with reliable technique and calm kitchen habits.",
    image: "/images/tutor-profile-thu-ha.png",
    rating: 4.9,
    reviewCount: 203,
    lessons: 648,
    responseTime: "about 1 hour",
    location: "Hoan Kiem, Ha Noi",
    price: 300000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["Vietnamese cuisine", "Baking", "French culinary"],
    about: [
      "I teach home cooks how to understand ingredients, timing, and technique instead of relying only on recipes.",
      "Classes are hands-on, friendly, and adapted to your kitchen, whether you are learning one family dish or building broader confidence.",
    ],
    learnerLevels: ["First-time cooks", "Confident home cooks", "Aspiring professionals"],
    ageGroups: ["Children with a guardian", "Teenagers", "Adults", "Families"],
    teachingStyles: ["Guided demonstration", "Hands-on practice", "Recipe adaptation", "Ingredient coaching"],
    outcomes: ["Prepare ingredients efficiently", "Balance flavor with confidence", "Use core cooking techniques", "Adapt recipes to your kitchen"],
    typicalLesson: "We prepare the workspace, review the recipe and key techniques, then cook together step by step. I help with timing and tasting, and you receive notes for repeating the dish.",
    reviews: sharedReviews,
  },
  {
    name: "Quoc Anh",
    role: "Music Producer",
    tagline: "Turn musical ideas into finished tracks through arrangement, sound design, and focused listening.",
    image: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=900&q=85",
    rating: 4.6,
    reviewCount: 45,
    lessons: 146,
    responseTime: "within 4 hours",
    location: "Cau Giay, Ha Noi",
    price: 500000,
    languages: ["Vietnamese (Native)", "English (Conversational)"],
    subjects: ["Music production", "Ableton", "Sound design", "Mixing"],
    about: [
      "I work with emerging artists and producers who want to move from unfinished loops to complete, expressive tracks.",
      "Sessions focus on your music, your tools, and the listening decisions that make an arrangement feel clear and intentional.",
    ],
    learnerLevels: ["New producers", "Developing artists", "Release-ready musicians"],
    ageGroups: ["Teenagers", "University students", "Adults", "Working artists"],
    teachingStyles: ["Project review", "Live production", "Critical listening", "Mix feedback"],
    outcomes: ["Finish a clear song arrangement", "Choose sounds with intention", "Create a balanced rough mix", "Develop a repeatable workflow"],
    typicalLesson: "We listen to your current project, agree on the most important improvement, and work directly in the session. You leave with an updated track and clear next production steps.",
    reviews: sharedReviews,
  },
  {
    name: "Ngoc Tram",
    role: "Yoga & Meditation Coach",
    tagline: "Build a steady movement and meditation practice that fits your body and daily rhythm.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=85",
    rating: 4.8,
    reviewCount: 112,
    lessons: 321,
    responseTime: "under 2 hours",
    location: "Ba Dinh, Ha Noi",
    price: 220000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["Yoga", "Meditation", "Mindfulness", "Breathwork"],
    about: [
      "I am an RYT-500 teacher with eight years of practice across movement, breathwork, and meditation.",
      "My sessions are grounded and adaptable. We work with your energy, mobility, and goals without forcing a one-size-fits-all routine.",
    ],
    learnerLevels: ["Complete beginners", "Returning practitioners", "Regular practitioners"],
    ageGroups: ["Teenagers", "University students", "Adults", "Older adults"],
    teachingStyles: ["Guided movement", "Breath practice", "Mindful pacing", "Home routine planning"],
    outcomes: ["Move with better awareness", "Use breath to settle attention", "Build a safe home practice", "Improve consistency without pressure"],
    typicalLesson: "We check in with how your body feels, practice a focused movement sequence, and close with breath or meditation. I offer options throughout and share a short routine for home.",
    reviews: sharedReviews,
  },
  {
    name: "Bao Long",
    role: "Business Strategy Mentor",
    tagline: "Clarify your business choices with practical frameworks, direct feedback, and founder experience.",
    image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=900&q=85",
    rating: 4.7,
    reviewCount: 78,
    lessons: 236,
    responseTime: "within 3 hours",
    location: "Tay Ho, Ha Noi",
    price: 450000,
    languages: ["Vietnamese (Native)", "English (Fluent)"],
    subjects: ["Startups", "Strategy", "Marketing", "Fundraising"],
    about: [
      "I have founded two companies and worked with early-stage teams on strategy, positioning, fundraising, and execution.",
      "Mentoring sessions turn complex business questions into clear decisions, concrete experiments, and accountable next steps.",
    ],
    learnerLevels: ["Aspiring founders", "Early-stage teams", "Growing operators"],
    ageGroups: ["University students", "Adults", "Founders", "Team leaders"],
    teachingStyles: ["Case discussion", "Decision frameworks", "Direct feedback", "Action planning"],
    outcomes: ["Define the next business priority", "Test assumptions efficiently", "Communicate a sharper position", "Prepare for investor conversations"],
    typicalLesson: "We define the decision in front of you, examine the evidence and constraints, and choose a practical next move. You leave with an action plan and a way to measure what happens.",
    reviews: sharedReviews,
  },
];

export function getTutorProfile(name?: string): TutorProfile {
  return tutorProfiles.find((profile) => profile.name === name) ?? tutorProfiles[0];
}

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}
