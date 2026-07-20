"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconSearch, IconStar, IconMapPin,
  IconCircleCheck, IconUsers, IconGlobe, IconAdjustmentsHorizontal,
} from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import styles from "./marketplace-pages.module.css";

interface Person {
  name: string; title: string; skills: string[]; bio: string;
  rating: number; reviews: number; learners: number;
  price: string; online: boolean; verified: boolean; freeIntro: boolean;
  image: string; location: string; available: boolean;
}

type SubmittedTutor = {
  displayName?: string;
  role?: string;
  headline?: string;
  photoUrl?: string | null;
  skills?: string[];
  lessonFormat?: string;
  availability?: string[];
  languages?: string[];
  rates?: Record<string, number>;
  sessionLengths?: number[];
  consultationEnabled?: boolean;
  consultationPrice?: string;
  status?: string;
};

const TUTOR_SUBMISSION_KEY = "tutoria_tutor_profile_submission";

const allPeople: Person[] = [
  { name: "Minh Anh", title: "Public Speaking Coach", skills: ["Public Speaking", "Communication", "Leadership"], bio: "Helped 200+ learners speak with confidence", rating: 4.9, reviews: 124, learners: 1200, price: "250,000 đ", online: true, verified: true, freeIntro: true, image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=85", location: "Cầu Giấy", available: true },
  { name: "Huy Tran", title: "Full-stack Developer", skills: ["JavaScript", "React", "Node.js", "Python"], bio: "8 years building web apps for startups", rating: 4.8, reviews: 89, learners: 890, price: "350,000 đ", online: true, verified: true, freeIntro: false, image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=85", location: "Ba Đình", available: true },
  { name: "Linh Nguyen", title: "English & IELTS Coach", skills: ["IELTS", "English", "TOEFL", "Academic Writing"], bio: "7.5 IELTS scorer, 5 years teaching", rating: 4.9, reviews: 156, learners: 2000, price: "200,000 đ", online: true, verified: true, freeIntro: true, image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=85", location: "Đống Đa", available: false },
  { name: "Duc Pham", title: "Photography Artist", skills: ["Photography", "Lightroom", "Photoshop", "Composition"], bio: "Commercial photographer, exhibition curator", rating: 4.7, reviews: 67, learners: 540, price: "400,000 đ", online: false, verified: false, freeIntro: false, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=85", location: "Tây Hồ", available: true },
  { name: "Thu Ha", title: "Cooking Instructor", skills: ["Vietnamese Cuisine", "Baking", "French Culinary"], bio: "French culinary arts, 200+ classes taught", rating: 4.9, reviews: 203, learners: 3100, price: "300,000 đ", online: true, verified: true, freeIntro: true, image: "/images/tutor-profile-thu-ha.png", location: "Hoàn Kiếm", available: true },
  { name: "Quoc Anh", title: "Music Producer", skills: ["Music Production", "Ableton", "Sound Design", "Mixing"], bio: "Produced for top Vietnamese artists", rating: 4.6, reviews: 45, learners: 320, price: "500,000 đ", online: true, verified: false, freeIntro: false, image: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=400&q=85", location: "Cầu Giấy", available: false },
  { name: "Ngoc Tram", title: "Yoga & Meditation Coach", skills: ["Yoga", "Meditation", "Mindfulness", "Breathwork"], bio: "RYT-500 certified, 8 years of practice", rating: 4.8, reviews: 112, learners: 980, price: "220,000 đ", online: true, verified: true, freeIntro: true, image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=85", location: "Ba Đình", available: true },
  { name: "Bao Long", title: "Business Strategy Mentor", skills: ["Startups", "Strategy", "Marketing", "Fundraising"], bio: "Ex-VC, founded 2 successful startups", rating: 4.7, reviews: 78, learners: 650, price: "450,000 đ", online: true, verified: true, freeIntro: false, image: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=400&q=85", location: "Tây Hồ", available: true },
];

const allSkills = ["Public Speaking", "JavaScript", "IELTS", "Photography", "Cooking", "Music", "Yoga", "Business"];
const allLocations = ["Ba Đình", "Cầu Giấy", "Đống Đa", "Hai Bà Trưng", "Hoàn Kiếm", "Tây Hồ"];
const roles = ["Tutor", "Coach", "Mentor", "Creator", "Instructor"];

const parsePrice = (p: string) => parseInt(p.replace(/[^0-9]/g, ""));

function submittedTutorToPerson(tutor: SubmittedTutor): Person | null {
  if (tutor.status !== "pending_review" || !tutor.displayName?.trim()) return null;
  const duration = tutor.sessionLengths?.includes(60) ? 60 : tutor.sessionLengths?.[0];
  const price = duration ? tutor.rates?.[String(duration)] : undefined;
  const skills = tutor.skills?.filter(Boolean).slice(0, 4) ?? [];
  return {
    name: tutor.displayName.trim(),
    title: tutor.role?.trim() || (skills[0] ? `${skills[0]} tutor` : "Independent tutor"),
    skills: skills.length ? skills : ["Tutoring"],
    bio: tutor.headline?.trim() || "A new tutor on Tutoria.",
    rating: 0,
    reviews: 0,
    learners: 0,
    price: price ? `${price.toLocaleString("vi-VN")} đ` : "Contact for price",
    online: tutor.lessonFormat === "Online",
    verified: false,
    freeIntro: Boolean(tutor.consultationEnabled && tutor.consultationPrice === "Free"),
    image: tutor.photoUrl || "/images/tutor-profile-thu-ha.png",
    location: "Hà Nội",
    available: Boolean(tutor.availability?.length),
  };
}

function getRole(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("tutor")) return "Tutor";
  if (t.includes("coach")) return "Coach";
  if (t.includes("mentor")) return "Mentor";
  if (t.includes("instructor") || t.includes("teacher")) return "Instructor";
  if (t.includes("producer") || t.includes("artist") || t.includes("developer")) return "Creator";
  return "Instructor";
}

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
  { value: "experienced", label: "Most experienced" },
];

export function PeoplePage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [submittedPeople, setSubmittedPeople] = useState<Person[]>([]);
  const params = useFilterParams();
  const query = params.get("q", "");
  const roleFilter = params.get("role", "");
  const skillFilter = params.get("skill", "");
  const format = params.get("format", "");
  const priceFilter = params.get("price", "");
  const ratingFilter = params.get("rating", "");
  const availFilter = params.get("avail", "");
  const verifiedFilter = params.get("verified", "");
  const locationFilter = params.get("location", "");
  const sort = params.get("sort", "recommended");

  useEffect(() => {
    try {
      const savedTutor = JSON.parse(window.localStorage.getItem(TUTOR_SUBMISSION_KEY) || "null") as SubmittedTutor | null;
      const person = savedTutor ? submittedTutorToPerson(savedTutor) : null;
      const frame = window.requestAnimationFrame(() => setSubmittedPeople(person ? [person] : []));
      return () => window.cancelAnimationFrame(frame);
    } catch {
      window.localStorage.removeItem(TUTOR_SUBMISSION_KEY);
    }
  }, []);

  const filtered = useMemo(() => {
    let result = [...submittedPeople, ...allPeople.filter((person) => !submittedPeople.some((submitted) => submitted.name === person.name))];

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (roleFilter) {
      result = result.filter((p) => getRole(p.title) === roleFilter);
    }

    if (skillFilter) {
      result = result.filter((p) => p.skills.some((s) => s.toLowerCase().includes(skillFilter.toLowerCase())));
    }

    if (format === "online") result = result.filter((p) => p.online);
    if (format === "inperson") result = result.filter((p) => !p.online);

    if (priceFilter === "free") result = result.filter((p) => p.price === "Free" || p.freeIntro);
    else if (priceFilter === "under_200k") result = result.filter((p) => parsePrice(p.price) < 200000);
    else if (priceFilter === "200k_400k") result = result.filter((p) => { const n = parsePrice(p.price); return n >= 200000 && n <= 400000; });
    else if (priceFilter === "400k_700k") result = result.filter((p) => { const n = parsePrice(p.price); return n >= 400000 && n <= 700000; });
    else if (priceFilter === "over_700k") result = result.filter((p) => parsePrice(p.price) > 700000);

    if (ratingFilter === "4.5") result = result.filter((p) => p.rating >= 4.5);
    else if (ratingFilter === "4") result = result.filter((p) => p.rating >= 4);

    if (availFilter === "this_week") result = result.filter((p) => p.available);
    if (verifiedFilter === "1") result = result.filter((p) => p.verified);
    if (locationFilter) result = result.filter((p) => p.location === locationFilter);

    if (sort === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") result.sort((a, b) => b.reviews - a.reviews);
    else if (sort === "price_asc") result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    else if (sort === "price_desc") result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    else if (sort === "experienced") result.sort((a, b) => b.learners - a.learners);

    return result;
  }, [submittedPeople, query, roleFilter, skillFilter, format, priceFilter, ratingFilter, availFilter, verifiedFilter, locationFilter, sort]);

  const activeFilters = [
    roleFilter ? { key: "role", label: roleFilter, value: roleFilter } : null,
    skillFilter ? { key: "skill", label: skillFilter, value: skillFilter } : null,
    format ? { key: "format", label: format === "online" ? "Online" : "In person", value: format } : null,
    priceFilter ? { key: "price", label: priceFilter, value: priceFilter } : null,
    ratingFilter ? { key: "rating", label: `${ratingFilter}+`, value: ratingFilter } : null,
    locationFilter ? { key: "location", label: locationFilter, value: locationFilter } : null,
    verifiedFilter ? { key: "verified", label: "Verified", value: "1" } : null,
    availFilter ? { key: "avail", label: "Available this week", value: "this_week" } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  const radioGroup = (name: string, current: string, key: string, options: { value: string; label: string }[]) => (
    <div className={styles.filterOptions}>
      {options.map((option) => <FilterRadio key={option.value || `all-${name}`} name={`people-${name}`} label={option.label} selected={current === option.value} onSelect={() => params.set(key, option.value)} />)}
    </div>
  );

  const filterPanel = (
    <div className={styles.filterPanel}>
      <details open><summary>Sort by</summary>{radioGroup("sort", sort, "sort", sortOptions)}</details>
      <details open><summary>Role</summary>{radioGroup("role", roleFilter, "role", [{ value: "", label: "All people" }, ...roles.map((role) => ({ value: role, label: role }))])}</details>
      <details open><summary>Skill</summary>{radioGroup("skill", skillFilter, "skill", [{ value: "", label: "All skills" }, ...allSkills.map((skill) => ({ value: skill, label: skill }))])}</details>
      <details open><summary>Format</summary>{radioGroup("format", format, "format", [{ value: "", label: "Any format" }, { value: "online", label: "Online" }, { value: "inperson", label: "In person" }])}</details>
      <details open><summary>Availability</summary>{radioGroup("availability", availFilter, "avail", [{ value: "", label: "Any availability" }, { value: "this_week", label: "Available this week" }])}</details>
      <details open><summary>Verification</summary>{radioGroup("verification", verifiedFilter, "verified", [{ value: "", label: "All people" }, { value: "1", label: "Verified only" }])}</details>
      <details open><summary>Rating</summary>{radioGroup("rating", ratingFilter, "rating", [{ value: "", label: "Any rating" }, { value: "4.5", label: "4.5 and up" }, { value: "4", label: "4.0 and up" }])}</details>
      <details open><summary>Location</summary>{radioGroup("location", locationFilter, "location", [{ value: "", label: "Any location" }, ...allLocations.map((location) => ({ value: location, label: location }))])}</details>
      <details open><summary>Price</summary>{radioGroup("price", priceFilter, "price", [{ value: "", label: "Any price" }, { value: "free", label: "Free introduction" }, { value: "under_200k", label: "Under 200,000₫" }, { value: "200k_400k", label: "200,000₫–400,000₫" }, { value: "400k_700k", label: "400,000₫–700,000₫" }, { value: "over_700k", label: "700,000₫+" }])}</details>
    </div>
  );

  return (
    <div className={`${styles.page} ${styles.solidBlackPage}`}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroTop}>
              <div className={styles.search}>
                <label htmlFor="people-search" className={styles.visuallyHidden}>Search people</label>
                <IconSearch size={18} />
                <input id="people-search" type="search" placeholder="Search by skill, name, or profession" value={query} onChange={(e) => params.set("q", e.target.value)} />
              </div>
            </div>
            <h1 className={styles.title}>Meet the <em>people</em> behind the knowledge.</h1>
          </div>
          <div className={styles.orbitStat} aria-label={`${filtered.length} people match the current filters`}>
            <div><strong>{filtered.length}</strong><span>people in this orbit</span></div>
          </div>
        </header>

        <div className={styles.mobileResultsTools}><button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button></div>
        {activeFilters.length > 0 && <div className={styles.activeFilters}><ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} /></div>}

        <div className={styles.resultsLayout}>
          <aside className={styles.filterSidebar} aria-label="Filter people"><div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>{filterPanel}</aside>
          <div className={styles.resultsColumn}>
        {filtered.length > 0 ? (
          <div className={styles.peopleGrid}>
            {filtered.map((person) => (
              <article
                key={person.name}
                className={styles.personCard}
              >
                <div className={styles.cardBody}>
                  <div className={styles.personCardHeader}>
                    <Link className={styles.personAvatar} href={`/profile/${encodeURIComponent(person.name)}`} aria-label={`View ${person.name}'s profile`}>
                      <Image src={person.image} alt={`${person.name}, ${person.title}`} fill unoptimized sizes="60px" />
                    </Link>
                    <div className={styles.personCardHeaderContent}>
                      <div className={styles.personNameRow}>
                        <h3><Link className={styles.cardTitle} href={`/profile/${encodeURIComponent(person.name)}`}>{person.name}</Link></h3>
                        {person.verified && <IconCircleCheck className={styles.nameVerified} size={16} aria-label="Verified profile" />}
                      </div>
                      <p className={styles.cardKicker}>{person.title}</p>
                    </div>
                    <span className={`${styles.availability} ${person.available ? styles.available : ""}`}>
                      {person.available ? "Available" : "Limited"}
                    </span>
                  </div>
                  <p className={styles.description}>{person.bio}</p>
                  <div className={styles.tagList}>
                    {person.skills.slice(0, 3).map((skill) => <span key={skill} className={styles.tag}>{skill}</span>)}
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.profileMeta}>
                      <span className={styles.metaItem}><IconStar size={14} className={styles.star} /><strong>{person.reviews ? person.rating : "New"}</strong></span>
                      <span className={styles.metaItem}><IconUsers size={14} />{person.learners ? person.learners.toLocaleString("en-US") : "New tutor"}</span>
                      <span className={styles.metaItem}>{person.online ? <IconGlobe size={14} /> : <IconMapPin size={14} />}{person.online ? "Online" : "In person"}</span>
                      <span className={styles.metaItem}><IconMapPin size={14} />{person.location}</span>
                    </div>
                    <div className={styles.priceRow}>
                      <span className={styles.price}><strong>{person.price}</strong><span>/ session</span></span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No people match your current filters.</div>
        )}

        {filtered.length > 0 && <div className={styles.loadArea}><button type="button" className={styles.loadMore}>Load more people</button></div>}
          </div>
        </div>
        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter people" resultCount={filtered.length} onClear={params.clear}>{filterPanel}</FilterDrawer>
      </main>
    </div>
  );
}
