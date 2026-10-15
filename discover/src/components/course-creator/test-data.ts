/**
 * Test Data Constants - Matched to test harness pre-filled demo content
 */

export const TEST_COURSE_SLUG = "master-sourdough-bread-baking-at-home";
export const TEST_COURSE_URL = "master-sourdough-baking";
export const TEST_REFERRAL_LINK = "https://tutoria.vn/course/master-sourdough-bread-baking-at-home?ref=instructor";

export const TEST_LANDING_PAGE = {
  title: "Master sourdough bread baking at home",
  subtitle: "From starter to crusty loaf — artisan bread technique for home bakers",
  description: "Learn the art of sourdough bread baking from scratch. This comprehensive course covers everything from creating and maintaining a healthy starter to shaping, scoring, and baking beautiful artisan loaves in your home oven. You will master the science of fermentation, understand how different flours affect your dough, and develop the intuition to troubleshoot common problems. Whether you are a complete beginner or an experienced baker looking to refine your skills, this course will give you the confidence to bake professional-quality sourdough at home. Includes detailed video demonstrations, printable recipes, and a troubleshooting guide for common issues like dense crumb, flat loaves, and over-proofed dough.",
  language: "English",
  level: "All Levels",
  category: "Food & Beverage",
  subcategory: "Baking",
  topics: ["Bread", "Baking", "Sourdough", "Artisan"],
  coverName: "",
  coverUrl: "",
  coverMode: "file" as const,
  coverUrlInput: "",
  promoName: "",
  promoUrl: "",
  promoMode: "file" as const,
  promoUrlInput: "",
};

export const TEST_PRICING = {
  currency: "VND",
  priceTier: "499000",
  premiumInstructor: false,
  payoutReady: false,
  taxInfo: false,
};

export const TEST_PROMOTIONS = {
  referralLink: "https://tutoria.vn/course/master-sourdough-bread-baking-at-home?ref=instructor",
  coupons: [{ id: "id-lhqm4rlu", code: "LAUNCH50", type: "Best price", price: "249000", expires: "2026-12-31", redemptions: "47/1000" }],
};

export const TEST_COURSE_MESSAGES = {
  welcome: "Welcome! Start with Section 1 to build your starter.",
  completion: "Congratulations on completing the course!",
};

export const TEST_SUBMIT_REVIEW = {
  courseUrl: "master-sourdough-baking",
  identityVerified: true,
  termsAccepted: true,
  ready: false,
  reviewRows: [
    { title: "Intended learners are complete", detail: "4/4 learning outcomes", done: true, pageLink: "intended-learners" },
    { title: "Curriculum meets the minimum", detail: "5/5 lectures", done: true, pageLink: "curriculum" },
    { title: "Production quality is confirmed", detail: "Audio, visuals confirmed", done: true, pageLink: "film-edit" },
    { title: "Landing page is complete", detail: "Title, subtitle done", done: false, pageLink: "landing-page" },
    { title: "Pricing is configured", detail: "499,000 VND", done: true, pageLink: "pricing" },
    { title: "Identity is verified", detail: "Complete identity verification", done: true },
    { title: "Content rights are confirmed", detail: "Confirm ownership", done: true },
    { title: "Course URL is set", detail: "master-sourdough-baking", done: true },
  ],
};

export const TEST_INTENDED_LEARNERS = {
  outcomes: [
    "Bake naturally leavened sourdough bread from scratch",
    "Manage a healthy starter and control fermentation",
    "Shape, score, and bake loaves in a home oven",
    "Troubleshoot common sourdough problems confidently",
  ],
  requirements: ["No prior experience is required."],
  audiences: ["Home bakers wanting to master artisan bread"],
};

console.log("Test data created");

export const TEST_COURSE_STRUCTURE = {
  guideCompleted: false,
  outline: `Section 1 · Foundations
Lecture · Welcome and course goals
Lecture · Core concept
Quiz · Check understanding

Section 2 · Guided practice`,
  planChecks: {
    outcomes: true,
    practice: false,
    sections: true,
  },
  structureNotes: `Section 1 · Foundations
Lecture · Welcome and course goals
Lecture · Core concept
Quiz · Check understanding

Section 2 · Guided practice`,
};

export const TEST_SETUP_TEST_VIDEO = {
  guideCompleted: true,
  videoUploaded: true,
  qualityConfirmed: true,
};

export const TEST_FILM_EDIT = {
  guideCompleted: true,
  videosRecorded: true,
  editingComplete: true,
};
