"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { IconSearch, IconStar, IconClock, IconBookmark, IconHeart, IconSparkles, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import styles from "./marketplace-pages.module.css";

interface FeedItem {
  type: string; typeLabel: string; typeColor: string;
  title: string; author: string; meta: string;
  saves?: number; comments?: number; rating?: number;
  image: string; online?: boolean; price?: string; topic?: string;
}

const tabs = ["All", "People", "1-on-1", "Courses", "Posts", "Communities", "Events"];

const allItems: FeedItem[] = [
  { type: "Article", typeLabel: "ARTICLE", typeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", meta: "8 min read", saves: 234, comments: 18, image: "https://picsum.photos/seed/fyp-photo/400/240", online: true, price: "Free", topic: "Photography" },
  { type: "One-on-one", typeLabel: "ONE-ON-ONE", typeColor: "bg-primary/10 text-primary-dark dark:text-primary-light", title: "Public speaking: from nervous to natural in 30 days", author: "Minh Anh", meta: "6 sessions", image: "https://picsum.photos/seed/fyp-speaking/400/240", online: true, price: "Paid", topic: "Personal development" },
  { type: "Course", typeLabel: "COURSE", typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", title: "Complete web development bootcamp 2026", author: "Huy Tran", meta: "48 lessons", rating: 4.8, image: "https://picsum.photos/seed/fyp-web/400/240", online: true, price: "Paid", topic: "Technology" },
  { type: "Community", typeLabel: "COMMUNITY", typeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", title: "Young Founders Vietnam", author: "Build ideas, meet collaborators", meta: "1,200 members", image: "https://picsum.photos/seed/fyp-founders/400/240", topic: "Business" },
  { type: "Workshop", typeLabel: "WORKSHOP", typeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", title: "Beginner pottery: make your first cup", author: "Thu Ha", meta: "Sat, 2:00 PM", image: "https://picsum.photos/seed/fyp-pottery/400/240", online: false, price: "Paid", topic: "Creative arts" },
  { type: "Article", typeLabel: "ARTICLE", typeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", meta: "6 min read", saves: 412, comments: 37, image: "https://picsum.photos/seed/fyp-ielts/400/240", online: true, price: "Free", topic: "Languages" },
  { type: "Course", typeLabel: "COURSE", typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", title: "IELTS Speaking Masterclass", author: "Linh Nguyen", meta: "24 lessons", rating: 4.9, image: "https://picsum.photos/seed/fyp-masterclass/400/240", online: true, price: "Paid", topic: "Languages" },
  { type: "Community", typeLabel: "COMMUNITY", typeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", title: "Hanoi Photography Walks", author: "Photo walks every weekend", meta: "850 members", image: "https://picsum.photos/seed/fyp-photowalk/400/240", topic: "Photography" },
  { type: "One-on-one", typeLabel: "ONE-ON-ONE", typeColor: "bg-primary/10 text-primary-dark dark:text-primary-light", title: "Coding mentorship with Huy", author: "Huy Tran", meta: "Hourly sessions", image: "https://picsum.photos/seed/fyp-mentor/400/240", online: true, price: "Paid", topic: "Technology" },
  { type: "Workshop", typeLabel: "WORKSHOP", typeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", title: "Startup Networking Night", author: "Bao Long", meta: "Fri, 6:30 PM", image: "https://picsum.photos/seed/fyp-networking/400/240", online: false, price: "Free", topic: "Business" },
];

const filterMap: Record<string, string> = {
  People: "One-on-one",
  "1-on-1": "One-on-one",
  Courses: "Course",
  Posts: "Article",
  Communities: "Community",
  Events: "Workshop",
};

const allTopics = [...new Set(allItems.filter((i) => i.topic).map((i) => i.topic!))];

const sortOptions = [
  { value: "match", label: "Best match" },
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "saved", label: "Most saved" },
  { value: "rating", label: "Highest rated" },
];

export function ForYouPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useFilterParams();
  const tab = params.get("tab", "All");
  const query = params.get("q", "");
  const format = params.get("format", "");
  const priceFilter = params.get("price", "");
  const topicFilter = params.get("topic", "");
  const sort = params.get("sort", "match");

  const filtered = useMemo(() => {
    let result = [...allItems];

    if (tab !== "All" && filterMap[tab]) {
      result = result.filter((i) => i.type === filterMap[tab]);
    }

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q));
    }

    if (format === "online") result = result.filter((i) => i.online !== false);
    if (format === "inperson") result = result.filter((i) => i.online === false);
    if (priceFilter === "free") result = result.filter((i) => i.price === "Free");
    if (priceFilter === "paid") result = result.filter((i) => i.price === "Paid");
    if (topicFilter) result = result.filter((i) => i.topic === topicFilter);

    if (sort === "saved") result.sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0));
    else if (sort === "rating") result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sort === "newest") result.reverse();

    return result;
  }, [tab, query, format, priceFilter, topicFilter, sort]);

  const activeFilters = [
    format ? { key: "format", label: format === "online" ? "Online" : "In person", value: format } : null,
    priceFilter ? { key: "price", label: priceFilter === "free" ? "Free" : "Paid", value: priceFilter } : null,
    topicFilter ? { key: "topic", label: topicFilter, value: topicFilter } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];
  const group = (name: string, current: string, key: string, options: { value: string; label: string }[]) => <div className={styles.filterOptions}>{options.map((o) => <FilterRadio key={o.value || `all-${name}`} name={`foryou-${name}`} label={o.label} selected={current === o.value} onSelect={() => params.set(key, o.value)} />)}</div>;
  const filterPanel = <div className={styles.filterPanel}>
    <details open><summary>Sort by</summary>{group("sort", sort, "sort", sortOptions)}</details>
    <details open><summary>Content type</summary>{group("type", tab, "tab", tabs.map((value) => ({ value, label: value })))}</details>
    <details open><summary>Topic</summary>{group("topic", topicFilter, "topic", [{ value: "", label: "All topics" }, ...allTopics.map((value) => ({ value, label: value }))])}</details>
    <details open><summary>Format</summary>{group("format", format, "format", [{ value: "", label: "Any format" }, { value: "online", label: "Online" }, { value: "inperson", label: "In person" }])}</details>
    <details open><summary>Price</summary>{group("price", priceFilter, "price", [{ value: "", label: "Any price" }, { value: "free", label: "Free" }, { value: "paid", label: "Paid" }])}</details>
  </div>;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}><div><div className={styles.heroTop}><p className={styles.eyebrow}><IconSparkles size={15} />For you</p><div className={styles.search}><label htmlFor="foryou-search" className={styles.visuallyHidden}>Search recommendations</label><IconSearch size={18} /><input id="foryou-search" type="search" placeholder="Search recommendations" value={query} onChange={(e) => params.set("q", e.target.value)} /></div></div><h1 className={styles.title}>Chosen for your <em>curiosity.</em></h1></div><div className={styles.orbitStat}><div><strong>{filtered.length}</strong><span>ideas in your orbit</span></div></div></header>
        <div className={styles.mobileResultsTools}><button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button></div>
        {activeFilters.length > 0 && <div className={styles.activeFilters}><ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} /></div>}
        <div className={styles.resultsLayout}><aside className={styles.filterSidebar} aria-label="Filter recommendations"><div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>{filterPanel}</aside><div className={styles.resultsColumn}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <a key={item.title} href="#" className="group rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden">
                <div className="aspect-[5/3] overflow-hidden bg-surface relative">
                  <Image src={item.image} alt={item.title} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className={`absolute top-3 left-3 px-2 py-0.5 text-[10px] font-semibold rounded-md ${item.typeColor}`}>{item.typeLabel}</span>
                  <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 transition-colors"><IconBookmark size={14} /></button>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-xs text-muted mt-1.5">{item.author}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                    <div className="flex items-center gap-1"><IconClock size={12} /><span>{item.meta}</span></div>
                    {item.rating !== undefined && <div className="flex items-center gap-1"><IconStar size={12} className="text-amber-400 fill-amber-400" /><span>{item.rating}</span></div>}
                  </div>
                  {item.saves !== undefined && item.saves > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                      <div className="flex items-center gap-1"><IconBookmark size={12} /><span>{item.saves}</span></div>
                      {item.comments !== undefined && item.comments > 0 && <div className="flex items-center gap-1"><IconHeart size={12} /><span>{item.comments}</span></div>}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-sm text-muted border border-dashed border-border rounded-2xl">No results match your current filters.</div>
          )}

          {filtered.length > 0 && (
            <div className="mt-8 text-center">
              <button className="px-6 py-2.5 text-sm font-medium rounded-xl border border-border text-foreground hover:bg-surface transition-colors">Load more</button>
            </div>
          )}
        </div></div>
        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter recommendations" resultCount={filtered.length} onClear={params.clear}>{filterPanel}</FilterDrawer>
      </main>
    </div>
  );
}
