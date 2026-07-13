"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { IconUsers, IconMessage2, IconBookmark, IconSparkles, IconSearch, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { useFilterParams } from "@/components/ui/use-filter-params";
import { ActiveFilters } from "@/components/ui/active-filters";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { FilterRadio } from "@/components/ui/filter-section";
import styles from "./marketplace-pages.module.css";

interface Community {
  name: string; description: string; members: number;
  active: string; topic: string; preview: string; image: string;
}

const tabs = ["For you", "Trending", "Local", "New", "Most active"];

const allCommunities: Community[] = [
  { name: "Young Founders Vietnam", description: "Build ideas, meet collaborators, and learn from early-stage founders.", members: 1200, active: "12 posts today", topic: "Business", image: "https://picsum.photos/seed/com-young/400/240", preview: "Anyone joining the pitch night next week?" },
  { name: "Hanoi Photography Walks", description: "Learn together, share work, and attend local photo walks every weekend.", members: 850, active: "8 posts today", topic: "Photography", image: "https://picsum.photos/seed/com-photo/400/240", preview: "Best spots for golden hour this season?" },
  { name: "IELTS Speaking Practice", description: "Find partners, exchange feedback, and practise consistently to improve.", members: 2100, active: "24 posts today", topic: "Languages", image: "https://picsum.photos/seed/com-ielts/400/240", preview: "Score 7.5+ study group forming now." },
  { name: "Vietnamese Creators Collective", description: "Supporting local creators to share, collaborate, and grow their audience.", members: 3400, active: "45 posts today", topic: "Creative", image: "https://picsum.photos/seed/com-creators/400/240", preview: "New podcast episode: monetization tips." },
  { name: "Code & Coffee Hanoi", description: "Weekly coding sessions with coffee, collaboration, and community.", members: 560, active: "5 posts today", topic: "Technology", image: "https://picsum.photos/seed/com-code/400/240", preview: "Next meetup: React performance workshop." },
  { name: "Startup Saigon Network", description: "Connect with founders, investors, and builders across Ho Chi Minh City.", members: 1800, active: "20 posts today", topic: "Business", image: "https://picsum.photos/seed/com-saigon/400/240", preview: "Seeking co-founder for edtech idea." },
  { name: "Vietnamese Foodies", description: "Share recipes, cooking tips, and restaurant recommendations nationwide.", members: 5200, active: "67 posts today", topic: "Lifestyle", image: "https://picsum.photos/seed/com-food/400/240", preview: "Best pho in Hanoi: the ultimate list." },
  { name: "Volunteer Vietnam", description: "Connect with volunteer projects and make a difference in local communities.", members: 900, active: "10 posts today", topic: "Volunteering", image: "https://picsum.photos/seed/com-volunteer/400/240", preview: "Teaching English in rural areas this summer." },
];

const allTopics = [...new Set(allCommunities.map((c) => c.topic))];

const parseActivity = (s: string) => {
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
};

const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "active", label: "Most active" },
  { value: "growing", label: "Fastest growing" },
  { value: "members", label: "Most members" },
  { value: "newest", label: "Newest" },
];

export function CommunitiesPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = useFilterParams();
  const query = params.get("q", "");
  const tab = params.get("tab", "For you");
  const topicFilter = params.get("topic", "");
  const sort = params.get("sort", "recommended");
  const filtered = useMemo(() => {
    let result = [...allCommunities];
    if (query) { const q = query.toLowerCase(); result = result.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q)); }

    if (topicFilter) result = result.filter((c) => c.topic === topicFilter);

    if (tab === "Trending") result.sort((a, b) => parseActivity(b.active) - parseActivity(a.active));
    else if (tab === "New") result.sort((a, b) => a.members - b.members);
    else if (tab === "Most active") result.sort((a, b) => parseActivity(b.active) - parseActivity(a.active));
    else if (tab === "Local") result = result.filter((c) => c.name.includes("Hanoi") || c.name.includes("Saigon"));

    if (sort === "active") result.sort((a, b) => parseActivity(b.active) - parseActivity(a.active));
    else if (sort === "members") result.sort((a, b) => b.members - a.members);
    else if (sort === "newest") result.sort((a, b) => a.members - b.members);

    return result;
  }, [query, tab, topicFilter, sort]);

  const activeFilters = [
    topicFilter ? { key: "topic", label: topicFilter, value: topicFilter } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];
  const group = (name: string, current: string, key: string, options: { value: string; label: string }[]) => <div className={styles.filterOptions}>{options.map((o) => <FilterRadio key={o.value || `all-${name}`} name={`community-${name}`} label={o.label} selected={current === o.value} onSelect={() => params.set(key, o.value)} />)}</div>;
  const filterPanel = <div className={styles.filterPanel}>
    <details open><summary>Sort by</summary>{group("sort", sort, "sort", sortOptions)}</details>
    <details open><summary>View</summary>{group("view", tab, "tab", tabs.map((value) => ({ value, label: value })))}</details>
    <details open><summary>Topic</summary>{group("topic", topicFilter, "topic", [{ value: "", label: "All topics" }, ...allTopics.map((value) => ({ value, label: value }))])}</details>
  </div>;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <div className={styles.heroTop}><p className={styles.eyebrow}><IconSparkles size={15} />Tutoria communities</p><div className={styles.search}><label htmlFor="community-search" className={styles.visuallyHidden}>Search communities</label><IconSearch size={18} /><input id="community-search" type="search" placeholder="Search communities or topics" value={query} onChange={(e) => params.set("q", e.target.value)} /></div></div>
            <h1 className={styles.title}>Find your people. <em>Grow together.</em></h1>
          </div>
          <div className={styles.orbitStat} aria-label={`${filtered.length} communities match the current filters`}>
            <div><strong>{filtered.length}</strong><span>communities in your orbit</span></div>
          </div>
        </header>

        <div className={styles.mobileResultsTools}><button type="button" className={styles.mobileFilterButton} onClick={() => setFiltersOpen(true)}><IconAdjustmentsHorizontal size={17} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</button></div>
        {activeFilters.length > 0 && <div className={styles.activeFilters}><ActiveFilters filters={activeFilters} onRemove={(key) => params.set(key, "")} onClear={params.clear} /></div>}
        <div className={styles.resultsLayout}><aside className={styles.filterSidebar} aria-label="Filter communities"><div className={styles.filterSidebarHeading}><span><IconAdjustmentsHorizontal size={17} /> Filters</span>{activeFilters.length > 0 && <button type="button" onClick={params.clear}>Clear</button>}</div>{filterPanel}</aside><div className={styles.resultsColumn}>

        {filtered.length > 0 ? (
          <div className={styles.communityGrid}>
            {filtered.map((com) => (
              <article key={com.name} className={styles.communityCard}>
                <div className={styles.communityImage}>
                  <Image src={com.image} alt={com.name} fill unoptimized sizes="(max-width: 620px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                  <span className={styles.mediaLabel}>{com.topic}</span>
                  <button type="button" className={`${styles.iconButton} ${styles.mediaAction}`} aria-label={`Save ${com.name}`}><IconBookmark size={18} /></button>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardKicker}>{com.topic}</p>
                  <h3 className={styles.cardTitle}>{com.name}</h3>
                  <p className={styles.description}>{com.description}</p>
                  <div className={styles.metaRow}>
                    <span className={styles.metaItem}><IconUsers size={14} />{com.members.toLocaleString("en-US")} members</span>
                    <span className={styles.status}>{com.active}</span>
                  </div>
                  <div className={styles.conversation}>
                    <IconMessage2 size={15} />
                    <span>&ldquo;{com.preview}&rdquo;</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.secondaryButton}>Join community</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No communities match your current filters.</div>
        )}

        {filtered.length > 0 && <div className={styles.loadArea}><button type="button" className={styles.loadMore}>Load more communities</button></div>}
        </div></div>
        <FilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter communities" resultCount={filtered.length} onClear={params.clear}>{filterPanel}</FilterDrawer>
      </main>
    </div>
  );
}
