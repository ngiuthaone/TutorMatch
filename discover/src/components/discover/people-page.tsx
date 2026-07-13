"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  IconSearch, IconStar, IconMapPin, IconHeart,
  IconCircleCheck, IconUsers, IconGlobe, IconSparkles, IconAdjustmentsHorizontal,
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

const allPeople: Person[] = [
  { name: "Minh Anh", title: "Public Speaking Coach", skills: ["Public Speaking", "Communication", "Leadership"], bio: "Helped 200+ learners speak with confidence", rating: 4.9, reviews: 124, learners: 1200, price: "250,000 VND", online: true, verified: true, freeIntro: true, image: "https://picsum.photos/seed/minh-anh-p/200/200", location: "Cầu Giấy", available: true },
  { name: "Huy Tran", title: "Full-stack Developer", skills: ["JavaScript", "React", "Node.js", "Python"], bio: "8 years building web apps for startups", rating: 4.8, reviews: 89, learners: 890, price: "350,000 VND", online: true, verified: true, freeIntro: false, image: "https://picsum.photos/seed/huy-tran-p/200/200", location: "Ba Đình", available: true },
  { name: "Linh Nguyen", title: "English & IELTS Coach", skills: ["IELTS", "English", "TOEFL", "Academic Writing"], bio: "7.5 IELTS scorer, 5 years teaching", rating: 4.9, reviews: 156, learners: 2000, price: "200,000 VND", online: true, verified: true, freeIntro: true, image: "https://picsum.photos/seed/linh-nguyen-p/200/200", location: "Đống Đa", available: false },
  { name: "Duc Pham", title: "Photography Artist", skills: ["Photography", "Lightroom", "Photoshop", "Composition"], bio: "Commercial photographer, exhibition curator", rating: 4.7, reviews: 67, learners: 540, price: "400,000 VND", online: false, verified: false, freeIntro: false, image: "https://picsum.photos/seed/duc-pham-p/200/200", location: "Tây Hồ", available: true },
  { name: "Thu Ha", title: "Cooking Instructor", skills: ["Vietnamese Cuisine", "Baking", "French Culinary"], bio: "French culinary arts, 200+ classes taught", rating: 4.9, reviews: 203, learners: 3100, price: "300,000 VND", online: true, verified: true, freeIntro: true, image: "https://picsum.photos/seed/thu-ha-p/200/200", location: "Hoàn Kiếm", available: true },
  { name: "Quoc Anh", title: "Music Producer", skills: ["Music Production", "Ableton", "Sound Design", "Mixing"], bio: "Produced for top Vietnamese artists", rating: 4.6, reviews: 45, learners: 320, price: "500,000 VND", online: true, verified: false, freeIntro: false, image: "https://picsum.photos/seed/quoc-anh-p/200/200", location: "Cầu Giấy", available: false },
  { name: "Ngoc Tram", title: "Yoga & Meditation Coach", skills: ["Yoga", "Meditation", "Mindfulness", "Breathwork"], bio: "RYT-500 certified, 8 years of practice", rating: 4.8, reviews: 112, learners: 980, price: "220,000 VND", online: true, verified: true, freeIntro: true, image: "https://picsum.photos/seed/ngoc-tram-p/200/200", location: "Ba Đình", available: true },
  { name: "Bao Long", title: "Business Strategy Mentor", skills: ["Startups", "Strategy", "Marketing", "Fundraising"], bio: "Ex-VC, founded 2 successful startups", rating: 4.7, reviews: 78, learners: 650, price: "450,000 VND", online: true, verified: true, freeIntro: false, image: "https://picsum.photos/seed/bao-long-p/200/200", location: "Tây Hồ", available: true },
];

const allSkills = ["Public Speaking", "JavaScript", "IELTS", "Photography", "Cooking", "Music", "Yoga", "Business"];
const allLocations = ["Ba Đình", "Cầu Giấy", "Đống Đa", "Hai Bà Trưng", "Hoàn Kiếm", "Tây Hồ"];
const roles = ["Tutor", "Coach", "Mentor", "Creator", "Instructor"];

const parsePrice = (p: string) => parseInt(p.replace(/[^0-9]/g, ""));

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

  const filtered = useMemo(() => {
    let result = [...allPeople];

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
  }, [query, roleFilter, skillFilter, format, priceFilter, ratingFilter, availFilter, verifiedFilter, locationFilter, sort]);

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
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroTop}>
              <p className={styles.eyebrow}><IconSparkles size={15} />Tutoria people</p>
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
              <article key={person.name} className={styles.personCard}>
                <div className={styles.personImage}>
                  <Image src={person.image} alt={person.name} fill unoptimized sizes="(max-width: 420px) 100vw, 136px" />
                  {person.verified && <span className={styles.verified}><IconCircleCheck size={13} />Verified</span>}
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardKicker}>{person.title}</p>
                  <h3 className={styles.cardTitle}>{person.name}</h3>
                  <p className={styles.description}>{person.bio}</p>
                  <div className={styles.tagList}>
                    {person.skills.slice(0, 3).map((skill) => <span key={skill} className={styles.tag}>{skill}</span>)}
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}><IconStar size={14} className={styles.star} />{person.rating} ({person.reviews})</span>
                    <span className={styles.metaItem}><IconUsers size={14} />{person.learners.toLocaleString("en-US")} learners</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}>{person.online ? <IconGlobe size={14} /> : <IconMapPin size={14} />}{person.online ? "Online" : "In person"}</span>
                    {person.freeIntro && <span className={styles.status}>Free introduction</span>}
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>From {person.price}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.primaryButton}>View profile</button>
                    <button type="button" className={styles.iconButton} aria-label={`Save ${person.name}`}><IconHeart size={18} /></button>
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
