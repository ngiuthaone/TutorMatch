"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { IconSearch, IconStar, IconClock, IconUsers, IconBookmark, IconBook2, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import styles from "./marketplace-pages.module.css";

interface Course {
  title: string; instructor: string; category: string;
  lessons: number; duration: string; rating: number;
  students: number; level: string; price: string; image: string;
}

const allCourses: Course[] = [
  { title: "Complete Web Development Bootcamp 2026", instructor: "Huy Tran", category: "Technology", lessons: 48, duration: "16h", rating: 4.8, students: 1200, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/web-cat/400/240" },
  { title: "IELTS Speaking Masterclass", instructor: "Linh Nguyen", category: "Languages", lessons: 24, duration: "8h", rating: 4.9, students: 890, level: "Intermediate", price: "499,000 đ", image: "https://picsum.photos/seed/ielts-cat/400/240" },
  { title: "Public Speaking for Professionals", instructor: "Minh Anh", category: "Personal development", lessons: 16, duration: "6h", rating: 4.7, students: 650, level: "All levels", price: "350,000 đ", image: "https://picsum.photos/seed/speaking-cat/400/240" },
  { title: "Digital Photography Fundamentals", instructor: "Duc Pham", category: "Creative", lessons: 32, duration: "12h", rating: 4.8, students: 720, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/photo-cat/400/240" },
  { title: "Vietnamese Home Cooking", instructor: "Thu Ha", category: "Lifestyle", lessons: 20, duration: "10h", rating: 4.9, students: 2100, level: "Beginner", price: "299,000 đ", image: "https://picsum.photos/seed/cooking-cat/400/240" },
  { title: "Startup Fundamentals", instructor: "Bao Long", category: "Business", lessons: 12, duration: "5h", rating: 4.6, students: 430, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/startup-cat/400/240" },
  { title: "Advanced React & Next.js", instructor: "Huy Tran", category: "Technology", lessons: 36, duration: "14h", rating: 4.8, students: 560, level: "Advanced", price: "599,000 đ", image: "https://picsum.photos/seed/react-cat/400/240" },
  { title: "English for Beginners", instructor: "Linh Nguyen", category: "Languages", lessons: 30, duration: "20h", rating: 4.8, students: 3400, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/english-cat/400/240" },
  { title: "Music Production with Ableton", instructor: "Quoc Anh", category: "Creative", lessons: 28, duration: "18h", rating: 4.6, students: 320, level: "Intermediate", price: "750,000 đ", image: "https://picsum.photos/seed/music-cat/400/240" },
  { title: "Yoga for Beginners", instructor: "Ngoc Tram", category: "Sports", lessons: 40, duration: "15h", rating: 4.8, students: 980, level: "Beginner", price: "Free", image: "https://picsum.photos/seed/yoga-cat/400/240" },
  { title: "Makeup & Nail Art", instructor: "Phuong Anh", category: "Beauty", lessons: 18, duration: "7h", rating: 4.5, students: 410, level: "Beginner", price: "249,000 đ", image: "https://picsum.photos/seed/beauty-cat/400/240" },
  { title: "IELTS Writing Workshop", instructor: "Linh Nguyen", category: "Academic", lessons: 12, duration: "6h", rating: 4.7, students: 1100, level: "Intermediate", price: "399,000 đ", image: "https://picsum.photos/seed/writing-cat/400/240" },
];

const allLevels = ["Beginner", "Intermediate", "Advanced", "All levels"];

const parsePrice = (p: string) => p === "Free" ? 0 : parseInt(p.replace(/[^0-9]/g, ""));
const parseDuration = (d: string) => parseInt(d.replace(/[^0-9]/g, ""));

const sortOptions = [
  { value: "relevant", label: "Most relevant" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "shortest", label: "Shortest first" },
];

export function CoursesPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useFilterParams();
  const query = params.get("q", "");
  const levelFilter = params.get("level", "");
  const priceFilter = params.get("price", "");
  const durationFilter = params.get("duration", "");
  const categoryFilter = params.get("category", "");
  const ratingFilter = params.get("rating", "");
  const sort = params.get("sort", "relevant");

  const filtered = useMemo(() => {
    let result = [...allCourses];

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q));
    }

    if (levelFilter) result = result.filter((c) => c.level === levelFilter);
    if (categoryFilter) result = result.filter((c) => c.category === categoryFilter);

    if (priceFilter === "free") result = result.filter((c) => c.price === "Free");
    else if (priceFilter === "paid") result = result.filter((c) => c.price !== "Free");
    else if (priceFilter === "under_300k") result = result.filter((c) => { const p = parsePrice(c.price); return p > 0 && p < 300000; });
    else if (priceFilter === "300k_700k") result = result.filter((c) => { const p = parsePrice(c.price); return p >= 300000 && p <= 700000; });
    else if (priceFilter === "over_700k") result = result.filter((c) => parsePrice(c.price) > 700000);

    if (durationFilter === "under_1h") result = result.filter((c) => parseDuration(c.duration) < 1);
    else if (durationFilter === "1_3h") result = result.filter((c) => { const d = parseDuration(c.duration); return d >= 1 && d <= 3; });
    else if (durationFilter === "3_10h") result = result.filter((c) => { const d = parseDuration(c.duration); return d >= 3 && d <= 10; });
    else if (durationFilter === "10_20h") result = result.filter((c) => { const d = parseDuration(c.duration); return d >= 10 && d <= 20; });
    else if (durationFilter === "over_20h") result = result.filter((c) => parseDuration(c.duration) > 20);

    if (ratingFilter === "4.5") result = result.filter((c) => c.rating >= 4.5);
    else if (ratingFilter === "4") result = result.filter((c) => c.rating >= 4);

    if (sort === "popular") result.sort((a, b) => b.students - a.students);
    else if (sort === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") result.sort((a, b) => b.students - a.students);
    else if (sort === "newest") result.reverse();
    else if (sort === "price_asc") result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    else if (sort === "price_desc") result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    else if (sort === "shortest") result.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration));

    return result;
  }, [query, levelFilter, priceFilter, durationFilter, categoryFilter, ratingFilter, sort]);

  const activeFilters = [
    levelFilter ? { key: "level", label: levelFilter, value: levelFilter } : null,
    categoryFilter ? { key: "category", label: categoryFilter, value: categoryFilter } : null,
    priceFilter ? { key: "price", label: priceFilter, value: priceFilter } : null,
    durationFilter ? { key: "duration", label: durationFilter, value: durationFilter } : null,
    ratingFilter ? { key: "rating", label: `${ratingFilter}+`, value: ratingFilter } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  const filterPanel = (
    <div className={styles.filterPanel}>
      <details open>
        <summary>Sort by</summary>
        <div className={styles.filterOptions}>
          {sortOptions.map((option) => (
            <FilterRadio key={option.value} name="course-sort" label={option.label} selected={sort === option.value} onSelect={() => params.set("sort", option.value)} />
          ))}
        </div>
      </details>
      <details open>
        <summary>Category</summary>
        <div className={styles.filterOptions}>
          {["", "Technology", "Languages", "Business", "Creative", "Academic", "Personal development", "Lifestyle", "Sports", "Beauty"].map((value) => (
            <FilterRadio key={value || "all-categories"} name="course-category" label={value || "All categories"} selected={categoryFilter === value} onSelect={() => params.set("category", value)} />
          ))}
        </div>
      </details>
      <details open>
        <summary>Level</summary>
        <div className={styles.filterOptions}>
          {["", ...allLevels].map((value) => (
            <FilterRadio key={value || "all-levels"} name="course-level" label={value || "All levels"} selected={levelFilter === value} onSelect={() => params.set("level", value)} />
          ))}
        </div>
      </details>
      <details open>
        <summary>Rating</summary>
        <div className={styles.filterOptions}>
          {[{ value: "", label: "Any rating" }, { value: "4.5", label: "4.5 and up" }, { value: "4", label: "4.0 and up" }].map((option) => (
            <FilterRadio key={option.value || "any-rating"} name="course-rating" label={option.label} selected={ratingFilter === option.value} onSelect={() => params.set("rating", option.value)} />
          ))}
        </div>
      </details>
      <details open>
        <summary>Duration</summary>
        <div className={styles.filterOptions}>
          {[{ value: "", label: "Any duration" }, { value: "under_1h", label: "Under 1 hour" }, { value: "1_3h", label: "1–3 hours" }, { value: "3_10h", label: "3–10 hours" }, { value: "10_20h", label: "10–20 hours" }, { value: "over_20h", label: "20+ hours" }].map((option) => (
            <FilterRadio key={option.value || "any-duration"} name="course-duration" label={option.label} selected={durationFilter === option.value} onSelect={() => params.set("duration", option.value)} />
          ))}
        </div>
      </details>
      <details open>
        <summary>Price</summary>
        <div className={styles.filterOptions}>
          {[{ value: "", label: "Any price" }, { value: "free", label: "Free" }, { value: "under_300k", label: "Under 300,000₫" }, { value: "300k_700k", label: "300,000₫–700,000₫" }, { value: "over_700k", label: "700,000₫+" }].map((option) => (
            <FilterRadio key={option.value || "any-price"} name="course-price" label={option.label} selected={priceFilter === option.value} onSelect={() => params.set("price", option.value)} />
          ))}
        </div>
      </details>
    </div>
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroTop}>
              <div className={styles.search}>
                <label htmlFor="course-search" className={styles.visuallyHidden}>Search courses</label>
                <IconSearch size={18} />
                <input id="course-search" type="search" placeholder="Search courses or instructors" value={query} onChange={(e) => params.set("q", e.target.value)} />
              </div>
            </div>
            <h1 className={styles.title}>Turn curiosity into <em>craft.</em></h1>
          </div>
          <div className={styles.orbitStat} aria-label={`${filtered.length} courses match the current filters`}>
            <div><strong>{filtered.length}</strong><span>courses in this orbit</span></div>
          </div>
        </header>

        <div className={styles.mobileResultsTools}>
          <button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button>
        </div>

        {activeFilters.length > 0 && <div className={styles.activeFilters}>
          <ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} />
        </div>}

        <div className={`${styles.resultsLayout} ${styles.courseResultsLayout}`}>
          <aside className={styles.filterSidebar} aria-label="Filter courses">
            <div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>
            {filterPanel}
          </aside>
          <div className={styles.resultsColumn}>
          {filtered.length > 0 ? (
          <div className={`${styles.courseGrid} ${styles.courseGridWithSidebar}`}>
            {filtered.map((course) => (
              <article key={course.title} className={styles.courseCard}>
                <div className={styles.cardImage}>
                  <Image src={course.image} alt={course.title} fill unoptimized sizes="(max-width: 620px) 100vw, (max-width: 1100px) 50vw, 25vw" />
                  <span className={styles.mediaLabel}>{course.level}</span>
                  <button type="button" className={`${styles.iconButton} ${styles.mediaAction}`} aria-label={`Save ${course.title}`}><IconBookmark size={18} /></button>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardKicker}>{course.category}</p>
                  <a href="#" className={styles.cardTitle}>{course.title}</a>
                  <p className={styles.description}>Taught by {course.instructor}</p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}><IconClock size={14} />{course.duration}</span>
                    <span className={styles.metaItem}><IconBook2 size={14} />{course.lessons} lessons</span>
                    <span className={styles.metaItem}><IconStar size={14} className={styles.star} />{course.rating}</span>
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.metaItem}><IconUsers size={14} />{course.students.toLocaleString("en-US")}</span>
                    <span className={`${styles.price} ${course.price === "Free" ? styles.free : ""}`}>{course.price}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No courses found in this category.</div>
        )}

        {filtered.length > 0 && <div className={styles.loadArea}><button type="button" className={styles.loadMore}>Load more courses</button></div>}
          </div>
        </div>
        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter courses" resultCount={filtered.length} onClear={params.clear}>{filterPanel}</FilterDrawer>
      </main>
    </div>
  );
}
