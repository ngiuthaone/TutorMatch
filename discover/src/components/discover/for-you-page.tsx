"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { IconSearch, IconStar, IconClock, IconBookmark, IconHeart, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import { forYouItems } from "./for-you-data";
import styles from "./marketplace-pages.module.css";

const tabs = ["All", "People", "1-on-1", "Courses", "Posts", "Communities", "Events"];


const filterMap: Record<string, string> = {
  People: "One-on-one",
  "1-on-1": "One-on-one",
  Courses: "Course",
  Posts: "Article",
  Communities: "Community",
  Events: "Workshop",
};

const allTopics = [...new Set(forYouItems.filter((i) => i.topic).map((i) => i.topic!))];

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
    let result = [...forYouItems];

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
        <header className={styles.hero}><div><div className={styles.heroTop}><div className={styles.search}><label htmlFor="foryou-search" className={styles.visuallyHidden}>Search recommendations</label><IconSearch size={18} /><input id="foryou-search" type="search" placeholder="Search recommendations" value={query} onChange={(e) => params.set("q", e.target.value)} /></div></div><h1 className={styles.title}>Chosen for your <em>curiosity.</em></h1></div><div className={styles.orbitStat}><div><strong>{filtered.length}</strong><span>ideas in your orbit</span></div></div></header>
        <div className={styles.mobileResultsTools}><button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button></div>
        {activeFilters.length > 0 && <div className={styles.activeFilters}><ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} /></div>}
        <div className={styles.resultsLayout}><aside className={styles.filterSidebar} aria-label="Filter recommendations"><div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>{filterPanel}</aside><div className={styles.resultsColumn}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <a key={item.title} href="#" className="group relative rounded-2xl overflow-hidden transition-all duration-200" style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05), transparent 60%)" }} />
                <div className="aspect-[5/3] overflow-hidden bg-surface relative">
                  <Image src={item.image} alt={item.title} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-3 left-3 overflow-hidden rounded-md border border-white/35 bg-white/5 backdrop-blur-2xl shadow-xl shadow-black/10 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent">
                    <span className="relative block px-2 py-0.5 text-[10px] font-semibold text-white/90">{item.typeLabel}</span>
                  </div>
                  <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 transition-colors"><IconBookmark size={14} /></button>
                </div>
                <div className="p-5">
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
