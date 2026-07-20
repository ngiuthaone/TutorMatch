import React from "react";
import { createRoot } from "react-dom/client";
<<<<<<< ours
import PublicProfilePage from "./PublicProfilePage.jsx";

createRoot(document.getElementById("profile-preview")).render(
  <React.StrictMode>
    <PublicProfilePage isOwner />
=======
import PublicProfilePage, { samplePublicProfile } from "./PublicProfilePage.jsx";

const publicProfiles = {
  "Linh Nguyen": {
    role: "English & IELTS Coach",
    location: "Dong Da, Ha Noi",
    website: "linhnguyen.english",
    bio: ["IELTS coach helping learners build confidence and reach their language goals."],
    about: "I combine structured practice with real-world language immersion to make English useful, memorable, and personal.",
    avatar: "https://picsum.photos/seed/linh-avatar/400/400",
    cover: "https://picsum.photos/seed/linh-cover/1800/580",
    skills: ["IELTS", "English", "TOEFL", "Academic Writing"],
    statValues: ["2,000", "4.9", "1,890"],
  },
  "Thu Ha": {
    role: "Cooking Instructor",
    location: "Hoan Kiem, Ha Noi",
    website: "thuhacooks.com",
    bio: ["Culinary instructor sharing Vietnamese cuisine and practical kitchen craft."],
    about: "I blend French culinary techniques with Vietnamese traditions through welcoming, hands-on classes.",
    avatar: "https://picsum.photos/seed/thu-avatar/400/400",
    cover: "https://picsum.photos/seed/thu-cover/1800/580",
    skills: ["Vietnamese Cuisine", "Baking", "French Culinary"],
    statValues: ["3,100", "4.9", "3,420"],
  },
  "Huy Tran": {
    role: "Full-stack Developer",
    location: "Ba Dinh, Ha Noi",
    website: "huydev.io",
    bio: ["Software builder and mentor helping the next generation of developers."],
    about: "I build products for startups and share practical lessons from shipping real software across Southeast Asia.",
    avatar: "https://picsum.photos/seed/huy-avatar/400/400",
    cover: "https://picsum.photos/seed/huy-cover/1800/580",
    skills: ["JavaScript", "React", "Node.js", "Python"],
    statValues: ["890", "4.8", "567"],
  },
  "Minh Anh": {
    role: "Public Speaking Coach",
    location: "Cau Giay, Ha Noi",
    website: "minhanhspeaks.com",
    bio: ["Workshop facilitator helping people speak with clarity and confidence."],
    about: "My approach combines practical techniques from theatre, psychology, and business communication.",
    avatar: "https://picsum.photos/seed/minh-avatar/400/400",
    cover: "https://picsum.photos/seed/minh-cover/1800/580",
    skills: ["Public Speaking", "Communication", "Leadership"],
    statValues: ["1,200", "4.9", "890"],
  },
  "Bao Long": {
    role: "Business Strategy Mentor",
    location: "District 1, Ho Chi Minh City",
    website: "baolong.me",
    bio: ["Founder and former investor mentoring entrepreneurs and early-stage teams."],
    about: "I share lessons from venture capital and building companies to help founders make clearer, stronger decisions.",
    avatar: "https://picsum.photos/seed/bao-avatar/400/400",
    cover: "https://picsum.photos/seed/bao-cover/1800/580",
    skills: ["Startups", "Strategy", "Marketing", "Fundraising"],
    statValues: ["650", "4.7", "1,520"],
  },
};

const params = new URLSearchParams(window.location.search);
const requestedName = params.get("name") || samplePublicProfile.name;
const details = publicProfiles[requestedName];
const profile = requestedName === samplePublicProfile.name
  ? samplePublicProfile
  : {
      ...samplePublicProfile,
      name: requestedName,
      role: details?.role || "Tutoria community member",
      location: details?.location || "Vietnam",
      website: details?.website || "",
      bio: details?.bio || ["Learning, sharing, and connecting with the Tutoria community."],
      about: details?.about || "This member shares knowledge and experiences with the Tutoria community.",
      avatar: details?.avatar || `https://picsum.photos/seed/${encodeURIComponent(requestedName)}-avatar/400/400`,
      cover: details?.cover || `https://picsum.photos/seed/${encodeURIComponent(requestedName)}-cover/1800/580`,
      skills: details?.skills || [],
      stats: samplePublicProfile.stats.map((stat, index) => ({
        ...stat,
        value: details?.statValues?.[index] || "—",
      })),
      offers: [],
      achievements: [],
      sessions: [],
      posts: [],
    };

createRoot(document.getElementById("profile-preview")).render(
  <React.StrictMode>
    <PublicProfilePage profile={profile} isOwner={params.get("owner") === "1"} />
>>>>>>> theirs
  </React.StrictMode>,
);
