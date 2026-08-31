import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sufjrstewzvzjzvzekry.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XLdJqQK_XoZAysvA7UCADw_KIp-0mxh";
const API_BASE = "http://localhost:4000";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false },
});

const pizzaEvent = {
  slug: "pizza-4ps-pizza-making-workshop",
  title: "Pizza 4P's Pizza-Making Workshop",
  subtitle: "A hands-on pizza-making experience with Pizza 4P's workshop team",
  date: "Sunday, 26 Jul 2026",
  time: "09:00 AM",
  duration: "2.5 hours",
  location: "Hoan Kiem, Ha Noi",
  timezone: "Asia/Ho_Chi_Minh",
  type: "In person",
  price: "650,000 đ",
  attending: 0,
  capacity: 20,
  image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1800&q=88",
  topic: "Cooking",
  level: "Beginner",
  languages: ["English", "Vietnamese"],
  minimumAge: "All ages",
  accessibility: "Wheelchair accessible. Contact the host for specific needs.",
  studioName: "Pizza 4P's Studio",
  address: "123 Hoan Kiem, Ha Noi",
  sessions: [
    { id: "session-1", date: "2026-07-26", times: ["09:00 AM - 11:30 AM"] },
  ],
  spotsLeft: 20,
  about: [
    "Join Pizza 4P's workshop team for a hands-on pizza-making experience in the heart of Ha Noi.",
    "Learn the art of traditional Neapolitan pizza making from scratch, from dough preparation to wood-fired baking.",
  ],
  note: "Apron and all ingredients provided. Just bring your appetite!",
  highlights: [
    { title: "20 places", description: "An intimate, hands-on group experience." },
    { title: "2.5 hours", description: "A complete pizza-making journey." },
    { title: "In person", description: "Learn together in Pizza 4P's studio." },
    { title: "Beginner", description: "Designed for first-time pizza makers." },
  ],
  learn: [
    "Make traditional Neapolitan pizza dough from scratch",
    "Prepare authentic tomato sauce and fresh toppings",
    "Master wood-fired oven techniques",
    "Create your own custom pizza to enjoy",
  ],
  included: [
    "All ingredients and equipment",
    "Apron for the session",
    "Your freshly made pizza to enjoy",
    "Recipe card to take home",
  ],
  bring: ["Just yourself! Everything else is provided."],
  plan: [
    { title: "Welcome & Introduction", duration: "15 min", description: "Meet your hosts, get comfortable in the kitchen, and learn about the session.", image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1800&q=88" },
    { title: "Dough Mastery", duration: "30 min", description: "Learn to mix, knead, and shape traditional Neapolitan dough.", image: "" },
    { title: "Sauce & Toppings", duration: "20 min", description: "Prepare authentic tomato sauce and select fresh toppings.", image: "" },
    { title: "Pizza Assembly", duration: "30 min", description: "Craft your own pizza with guidance from the experts.", image: "" },
    { title: "Wood-Fired Baking", duration: "15 min", description: "Watch your pizza cook to perfection in the wood-fired oven.", image: "" },
    { title: "Enjoy Your Creation", duration: "30 min", description: "Sit down and enjoy the pizza you made!", image: "" },
  ],
  faqs: [
    { question: "Do I need cooking experience?", answer: "No previous cooking experience is required. The workshop team demonstrates each step before you try it." },
    { question: "Can children attend?", answer: "Yes! This workshop is suitable for ages 8 and up. Children under 12 must be accompanied by an adult." },
    { question: "What dietary requirements can you accommodate?", answer: "Vegetarian options are available. Please inform us of any allergies when booking." },
  ],
  galleryImage: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1800&q=88",
  hostRole: "Pizza 4P's Workshop Team",
  hostExperience: "Chef-led workshop team with years of experience",
  hostBio: "Pizza 4P's is renowned for authentic Neapolitan pizza, using traditional techniques and the finest ingredients.",
  hostImage: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=240&h=240&q=80",
  hostRecommendation: "Top-rated host",
  beforeYouAttend: [
    { title: "What to bring", items: ["Just yourself! Everything else is provided."] },
    { title: "Arrival", items: ["Please arrive 10 minutes before the session starts."] },
  ],
  cancellation: ["Free cancellation up to 24 hours before the start."],
  reviews: [],
  packages: [],
  pricingMode: "single",
  visibility: "Public",
};

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log("Usage: node scripts/publish-pizza-workshop.mjs <email> <password>");
    console.log("");
    console.log("To create a new user, sign up through the UI at /auth/sign-up");
    console.log("and confirm your email, then run this script with your credentials.");
    process.exit(1);
  }

  console.log("Signing in as:", email);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("Sign in error:", signInError.message);
    process.exit(1);
  }

  const accessToken = signInData.session?.access_token;
  if (!accessToken) {
    console.error("No access token obtained");
    process.exit(1);
  }
  console.log("Got access token");

  console.log("Publishing pizza workshop...");
  const response = await fetch(`${API_BASE}/api/v1/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    body: JSON.stringify(pizzaEvent),
    cache: "no-store",
  });
  const result = await response.json();
  console.log("Response status:", response.status);
  console.log("Response:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
