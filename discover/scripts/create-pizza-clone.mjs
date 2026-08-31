import { readFileSync, writeFileSync } from "node:fs";

const filePath = "data/published-events.json";
const events = JSON.parse(readFileSync(filePath, "utf8"));

const clone = {
  slug: "pizza-workshop-clone",
  title: "Pizza Workshop Clone",
  host: "Pizza 4P's Workshop Team",
  date: "Sun, 26 Jul 2026",
  time: "09:00 - 11:30",
  location: "Hoan Kiem, Ha Noi",
  type: "In person",
  price: "650,000 đ",
  attending: 0,
  capacity: 20,
  image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1800&q=88",
  topic: "Cooking",
  level: "Beginner",
  subtitle: "Stretch, top, bake, and enjoy your own artisan pizza with the Pizza 4P's team.",
  rating: 4.9,
  reviewCount: 214,
  duration: "2.5 hours",
  languages: ["Vietnamese", "English"],
  minimumAge: "10+",
  accessibility: "Ages 10-15 attend with an adult.",
  studioName: "Pizza 4P's Bao Khanh",
  address: "Pizza 4P's Bao Khanh, Hoan Kiem, Ha Noi",
  sessions: [
    { id: "sun-26-jul-morning", date: "Sun, 26 Jul 2026", times: ["09:00 - 11:30"] },
    { id: "sun-26-jul-midday", date: "Sun, 26 Jul 2026", times: ["12:00 - 14:30"] },
    { id: "sun-26-jul-afternoon", date: "Sun, 26 Jul 2026", times: ["15:00 - 17:30"] },
  ],
  spotsLeft: 20,
  about: [
    "Step into a Pizza 4P's kitchen and learn how dough, sauce, cheese, toppings, and heat come together in a balanced pizza.",
    "Stretch your own dough, choose toppings, build one full pizza, and enjoy it fresh from the oven with the group.",
    "No previous cooking experience is required.",
  ],
  note: "Learn the craft behind a balanced artisan pizza.",
  highlights: [
    { title: "Chef-led session", description: "Learn directly from the Pizza 4P's workshop team." },
    { title: "Hands-on pizza making", description: "Stretch, top, bake, and taste your own full pizza." },
    { title: "Beginner friendly", description: "Every step is demonstrated and supported." },
    { title: "Recipe card included", description: "Leave with practical tips for recreating the process at home." },
  ],
  learn: [
    "Understand dough fermentation",
    "Stretch pizza dough by hand",
    "Balance sauce, cheese, and toppings",
    "Understand high-heat baking",
  ],
  included: [
    "Dough and kitchen tools",
    "Sauce, cheese, and toppings",
    "Apron and recipe card",
    "Welcome drink",
    "One pizza per participant",
  ],
  bring: ["Comfortable clothes", "Closed-toe shoes", "Hair tie for long hair"],
  plan: [
    { title: "Welcome and ingredient introduction", duration: "15 min", description: "Meet the Pizza 4P's workshop team, get comfortable in the kitchen, and learn how the dough, sauces, cheeses, and seasonal toppings will be used throughout the session.", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=90" },
    { title: "Dough-stretching demonstration", duration: "25 min", description: "Watch a chef demonstrate how to open and stretch fermented dough by hand, keep the crust airy, and prepare the base for sauce and toppings without overworking it.", image: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=1200&q=90" },
    { title: "Build your own pizza", duration: "60 min", description: "Stretch your dough, spread sauce, choose cheeses, and balance toppings with one-on-one guidance from the chefs so your pizza bakes evenly and tastes balanced.", image: "https://images.unsplash.com/photo-1511689660979-10d2b1aada49?auto=format&fit=crop&w=1200&q=90" },
    { title: "Bake, taste, and wrap up", duration: "50 min", description: "See how the high-heat oven finishes your pizza, enjoy the tasting together, and leave with a recipe card plus practical tips for recreating the process at home.", image: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=1200&q=90" },
  ],
  faqs: [
    { question: "Do I need cooking experience?", answer: "No previous cooking experience is required. The workshop team demonstrates each step before you try it." },
    { question: "Will I make my own pizza?", answer: "Yes. Every participant stretches, tops, bakes, and tastes one full pizza during the session." },
    { question: "Are ingredients included?", answer: "Yes. Dough, sauces, cheeses, toppings, kitchen tools, an apron, and a recipe card are included." },
    { question: "Can children attend?", answer: "Participants aged 10-15 can attend with an adult." },
  ],
  galleryImage: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=88",
  hostRole: "Pizza chefs and facilitators",
  hostExperience: "Chef-led workshop team",
  hostBio: "The team guides each participant through dough stretching, topping balance, baking, and tasting.",
  hostImage: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=420&q=88",
  hostRecommendation: "97% recommend",
  beforeYouAttend: [
    { title: "Minimum age", items: ["Participants must be at least 10 years old.", "Ages 10-15 attend with an adult."] },
    { title: "What to wear", items: ["Wear comfortable clothes.", "Closed-toe shoes are recommended.", "Tie back long hair."] },
    { title: "Arrival", items: ["Exact arrival instructions are provided after booking.", "Arrive 10 minutes before the session starts."] },
  ],
  cancellation: [
    "Free cancellation up to 24 hours before the start.",
    "If the host cancels, choose another available session or receive a full refund.",
  ],
  reviews: [
    { name: "An Nguyen", attended: "12 Jul 2026", rating: 5, body: "The chefs explained every step clearly, and stretching the dough was much easier than expected. Highly recommend for anyone curious about pizza-making.", avatar: "https://picsum.photos/seed/reviewer-an/96/96" },
    { name: "Minh Tran", attended: "05 Jul 2026", rating: 5, body: "The team gave everyone individual help without making the session feel rushed. Great balance of instruction and hands-on practice.", avatar: "https://picsum.photos/seed/reviewer-minh-pizza/96/96" },
    { name: "Huong Pham", attended: "28 Jun 2026", rating: 5, body: "My pizza came out better than I expected. The workshop felt polished, well-paced, and genuinely hands-on from start to finish.", avatar: "https://picsum.photos/seed/reviewer-huong-pizza/96/96" },
  ],
  visibility: "Public",
  experienceType: "Workshop",
  publishedAt: new Date().toISOString(),
};

events.unshift(clone);
writeFileSync(filePath, JSON.stringify(events, null, 2), "utf8");
console.log("Pizza Workshop Clone created successfully!");
