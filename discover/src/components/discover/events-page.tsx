"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconCalendar, IconClock, IconMapPin, IconUsers, IconBookmark, IconSearch, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import { allEvents, PUBLISHED_EVENTS_EVENT, PUBLISHED_EVENTS_KEY, readPublishedEvents, type EventListing } from "@/lib/event-data";
import styles from "./marketplace-pages.module.css";

const quickTabs = ["All", "Near me", "Online", "Today", "This week", "This weekend", "Free"];

const allTopics = [...new Set(allEvents.map((event) => event.topic))];
const allLevels = ["Beginner", "Intermediate", "Advanced", "All levels"];

const parsePrice = (p: string) => p === "Free" ? 0 : parseInt(p.replace(/[^0-9]/g, ""));

const sortOptions = [
  { value: "soonest", label: "Soonest" },
  { value: "recommended", label: "Recommended" },
  { value: "nearest", label: "Nearest" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
];

export function EventsPage() {
  const [publishedEvents, setPublishedEvents] = useState<EventListing[]>([]);
  useEffect(() => {
    const refresh = () => setPublishedEvents(readPublishedEvents());
    const storage = (event: StorageEvent) => { if (event.key === PUBLISHED_EVENTS_KEY) refresh(); };
    refresh();
    window.addEventListener(PUBLISHED_EVENTS_EVENT, refresh);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(PUBLISHED_EVENTS_EVENT, refresh); window.removeEventListener("storage", storage); };
  }, []);
  const events = useMemo(() => [...publishedEvents, ...allEvents], [publishedEvents]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useFilterParams();
  const query = params.get("q", "");
  const tab = params.get("tab", "All");
  const format = params.get("format", "");
  const priceFilter = params.get("price", "");
  const topicFilter = params.get("topic", "");
  const levelFilter = params.get("level", "");
  const sort = params.get("sort", "soonest");

  const filtered = useMemo(() => {
    let result = [...events];
    if (query) { const q = query.toLowerCase(); result = result.filter((e) => e.title.toLowerCase().includes(q) || e.host.toLowerCase().includes(q) || e.topic?.toLowerCase().includes(q)); }

    if (tab === "Online") result = result.filter((e) => e.type === "Online");
    else if (tab === "Near me") result = result.filter((e) => e.type === "In person");
    else if (tab === "Free") result = result.filter((e) => e.price === "Free");

    if (format === "online") result = result.filter((e) => e.type === "Online");
    if (format === "inperson") result = result.filter((e) => e.type === "In person");

    if (priceFilter === "free") result = result.filter((e) => e.price === "Free");
    else if (priceFilter === "under_200k") result = result.filter((e) => { const p = parsePrice(e.price); return p > 0 && p < 200000; });
    else if (priceFilter === "200k_500k") result = result.filter((e) => { const p = parsePrice(e.price); return p >= 200000 && p <= 500000; });
    else if (priceFilter === "over_500k") result = result.filter((e) => parsePrice(e.price) > 500000);

    if (topicFilter) result = result.filter((e) => e.topic === topicFilter);
    if (levelFilter) result = result.filter((e) => e.level === levelFilter);

    if (sort === "popular") result.sort((a, b) => b.attending - a.attending);
    else if (sort === "newest") result.reverse();
    else if (sort === "price_asc") result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));

    return result;
  }, [events, query, tab, format, priceFilter, topicFilter, levelFilter, sort]);

  const activeFilters = [
    format ? { key: "format", label: format === "online" ? "Online" : "In person", value: format } : null,
    priceFilter ? { key: "price", label: priceFilter, value: priceFilter } : null,
    topicFilter ? { key: "topic", label: topicFilter, value: topicFilter } : null,
    levelFilter ? { key: "level", label: levelFilter, value: levelFilter } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];
  const group = (name: string, current: string, key: string, options: { value: string; label: string }[]) => <div className={styles.filterOptions}>{options.map((o) => <FilterRadio key={o.value || `all-${name}`} name={`event-${name}`} label={o.label} selected={current === o.value} onSelect={() => params.set(key, o.value)} />)}</div>;
  const filterPanel = <div className={styles.filterPanel}>
    <details open><summary>Sort by</summary>{group("sort", sort, "sort", sortOptions)}</details>
    <details open><summary>Date</summary>{group("date", tab, "tab", quickTabs.map((value) => ({ value, label: value })))}</details>
    <details open><summary>Format</summary>{group("format", format, "format", [{ value: "", label: "Any format" }, { value: "online", label: "Online" }, { value: "inperson", label: "In person" }])}</details>
    <details open><summary>Topic</summary>{group("topic", topicFilter, "topic", [{ value: "", label: "All topics" }, ...allTopics.map((value) => ({ value, label: value }))])}</details>
    <details open><summary>Level</summary>{group("level", levelFilter, "level", [{ value: "", label: "All levels" }, ...allLevels.map((value) => ({ value, label: value }))])}</details>
    <details open><summary>Price</summary>{group("price", priceFilter, "price", [{ value: "", label: "Any price" }, { value: "free", label: "Free" }, { value: "under_200k", label: "Under 200,000₫" }, { value: "200k_500k", label: "200,000₫-500,000₫" }, { value: "over_500k", label: "500,000₫+" }])}</details>
  </div>;

  return (
    <div className={`${styles.page} ${styles.solidBlackPage}`}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroTop}><div className={styles.search}><label htmlFor="event-search" className={styles.visuallyHidden}>Search events</label><IconSearch size={18} /><input id="event-search" type="search" placeholder="Search events, hosts, or topics" value={query} onChange={(e) => params.set("q", e.target.value)} /></div></div>
            <h1 className={styles.title}>Learn where <em>life happens.</em></h1>
          </div>
          <div className={styles.orbitStat} aria-label={`${filtered.length} events match the current filters`}>
            <div><strong>{filtered.length}</strong><span>events on the horizon</span></div>
          </div>
        </header>

        <div className={styles.mobileResultsTools}><button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button></div>
        {activeFilters.length > 0 && <div className={styles.activeFilters}><ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} /></div>}
        <div className={styles.resultsLayout}><aside className={styles.filterSidebar} aria-label="Filter events"><div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>{filterPanel}</aside><div className={styles.resultsColumn}>

        {filtered.length > 0 ? (
          <div className={styles.eventGrid}>
            {filtered.map((event) => {
              const remaining = event.capacity - event.attending;
              return (
                <article key={event.title} className={styles.eventCard}>
                  <Link className={styles.eventCardLink} href={`/events/${event.slug}`} aria-label={`View ${event.title}`} />
                  <div className={styles.eventImage}>
                    <Image src={event.image} alt={event.title} fill unoptimized sizes="(max-width: 420px) 100vw, 136px" />
                    <span className={styles.mediaLabel}>{event.type}</span>
                  </div>
                  <button type="button" className={`${styles.iconButton} ${styles.mediaAction} ${styles.eventSaveAction}`} aria-label={`Save ${event.title}`}><IconBookmark size={18} /></button>
                  <div className={styles.cardBody}>
                    <p className={styles.cardKicker}>{event.topic}</p>
                    <h2 className={styles.cardTitle}>{event.title}</h2>
                    <p className={styles.description}>Hosted by {event.host} · {event.level}</p>
                    <div className={styles.eventDetails}>
                      <span className={styles.metaItem}><IconCalendar size={14} />{event.date}</span>
                      <span className={styles.metaItem}><IconClock size={14} />{event.time}</span>
                      <span className={styles.metaItem}><IconMapPin size={14} />{event.location}</span>
                    </div>
                    <div className={styles.priceRow}>
                      <span className={styles.metaItem}><IconUsers size={14} />{event.attending}/{event.capacity}{remaining > 0 && remaining <= 5 && <span className={styles.capacity}>{remaining} left</span>}</span>
                      <span className={`${styles.price} ${event.price === "Free" ? styles.free : ""}`}>{event.price}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>No events match your current filters.</div>
        )}

        {filtered.length > 0 && <div className={styles.loadArea}><button type="button" className={styles.loadMore}>Load more events</button></div>}
        </div></div>
        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter events" resultCount={filtered.length} onClear={params.clear}>{filterPanel}</FilterDrawer>
      </main>
    </div>
  );
}
