"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, CalendarDays, Ellipsis, Heart, Image as ImageIcon,
  Link2, MapPin, MessageCircle, PanelsTopLeft, Repeat2, Send,
  Star, UserRound, UsersRound, Pencil, X, Plus, Trash2, Move,
} from "lucide-react";

type ProfileOffer = { title: string; description: string };

type CommunityProfile = {
  name: string; role: string; avatar: string; bio: string; about: string;
  location: string; website: string; cover: string; skills: string[];
  coverPositionX?: number; coverPositionY?: number;
  avatarPositionX?: number; avatarPositionY?: number; avatarZoom?: number;
  offers?: ProfileOffer[]; achievements?: string[];
  learners: number; rating: number; followers: number;
  isBlank?: boolean;
};

type ProfileDraft = Pick<CommunityProfile, "name" | "role" | "avatar" | "bio" | "about" | "location" | "website" | "cover"> & {
  skills: string;
  offers: ProfileOffer[];
  achievements: string[];
  coverPositionX: number;
  coverPositionY: number;
  avatarPositionX: number;
  avatarPositionY: number;
  avatarZoom: number;
};

const profiles: Record<string, CommunityProfile> = {
  "Duc Pham": {
    name: "Duc Pham", role: "Photography Artist",
    avatar: "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=400&q=90",
    bio: "Commercial photographer and exhibition curator.\nTeaching photography for 5+ years.",
    about: "I work across commercial photography, editorial assignments, and independent exhibitions. My teaching focuses on visual storytelling, composition, and building a repeatable creative process.",
    location: "Tay Ho, Ha Noi", website: "ducpham.photo",
    cover: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=90",
    skills: ["Photography", "Lightroom", "Photoshop", "Composition"],
    learners: 1200, rating: 4.9, followers: 245,
  },
  "Linh Nguyen": {
    name: "Linh Nguyen", role: "English & IELTS Coach",
    avatar: "https://picsum.photos/seed/linh-avatar/200/200",
    bio: "Helping students achieve their IELTS goals.\n7+ years of teaching experience.",
    about: "I help learners build practical speaking confidence and prepare for IELTS with focused feedback, realistic practice, and a plan shaped around their target score.",
    location: "Ha Noi", website: "linhnguyen.edu",
    cover: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=90",
    skills: ["IELTS", "English", "Public Speaking"],
    learners: 890, rating: 4.8, followers: 180,
  },
  "Thu Ha": {
    name: "Thu Ha", role: "Cooking Instructor",
    avatar: "https://picsum.photos/seed/thu-avatar/200/200",
    bio: "Home cook turned instructor.\nSharing Vietnamese cuisine with the world.",
    about: "My classes make Vietnamese home cooking approachable through reliable techniques, ingredient knowledge, and recipes designed to be repeated beyond the lesson.",
    location: "Sai Gon", website: "thuhacooks.com",
    cover: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1800&q=90",
    skills: ["Cooking", "Baking", "Vietnamese Cuisine"],
    learners: 650, rating: 4.7, followers: 320,
  },
  "Huy Tran": {
    name: "Huy Tran", role: "Full-stack Developer",
    avatar: "https://picsum.photos/seed/huy-avatar/200/200",
    bio: "Building products and teaching code.\nFull-stack dev with 8 years experience.",
    about: "I mentor developers through real product decisions, from application architecture to shipping and maintaining production systems.",
    location: "Da Nang", website: "huy.dev",
    cover: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1800&q=90",
    skills: ["React", "TypeScript", "Node.js", "Python"],
    learners: 1100, rating: 4.9, followers: 410,
  },
  "Minh Anh": {
    name: "Minh Anh", role: "Public Speaking Coach",
    avatar: "https://picsum.photos/seed/minh-avatar/200/200",
    bio: "Helping professionals communicate with confidence.\nTEDx speaker and coach.",
    about: "I work with professionals who want to speak with more clarity and presence in presentations, meetings, and high-stakes conversations.",
    location: "Ha Noi", website: "minhanhspeaks.com",
    cover: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1800&q=90",
    skills: ["Public Speaking", "Presentation Skills", "Communication"],
    learners: 1340, rating: 4.9, followers: 560,
  },
  "Bao Long": {
    name: "Bao Long", role: "Business Strategy Mentor",
    avatar: "https://picsum.photos/seed/bao-avatar/200/200",
    bio: "Startup advisor and strategy consultant.\nFormer founder, current mentor.",
    about: "I support founders and teams as they turn uncertain business questions into clear priorities, useful experiments, and accountable next steps.",
    location: "Sai Gon", website: "baolong.co",
    cover: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1800&q=90",
    skills: ["Business Strategy", "Startups", "Leadership"],
    learners: 720, rating: 4.7, followers: 290,
  },
  "Ngoc Tram": {
    name: "Ngoc Tram", role: "Yoga & Meditation Coach",
    avatar: "https://picsum.photos/seed/ngoc-tram-avatar/200/200",
    bio: "RYT-500 yoga teacher.\nGuiding mindful movement and calmer routines.",
    about: "I help learners build a sustainable yoga and meditation practice through clear alignment, breath work, and simple routines that fit daily life.",
    location: "Ba Dinh, Ha Noi", website: "ngoctramyoga.vn",
    cover: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1800&q=90",
    skills: ["Yoga", "Meditation", "Mindfulness"],
    learners: 980, rating: 4.8, followers: 360,
  },
  "Pizza 4P’s Workshop Team": {
    name: "Pizza 4P’s Workshop Team", role: "Pizza Chefs & Facilitators",
    avatar: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=400&q=90",
    bio: "Chef-led pizza-making workshops.\nHands-on sessions from dough to tasting.",
    about: "Our workshop team guides learners through dough stretching, topping balance, high-heat baking, and tasting so every participant finishes one full pizza with practical tips for home.",
    location: "Hoan Kiem, Ha Noi", website: "pizza4ps.com",
    cover: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1800&q=90",
    skills: ["Pizza Making", "Dough", "Cooking"],
    learners: 2140, rating: 4.9, followers: 970,
  },
};

const allPeople = Object.values(profiles);

const sampleOffers: ProfileOffer[] = [
  { title: "1-on-1 Coaching Sessions", description: "Personalized guidance" },
  { title: "Group Workshops", description: "Hands-on learning experience" },
  { title: "Online Resources", description: "Self-paced materials" },
];

const sampleAchievements = ["Featured Creator", "Top Rated"];
// Allow the focal point to travel beyond the CSS 0–100% range so wide/tall
// images can be positioned naturally inside the crop frame.
const clampPosition = (value: number) => Math.max(-50, Math.min(150, value));
const cropTransform = (positionX: number, positionY: number, zoom = 1) => `translate(${((50 - positionX) / 50) * 100}%, ${((50 - positionY) / 50) * 100}%) scale(${zoom})`;

function subscribeToCurrentUser(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getCurrentUserSnapshot() {
  return localStorage.getItem("tutoria_signup") || "";
}

function getSavedProfilesSnapshot() {
  return localStorage.getItem("tutoria_profiles") || "";
}

function getServerCurrentUserSnapshot() {
  return "";
}

function readCurrentUserName(snapshot: string) {
  try {
    const signup = JSON.parse(snapshot);
    return signup?.completed && typeof signup.name === "string" ? signup.name.trim() : "";
  } catch {
    return "";
  }
}

function readAccountKey(snapshot: string) {
  try {
    const signup = JSON.parse(snapshot);
    const identifier = signup?.email || signup?.id || signup?.name;
    return typeof identifier === "string" ? identifier.trim().toLocaleLowerCase() : "";
  } catch {
    return "";
  }
}

function readSavedProfile(snapshot: string, accountKey: string): Partial<CommunityProfile> | null {
  if (!snapshot || !accountKey) return null;
  try {
    const saved = JSON.parse(snapshot)?.[accountKey];
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function makeBlankProfile(name: string): CommunityProfile {
  return {
    name,
    role: "Tutoria member",
    avatar: "",
    bio: "",
    about: "",
    location: "",
    website: "",
    cover: "",
    coverPositionX: 50,
    coverPositionY: 50,
    avatarPositionX: 50,
    avatarPositionY: 50,
    avatarZoom: 1,
    skills: [],
    offers: [],
    achievements: [],
    learners: 0,
    rating: 0,
    followers: 0,
    isBlank: true,
  };
}

export function CommunityUserProfile({ name }: { name?: string }) {
  const router = useRouter();
  const coverDrag = useRef<{ pointerId: number; startX: number; startY: number; positionX: number; positionY: number; width: number; height: number } | null>(null);
  const avatarDrag = useRef<{ pointerId: number; startX: number; startY: number; positionX: number; positionY: number; width: number; height: number } | null>(null);
  const cropOriginal = useRef<{ avatarPositionX: number; avatarPositionY: number; avatarZoom: number; coverPositionX: number; coverPositionY: number } | null>(null);
  const [tab, setTab] = useState("Posts");
  const [editing, setEditing] = useState(false);
  const [cropTarget, setCropTarget] = useState<"avatar" | "cover" | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [editError, setEditError] = useState("");
  const currentUserSnapshot = useSyncExternalStore(subscribeToCurrentUser, getCurrentUserSnapshot, getServerCurrentUserSnapshot);
  const savedProfilesSnapshot = useSyncExternalStore(subscribeToCurrentUser, getSavedProfilesSnapshot, getServerCurrentUserSnapshot);
  const currentUserName = readCurrentUserName(currentUserSnapshot);
  const accountKey = readAccountKey(currentUserSnapshot);
  const tabs = [["Posts", PanelsTopLeft], ["Articles", ImageIcon], ["Sessions", CalendarDays], ["About", UserRound]] as const;

  const requestedName = name?.trim() || "Tutoria member";
  const isOwnProfile = Boolean(currentUserName) && currentUserName.toLocaleLowerCase() === requestedName.toLocaleLowerCase();
  const isSampleProfile = !isOwnProfile && Boolean(profiles[requestedName]);
  const savedOwnProfile = readSavedProfile(savedProfilesSnapshot, accountKey);
  const profile = isOwnProfile ? { ...makeBlankProfile(currentUserName), ...savedOwnProfile, name: savedOwnProfile?.name || currentUserName } : profiles[requestedName] || makeBlankProfile(requestedName);
  const displayedOffers = isSampleProfile ? sampleOffers : profile.offers || [];
  const displayedAchievements = isSampleProfile ? sampleAchievements : profile.achievements || [];
  const firstName = profile.name.split(" ")[0];

  useEffect(() => {
    if (!editing) {
      document.body.style.removeProperty("overflow");
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (cropTarget) {
        const original = cropOriginal.current;
        if (original) setDraft((current) => current ? { ...current, ...original } : current);
        setCropTarget(null);
      } else {
        setEditing(false);
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.removeProperty("overflow");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [editing, cropTarget]);

  useEffect(() => {
    if (!editing) return;
    const trackDrag = (event: PointerEvent) => {
      const cover = coverDrag.current;
      const avatar = avatarDrag.current;
      if ((!cover || cover.pointerId !== event.pointerId) && (!avatar || avatar.pointerId !== event.pointerId)) return;
      event.preventDefault();
      setDraft((current) => {
        if (!current) return current;
        if (cover?.pointerId === event.pointerId) {
          return {
            ...current,
            coverPositionX: clampPosition(cover.positionX - ((event.clientX - cover.startX) / cover.width) * 100),
            coverPositionY: clampPosition(cover.positionY - ((event.clientY - cover.startY) / cover.height) * 100),
          };
        }
        if (avatar?.pointerId === event.pointerId) {
          return {
            ...current,
            avatarPositionX: clampPosition(avatar.positionX - ((event.clientX - avatar.startX) / avatar.width) * 100),
            avatarPositionY: clampPosition(avatar.positionY - ((event.clientY - avatar.startY) / avatar.height) * 100),
          };
        }
        return current;
      });
    };
    const stopDrag = (event: PointerEvent) => {
      if (coverDrag.current?.pointerId === event.pointerId) coverDrag.current = null;
      if (avatarDrag.current?.pointerId === event.pointerId) avatarDrag.current = null;
    };
    window.addEventListener("pointermove", trackDrag, { passive: false });
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointermove", trackDrag);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      coverDrag.current = null;
      avatarDrag.current = null;
    };
  }, [editing]);

  const openEditor = () => {
    setDraft({
      name: profile.name,
      role: profile.role === "Tutoria member" ? "" : profile.role,
      avatar: profile.avatar,
      cover: profile.cover,
      coverPositionX: profile.coverPositionX ?? 50,
      coverPositionY: profile.coverPositionY ?? 50,
      avatarPositionX: profile.avatarPositionX ?? 50,
      avatarPositionY: profile.avatarPositionY ?? 50,
      avatarZoom: profile.avatarZoom ?? 1,
      bio: profile.bio,
      about: profile.about,
      location: profile.location,
      website: profile.website,
      skills: profile.skills.join(", "),
      offers: (profile.offers || []).map((offer) => ({ ...offer })),
      achievements: [...(profile.achievements || [])],
    });
    setEditError("");
    setEditing(true);
  };

  const updateDraft = (field: Exclude<keyof ProfileDraft, "offers" | "achievements" | "coverPositionX" | "coverPositionY" | "avatarPositionX" | "avatarPositionY" | "avatarZoom">, value: string) => setDraft((current) => current ? { ...current, [field]: value } : current);

  const updateOffer = (index: number, field: keyof ProfileOffer, value: string) => setDraft((current) => current ? {
    ...current,
    offers: current.offers.map((offer, offerIndex) => offerIndex === index ? { ...offer, [field]: value } : offer),
  } : current);

  const updateAchievement = (index: number, value: string) => setDraft((current) => current ? {
    ...current,
    achievements: current.achievements.map((achievement, achievementIndex) => achievementIndex === index ? value : achievement),
  } : current);

  const openCropper = (target: "avatar" | "cover") => {
    if (!draft?.[target]) return;
    cropOriginal.current = {
      avatarPositionX: draft.avatarPositionX,
      avatarPositionY: draft.avatarPositionY,
      avatarZoom: draft.avatarZoom,
      coverPositionX: draft.coverPositionX,
      coverPositionY: draft.coverPositionY,
    };
    if (target === "avatar" && draft.avatarZoom < 1.2) {
      setDraft((current) => current ? { ...current, avatarZoom: 1.2 } : current);
    }
    setCropTarget(target);
  };

  const cancelCropper = () => {
    const original = cropOriginal.current;
    if (original) setDraft((current) => current ? { ...current, ...original } : current);
    cropOriginal.current = null;
    setCropTarget(null);
  };

  const applyCropper = () => {
    cropOriginal.current = null;
    setCropTarget(null);
  };

  const loadImage = (field: "avatar" | "cover", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditError("Choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        if (field === "cover") {
          setDraft((current) => current ? { ...current, cover: reader.result as string, coverPositionX: 50, coverPositionY: 50 } : current);
        } else {
          setDraft((current) => current ? { ...current, avatar: reader.result as string, avatarPositionX: 50, avatarPositionY: 50, avatarZoom: 1 } : current);
        }
      }
    });
    reader.readAsDataURL(file);
  };

  const beginCoverDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft?.cover) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    coverDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, positionX: draft.coverPositionX, positionY: draft.coverPositionY, width: rect.width, height: rect.height };
  };

  const nudgeCover = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!draft?.cover || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 8 : 2;
    setDraft((current) => {
      if (!current) return current;
      if (event.key === "ArrowUp") return { ...current, coverPositionY: clampPosition(current.coverPositionY + step) };
      if (event.key === "ArrowDown") return { ...current, coverPositionY: clampPosition(current.coverPositionY - step) };
      if (event.key === "ArrowLeft") return { ...current, coverPositionX: clampPosition(current.coverPositionX + step) };
      return { ...current, coverPositionX: clampPosition(current.coverPositionX - step) };
    });
  };

  const beginAvatarDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft?.avatar) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    avatarDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, positionX: draft.avatarPositionX, positionY: draft.avatarPositionY, width: rect.width, height: rect.height };
  };

  const nudgeAvatar = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!draft?.avatar || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 8 : 2;
    setDraft((current) => {
      if (!current) return current;
      if (event.key === "ArrowUp") return { ...current, avatarPositionY: clampPosition(current.avatarPositionY + step) };
      if (event.key === "ArrowDown") return { ...current, avatarPositionY: clampPosition(current.avatarPositionY - step) };
      if (event.key === "ArrowLeft") return { ...current, avatarPositionX: clampPosition(current.avatarPositionX + step) };
      return { ...current, avatarPositionX: clampPosition(current.avatarPositionX - step) };
    });
  };

  const saveProfile = () => {
    if (!draft || !accountKey) return;
    const nextName = draft.name.trim();
    if (!nextName) {
      setEditError("Your profile needs a name.");
      return;
    }
    const savedProfile: CommunityProfile = {
      ...makeBlankProfile(nextName),
      ...draft,
      name: nextName,
      role: draft.role.trim() || "Tutoria member",
      bio: draft.bio.trim(),
      about: draft.about.trim(),
      location: draft.location.trim(),
      website: draft.website.trim().replace(/^https?:\/\//, ""),
      skills: draft.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      offers: draft.offers.map((offer) => ({ title: offer.title.trim(), description: offer.description.trim() })).filter((offer) => offer.title),
      achievements: draft.achievements.map((achievement) => achievement.trim()).filter(Boolean),
      isBlank: false,
    };
    try {
      const savedProfiles = JSON.parse(localStorage.getItem("tutoria_profiles") || "{}");
      savedProfiles[accountKey] = savedProfile;
      localStorage.setItem("tutoria_profiles", JSON.stringify(savedProfiles));

      const session = JSON.parse(localStorage.getItem("tutoria_signup") || "{}");
      const nextSession = { ...session, name: nextName };
      localStorage.setItem("tutoria_signup", JSON.stringify(nextSession));

      const accounts = JSON.parse(localStorage.getItem("tutoria_accounts") || "{}");
      if (accounts[accountKey]) {
        accounts[accountKey] = { ...accounts[accountKey], name: nextName };
        localStorage.setItem("tutoria_accounts", JSON.stringify(accounts));
      }

      window.dispatchEvent(new StorageEvent("storage", { key: "tutoria_signup", newValue: JSON.stringify(nextSession) }));
      setEditing(false);
      router.replace(`/user/${encodeURIComponent(nextName)}`);
    } catch {
      setEditError("Your changes could not be saved. Try again.");
    }
  };

  return (
    <main className="tr-profile-page">
      <article className="tr-profile-shell">
        <div className={`tr-profile-cover ${profile.isBlank ? "tr-profile-cover-empty" : ""}`}>
          {profile.cover ? <img src={profile.cover} alt="" style={{ objectPosition: `${profile.coverPositionX ?? 50}% ${profile.coverPositionY ?? 50}%`, transform: cropTransform(profile.coverPositionX ?? 50, profile.coverPositionY ?? 50) }} /> : isOwnProfile ? <span>Add a cover photo</span> : null}
        </div>
        <div className="tr-profile-body">
          <header className="tr-profile-summary">
            <div className="tr-profile-person">
              {profile.avatar ? <div className="tr-profile-avatar tr-profile-avatar-frame"><img className="tr-profile-avatar-image" src={profile.avatar} alt={profile.name} style={{ objectPosition: `${profile.avatarPositionX ?? 50}% ${profile.avatarPositionY ?? 50}%`, transform: cropTransform(profile.avatarPositionX ?? 50, profile.avatarPositionY ?? 50, profile.avatarZoom ?? 1.2) }} /></div> : <div className="tr-profile-avatar tr-profile-avatar-empty" aria-label={`${profile.name} has no profile photo`}><UserRound /></div>}
              <div>
                <h1>{profile.name} {!profile.isBlank && <BadgeCheck aria-label="Verified" />}</h1>
                <p className="tr-profile-role">{profile.role}</p>
                <p className="tr-profile-meta">
                  {profile.location && <span><MapPin />{profile.location}</span>}
                  {profile.website && <a href={`https://${profile.website}`}><Link2 />{profile.website}</a>}
                </p>
                <p className="tr-profile-bio">{profile.bio ? profile.bio.split("\n").map((line, index) => <span key={index}>{line}<br /></span>) : isOwnProfile ? "Add a bio to tell people about yourself." : "This profile has not been completed yet."}</p>
              </div>
            </div>
            <div className="tr-profile-actions">
              {isOwnProfile ? (
                <button type="button" onClick={openEditor}><Pencil aria-hidden="true" />Edit profile</button>
              ) : (
                <><button>Follow</button><button>Message</button></>
              )}
            </div>
          </header>

          <div className="tr-profile-layout">
            <div>
              <section className="tr-profile-stats">
                <div><UsersRound /><strong>{profile.learners}</strong><small>Learners</small></div>
                <div><Star /><strong>{profile.rating}</strong><small>Rating</small></div>
                <div><UsersRound /><strong>{profile.followers}</strong><small>Followers</small></div>
              </section>
              <section className="tr-profile-skills">
                <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Skills</h2>
                <div>{profile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              </section>
              <nav className="tr-profile-tabs" aria-label="Profile sections">
                {tabs.map(([label, Icon]) => <button key={label} aria-current={tab === label ? "page" : undefined} onClick={() => setTab(label)}><Icon />{label}</button>)}
              </nav>

              {tab === "Posts" && isSampleProfile && (
                <article className="tr-profile-post tr-thread-post">
                  <div className="tr-thread-avatar"><img src={profile.avatar} alt={`${profile.name}'s profile`} /><span aria-hidden="true" /></div>
                  <div className="tr-thread-content">
                    <header><span><strong>{profile.name}</strong><small>· 1h</small></span><button aria-label="Post options"><Ellipsis /></button></header>
                    <p>Sharing something I&apos;ve been working on lately.</p>
                    <img className="tr-profile-post-image" src={profile.cover} alt={`${profile.name}'s latest work`} />
                    <footer><button aria-label="Like post"><Heart />142</button><button aria-label="Reply to post"><MessageCircle />8</button><button aria-label="Repost"><Repeat2 />1</button><button aria-label="Share post"><Send />4</button></footer>
                  </div>
                </article>
              )}
              {tab === "Posts" && !isSampleProfile && <section className="tr-profile-empty"><h2>No posts yet</h2><p>{isOwnProfile ? "Share your first post when you are ready." : `${firstName} has not shared anything yet.`}</p></section>}
              {tab === "Articles" && <section className="tr-profile-empty"><h2>Articles</h2><p>Long-form content will appear here.</p></section>}
              {tab === "Sessions" && <section className="tr-profile-empty"><h2>Learn with {firstName}</h2><p>Private sessions and workshops are available from {firstName}&apos;s profile.</p></section>}
              {tab === "About" && <section className="tr-profile-empty"><h2>About {firstName}</h2><p>{profile.about || (isOwnProfile ? "Add your story, experience, or approach from Edit profile." : "No additional information yet.")}</p></section>}
            </div>

            <aside className="tr-profile-sidebar">
              <section><h2>About {firstName}</h2><p>{profile.about || (isOwnProfile ? "Add your story, experience, or approach from Edit profile." : "No additional information yet.")}</p></section>
              {displayedOffers.length > 0 && <section>
                <h2>What I offer</h2>
                {displayedOffers.map((offer, index) => <div className="tr-offer" key={`${offer.title}-${index}`}><span><strong>{offer.title}</strong>{offer.description && <small>{offer.description}</small>}</span></div>)}
              </section>}
              {displayedAchievements.length > 0 && <section><h2>Achievements</h2>{displayedAchievements.map((achievement, index) => <div className="tr-achievement" key={`${achievement}-${index}`}>{achievement}</div>)}</section>}
            </aside>
          </div>

          <section className="tr-similar">
            <p>Keep exploring</p><h2>Similar people</h2>
            <div>
              {allPeople.filter((person) => person.name !== profile.name).map((person) => (
                <a key={person.name} href={`/user/${encodeURIComponent(person.name)}`}>
                  <img src={person.avatar} alt="" />
                  <span><strong>{person.name}</strong><small>{person.role}</small></span>
                  <b>→</b>
                </a>
              ))}
            </div>
          </section>
        </div>
      </article>
      {editing && draft && (
        <div className="tr-edit-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(false)}>
          <section className="tr-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
            <header className="tr-edit-header">
              <button type="button" onClick={() => setEditing(false)} aria-label="Close edit profile"><X /></button>
              <h2 id="edit-profile-title">Edit profile</h2>
              <span aria-hidden="true" />
            </header>
            <div className="tr-edit-content">
              <section className="tr-edit-section">
                <div className="tr-edit-section-title"><h3>Profile picture</h3><div className="tr-edit-photo-actions">{draft.avatar && <button type="button" onClick={() => openCropper("avatar")}>Reposition</button>}<label>Change<input type="file" accept="image/*" onChange={(event) => loadImage("avatar", event.target.files?.[0])} /></label></div></div>
                <button type="button" className="tr-edit-avatar-preview" onClick={() => draft.avatar && openCropper("avatar")} aria-label={draft.avatar ? "Open profile picture cropper" : "No profile picture"}>{draft.avatar ? <img src={draft.avatar} alt="Profile preview" draggable={false} style={{ objectPosition: `${draft.avatarPositionX}% ${draft.avatarPositionY}%`, transform: cropTransform(draft.avatarPositionX, draft.avatarPositionY, draft.avatarZoom) }} /> : <UserRound />}</button>
                {draft.avatar && <small className="tr-edit-position-status">Applied position: {Math.round(draft.avatarPositionX)}% / {Math.round(draft.avatarPositionY)}% · {Math.round(draft.avatarZoom * 100)}% zoom</small>}
              </section>
              <section className="tr-edit-section">
                <div className="tr-edit-section-title"><h3>Cover photo</h3><div className="tr-edit-photo-actions">{draft.cover && <button type="button" onClick={() => openCropper("cover")}>Reposition</button>}<label>Change<input type="file" accept="image/*" onChange={(event) => loadImage("cover", event.target.files?.[0])} /></label></div></div>
                <button type="button" className="tr-edit-cover-preview" onClick={() => draft.cover && openCropper("cover")} aria-label={draft.cover ? "Open cover photo cropper" : "No cover photo"}>{draft.cover ? <img src={draft.cover} alt="Cover preview" draggable={false} style={{ objectPosition: `${draft.coverPositionX}% ${draft.coverPositionY}%`, transform: cropTransform(draft.coverPositionX, draft.coverPositionY) }} /> : <><ImageIcon /><span>Add a cover photo</span></>}</button>
                {draft.cover && <small className="tr-edit-position-status">Applied position: {Math.round(draft.coverPositionX)}% / {Math.round(draft.coverPositionY)}%</small>}
              </section>
              <section className="tr-edit-section tr-edit-fields">
                <h3>Public profile details</h3>
                <label><span>Name</span><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} maxLength={80} autoComplete="name" /></label>
                <label><span>Headline</span><input value={draft.role} onChange={(event) => updateDraft("role", event.target.value)} maxLength={80} placeholder="What do you do?" /></label>
                <label><span>Bio</span><textarea value={draft.bio} onChange={(event) => updateDraft("bio", event.target.value)} maxLength={160} rows={3} placeholder="A short introduction shown beside your name" /><small>Keep this brief—it appears in your profile header.</small></label>
                <label><span>About</span><textarea value={draft.about} onChange={(event) => updateDraft("about", event.target.value)} maxLength={1200} rows={6} placeholder="Share your background, story, experience, or approach" /><small>This longer description appears in the About section.</small></label>
                <div className="tr-edit-field-pair">
                  <label><span>Location</span><input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} placeholder="City, country" /></label>
                  <label><span>Website</span><input value={draft.website} onChange={(event) => updateDraft("website", event.target.value)} placeholder="yourwebsite.com" inputMode="url" /></label>
                </div>
                <label><span>Skills</span><input value={draft.skills} onChange={(event) => updateDraft("skills", event.target.value)} placeholder="Photography, design, teaching" /><small>Separate skills with commas.</small></label>
              </section>
              <section className="tr-edit-section tr-edit-repeatable">
                <div className="tr-edit-section-title"><div><h3>What I offer</h3><p>Add services, sessions, or resources people can get from you.</p></div><button type="button" onClick={() => setDraft((current) => current ? { ...current, offers: [...current.offers, { title: "", description: "" }] } : current)}><Plus />Add</button></div>
                {draft.offers.length === 0 && <p className="tr-edit-list-empty">No offers added.</p>}
                <div className="tr-edit-repeatable-list">{draft.offers.map((offer, index) => <div className="tr-edit-repeatable-row" key={index}>
                  <div><input aria-label={`Offer ${index + 1} title`} value={offer.title} onChange={(event) => updateOffer(index, "title", event.target.value)} placeholder="Offer title" /><input aria-label={`Offer ${index + 1} description`} value={offer.description} onChange={(event) => updateOffer(index, "description", event.target.value)} placeholder="Short description" /></div>
                  <button type="button" onClick={() => setDraft((current) => current ? { ...current, offers: current.offers.filter((_, offerIndex) => offerIndex !== index) } : current)} aria-label={`Remove offer ${index + 1}`}><Trash2 /></button>
                </div>)}</div>
              </section>
              <section className="tr-edit-section tr-edit-repeatable">
                <div className="tr-edit-section-title"><div><h3>Achievements</h3><p>Add genuine milestones, credentials, or recognition.</p></div><button type="button" onClick={() => setDraft((current) => current ? { ...current, achievements: [...current.achievements, ""] } : current)}><Plus />Add</button></div>
                {draft.achievements.length === 0 && <p className="tr-edit-list-empty">No achievements added.</p>}
                <div className="tr-edit-repeatable-list">{draft.achievements.map((achievement, index) => <div className="tr-edit-repeatable-row tr-edit-achievement-row" key={index}>
                  <input aria-label={`Achievement ${index + 1}`} value={achievement} onChange={(event) => updateAchievement(index, event.target.value)} placeholder="Achievement or credential" />
                  <button type="button" onClick={() => setDraft((current) => current ? { ...current, achievements: current.achievements.filter((_, achievementIndex) => achievementIndex !== index) } : current)} aria-label={`Remove achievement ${index + 1}`}><Trash2 /></button>
                </div>)}</div>
              </section>
              {editError && <p className="tr-edit-error" role="alert">{editError}</p>}
            </div>
            <footer className="tr-edit-footer"><button type="button" onClick={() => setEditing(false)}>Cancel</button><button type="button" onClick={saveProfile}>Save changes</button></footer>
          </section>
        </div>
      )}
      {editing && draft && cropTarget && (
        <div className="tr-crop-overlay" role="presentation">
          <section className="tr-crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
            <header><h2 id="crop-title">{cropTarget === "avatar" ? "Reposition profile picture" : "Reposition cover photo"}</h2><button type="button" onClick={cancelCropper} aria-label="Close cropper"><X /></button></header>
            <div className="tr-crop-content">
              {cropTarget === "avatar" ? <>
                <div className="tr-crop-avatar" tabIndex={0} role="application" aria-label="Drag profile picture to reposition it, or use arrow keys" onPointerDown={beginAvatarDrag} onKeyDown={nudgeAvatar}><img src={draft.avatar} alt="Profile crop preview" draggable={false} style={{ objectPosition: `${draft.avatarPositionX}% ${draft.avatarPositionY}%`, transform: cropTransform(draft.avatarPositionX, draft.avatarPositionY, draft.avatarZoom) }} /><span><Move />Drag to reposition</span></div>
                <label className="tr-crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={draft.avatarZoom} onChange={(event) => setDraft((current) => current ? { ...current, avatarZoom: Number(event.target.value) } : current)} /><output>{Math.round(draft.avatarZoom * 100)}%</output></label>
              </> : <div className="tr-crop-cover" tabIndex={0} role="application" aria-label="Drag cover photo to reposition it, or use arrow keys" onPointerDown={beginCoverDrag} onKeyDown={nudgeCover}><img src={draft.cover} alt="Cover crop preview" draggable={false} style={{ objectPosition: `${draft.coverPositionX}% ${draft.coverPositionY}%`, transform: cropTransform(draft.coverPositionX, draft.coverPositionY) }} /><span><Move />Drag to reposition</span></div>}
              <p>Drag the photo or use the arrow keys to adjust its position.</p>
            </div>
            <footer><button type="button" onClick={cancelCropper}>Cancel</button><button type="button" onClick={applyCropper}>Apply position</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
