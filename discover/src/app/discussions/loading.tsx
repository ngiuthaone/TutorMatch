import styles from "@/components/discover/discussions.module.css";

export default function DiscussionsLoading() {
  return (
    <div className="min-h-[100dvh] bg-[#070b12]">
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
          <div className={styles.logo}>T</div>
          <nav className={styles.nav}>
            <div className={`${styles.navLink} ${styles.navActive}`} />
            <div className={styles.navLink} />
            <div className={`${styles.navButton} ${styles.navCreate}`} />
            <div className={styles.navLink} />
            <div className={styles.navButton} />
            <div className={styles.navLink} />
          </nav>
        </aside>
        <main className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <h1>Discussions</h1>
          </header>
          <div className={styles.feedTabs}>
            <div className={`${styles.feedTab} ${styles.feedTabActive}`}>For you</div>
            <div className={styles.feedTab}>Following</div>
            <div className={styles.feedTab}>Communities</div>
            <div className={styles.feedTab}>Questions</div>
          </div>
          <div className={styles.utilityBar}>
            <div className={styles.contentTabs}>
              <div className={`${styles.contentTab} ${styles.contentTabActive}`}>Posts</div>
              <div className={styles.contentTab}>Articles</div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-surface" />
                  <div className="h-3 w-full rounded bg-surface" />
                  <div className="h-3 w-3/4 rounded bg-surface" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
