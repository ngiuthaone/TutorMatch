"use client";

import { useState, useEffect, useCallback } from "react";
import { IconHeart, IconHeartFilled, IconMessage2, IconBookmark, IconBookmarkFilled, IconShare, IconRepeat, IconX, IconPlus, IconUserPlus, IconUserCheck, IconSearch, IconHome, IconBell, IconUser, IconMenu2, IconDots } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PostComposer } from "@/components/discussion/post-composer";
import { CommentThread } from "@/components/discussion/comment-thread";
import { getPublishedPosts, getPublishedArticles } from "@/lib/storage";
import type { PublishedPost, PublishedArticle } from "@/lib/types";
import styles from "./discussions.module.css";

const ALL_TAGS = ["Photography", "IELTS", "Languages", "Business", "Technology", "Creative", "Cooking", "Personal development", "Academic", "Community"];
const publicProfileHref = (name: string) =>
  `http://localhost:4173/profile-preview.html?name=${encodeURIComponent(name)}`;

const POSTS = [
  { id: "p1", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Golden hour at West Lake today. The light was absolutely incredible \u{1F305}\n\nSometimes you just need to stop and appreciate the moment.", image: "https://picsum.photos/seed/golden-hour/600/400", likes: 142, comments: 8, tags: ["Photography"], createdAt: "1h ago" },
  { id: "p2", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "Just finished a 2-hour speaking session with a student who went from total silence to a full 7-minute monologue. This is why I love teaching.", likes: 89, comments: 12, tags: ["IELTS", "Languages"], createdAt: "3h ago" },
  { id: "p3", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Made ph\u1EDF for 20 people today. My kitchen smells like heaven. Recipe drop in the comments if anyone wants it", image: "https://picsum.photos/seed/pho-bowl/600/400", likes: 203, comments: 24, tags: ["Cooking"], createdAt: "5h ago" },
  { id: "p4", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Hot take: TypeScript is great but sometimes I miss the chaos of writing plain JS. Anyone else?", likes: 67, comments: 31, tags: ["Technology"], createdAt: "7h ago" },
  { id: "p5", author: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/60/60", content: "Just wrapped a workshop on impromptu speaking. One tip that blew everyone's mind: pause before answering. It makes you look confident, not hesitant.", likes: 156, comments: 14, tags: ["Personal development"], createdAt: "10h ago" },
  { id: "p6", author: "Bao Long", role: "Business Strategy Mentor", avatar: "https://picsum.photos/seed/bao-avatar/60/60", content: "Read 50 startup pitch decks this week. The ones that stood out had one thing in common: they explained the problem like you've lived it.", image: "https://picsum.photos/seed/pitch-deck/600/400", likes: 95, comments: 7, tags: ["Business"], createdAt: "12h ago" },
  { id: "p7", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Trying film photography for the first time. 36 shots. No preview. No delete button. It's terrifying and I love it", likes: 178, comments: 22, tags: ["Photography"], createdAt: "1d ago" },
  { id: "p8", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "New resource drop: I compiled 50 IELTS speaking Part 2 topics with model answers. Free link in bio. Go practice!", likes: 312, comments: 45, tags: ["IELTS", "Languages"], createdAt: "1d ago" },
  { id: "p9", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Weekend baking project: b\u00E1nh m\u00EC from scratch. Took 3 attempts but finally got that perfect crust. Never giving up", image: "https://picsum.photos/seed/banh-mi/600/400", likes: 134, comments: 18, tags: ["Cooking"], createdAt: "2d ago" },
  { id: "p10", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Shipped a side project in 48 hours. Vibe coding is real y'all. AI wrote 70% of it and I'm not even embarrassed.", likes: 221, comments: 36, tags: ["Technology"], createdAt: "2d ago" },
];

const postComments: Record<string, { author: string; role: string; avatar: string; content: string; createdAt: string }[]> = {
  p1: [
    { author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Stunning. Which lens did you use?", createdAt: "45m ago" },
    { author: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/60/60", content: "West Lake never disappoints", createdAt: "30m ago" },
  ],
  p2: [
    { author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "That's amazing progress. Love seeing wins like this!", createdAt: "2h ago" },
    { author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "The best feeling as a teacher", createdAt: "1h ago" },
  ],
  p3: [
    { author: "Bao Long", role: "Business Strategy Mentor", avatar: "https://picsum.photos/seed/bao-avatar/60/60", content: "Please drop the recipe! That looks incredible.", createdAt: "4h ago" },
    { author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "My mouth is watering just looking at this", createdAt: "3h ago" },
    { author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "Hosting a ph\u1EDF party sounds like the best idea ever.", createdAt: "2h ago" },
  ],
};

const BLOGS = [
  { id: "b1", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", role: "Photography Artist", excerpt: "After teaching photography workshops for 5 years, I've seen the same patterns. Here's what holds beginners back.", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
  { id: "b2", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", role: "English & IELTS Coach", excerpt: "Three months of consistent practice. The key insight that changed everything for me.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
  { id: "b3", title: "What I wish I knew before starting a small business", author: "Huy Tran", role: "Full-stack Developer", excerpt: "Four years in, here are the hard lessons about regulations, hiring, and why co-founders matter.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
  { id: "b4", title: "Beginner guide to arranging flowers at home", author: "Thu Ha", role: "Cooking Instructor", excerpt: "You don't need expensive tools to create beautiful arrangements. Here's my go-to method.", likes: 156, comments: 12, tags: ["Creative"], createdAt: "3d ago", readTime: "5 min read", image: "https://picsum.photos/seed/post-flowers/400/240" },
  { id: "b5", title: "React Server Components explained simply", author: "Huy Tran", role: "Full-stack Developer", excerpt: "Server Components never send JS to the client. Here's when and why you'd use them.", likes: 320, comments: 45, tags: ["Technology"], createdAt: "1d ago", readTime: "12 min read", image: "https://picsum.photos/seed/post-react/400/240" },
  { id: "b6", title: "How to stay consistent with language learning", author: "Linh Nguyen", role: "English & IELTS Coach", excerpt: "Consistency beats intensity. Daily micro-habits that actually work.", likes: 278, comments: 31, tags: ["Languages", "Personal development"], createdAt: "4d ago", readTime: "4 min read", image: "https://picsum.photos/seed/post-language/400/240" },
  { id: "b7", title: "IELTS Reading: 7 tips for skimming effectively", author: "Linh Nguyen", role: "English & IELTS Coach", excerpt: "Stop reading every word. These 7 techniques save precious time.", likes: 521, comments: 63, tags: ["IELTS", "Academic"], createdAt: "6d ago", readTime: "7 min read", image: "https://picsum.photos/seed/post-reading/400/240" },
  { id: "b8", title: "Why you should start a community project", author: "Bao Long", role: "Business Strategy Mentor", excerpt: "We started a clean-up group. A year later it's a registered NGO.", likes: 112, comments: 15, tags: ["Community"], createdAt: "1w ago", readTime: "9 min read", image: "https://picsum.photos/seed/post-community/400/240" },
  { id: "b9", title: "Photography composition cheat sheet", author: "Duc Pham", role: "Photography Artist", excerpt: "Rule of thirds, leading lines, symmetry \u2014 a cheat sheet for every shoot.", likes: 445, comments: 28, tags: ["Photography"], createdAt: "2d ago", readTime: "3 min read", image: "https://picsum.photos/seed/post-composition/400/240" },
  { id: "b10", title: "Building a personal brand without burning out", author: "Minh Anh", role: "Public Speaking Coach", excerpt: "I grew from zero to 50K while working full-time. It's about having a system.", likes: 167, comments: 22, tags: ["Personal development"], createdAt: "5d ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-brand/400/240" },
  { id: "b11", title: "Coding interview prep guide for 2026", author: "Huy Tran", role: "Full-stack Developer", excerpt: "More system design, less leetcode. What to focus on this year.", likes: 289, comments: 41, tags: ["Technology"], createdAt: "3d ago", readTime: "15 min read", image: "https://picsum.photos/seed/post-interview/400/240" },
  { id: "b12", title: "How to start a conversation in any language", author: "Linh Nguyen", role: "English & IELTS Coach", excerpt: "5 conversation starters that work in any language. Connection over perfection.", likes: 198, comments: 19, tags: ["Languages"], createdAt: "1w ago", readTime: "5 min read", image: "https://picsum.photos/seed/post-conversation/400/240" },
];

export function DiscussionsPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [tab, setTab] = useState<"posts" | "blogs">((params.get("tab") as "posts" | "blogs") || "posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedMode, setFeedMode] = useState<"foryou" | "following" | "communities" | "questions">("foryou");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search);
    if (s.get("q")) setSearchQuery(s.get("q") || "");
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("sort");
    if (searchQuery) url.searchParams.set("q", searchQuery);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, [tab, searchQuery]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
          <Link href="/discover" className={styles.logo} aria-label="Tutoria home">T</Link>
          <nav className={styles.nav}>
            <Link href="/discussions" className={`${styles.navLink} ${styles.navActive}`} aria-label="Home"><IconHome size={25} stroke={1.8} /></Link>
            <Link href="/search" className={styles.navLink} aria-label="Search"><IconSearch size={25} stroke={1.8} /></Link>
            <button className={`${styles.navButton} ${styles.navCreate}`} aria-label="Create a post" onClick={() => window.dispatchEvent(new CustomEvent("tutoria:create-post"))}><IconPlus size={27} stroke={1.8} /></button>
            <Link href="/discussions/saved" className={styles.navLink} aria-label="Saved"><IconBookmark size={25} stroke={1.8} /></Link>
            <button className={styles.navButton} aria-label="Notifications"><IconHeart size={25} stroke={1.8} /></button>
            <Link href="/profile/me" className={styles.navLink} aria-label="Profile"><IconUser size={25} stroke={1.8} /></Link>
          </nav>
          <div className={styles.navBottom}><button className={styles.navButton} aria-label="More options"><IconMenu2 size={25} stroke={1.8} /></button></div>
        </aside>

        <main className={styles.feedColumn}>
          <header className={styles.feedHeader}>
            <h1 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Discussions</h1>
            <button className={styles.headerAction} aria-label="Notifications"><IconBell size={21} stroke={1.7} /></button>
          </header>

          <div className={styles.feedTabs} role="tablist" aria-label="Discussion feed">
            {(["foryou", "following", "communities", "questions"] as const).map((mode) => (
              <button key={mode} role="tab" aria-selected={feedMode === mode} onClick={() => setFeedMode(mode)} className={`${styles.feedTab} ${feedMode === mode ? styles.feedTabActive : ""}`}>
                {mode === "foryou" ? "For you" : mode === "following" ? "Following" : mode === "communities" ? "Communities" : "Questions"}
              </button>
            ))}
          </div>

          <div className={styles.utilityBar}>
            <div className={styles.contentTabs} role="tablist" aria-label="Content type">
              <button role="tab" aria-selected={tab === "posts"} onClick={() => setTab("posts")} className={`${styles.contentTab} ${tab === "posts" ? styles.contentTabActive : ""}`}>Posts</button>
              <button role="tab" aria-selected={tab === "blogs"} onClick={() => setTab("blogs")} className={`${styles.contentTab} ${tab === "blogs" ? styles.contentTabActive : ""}`}>Articles</button>
            </div>
          </div>

          <div className="sr-only">
            <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search discussions\u2026"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                <IconX size={14} />
              </button>
            )}
          </div>
          {tab === "posts" ? (
            <PostsTab searchQuery={searchQuery} feedMode={feedMode} />
          ) : (
            <BlogsTab searchQuery={searchQuery} feedMode={feedMode} />
          )}
        </main>

        <aside className={styles.rightRail} aria-label="Discover more">
          <section className={styles.railCard}>
            <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Join the conversation</h2>
            <p>Share what you know, ask thoughtful questions, and learn with the Tutoria community.</p>
            <Link href="/auth/sign-up" className={styles.railPrimary}>Join Tutoria</Link>
          </section>
          <section className={styles.railCard}>
            <h2 style={{ fontFamily: "var(--font-sans), Inter, sans-serif" }}>Trending today</h2>
            <Link href="/discussions/tags/Photography" className={styles.railLink}>Photography <span>328 posts</span></Link>
            <Link href="/discussions/tags/IELTS" className={styles.railLink}>IELTS practice <span>214 posts</span></Link>
            <Link href="/discussions/tags/Technology" className={styles.railLink}>Technology <span>186 posts</span></Link>
            <Link href="/communities" className={styles.railLink}>Explore communities <span>View all</span></Link>
          </section>
          <p className={styles.railFooter}>© 2026 Tutoria · Community guidelines · Privacy · Terms</p>
        </aside>

        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          <Link href="/discussions" className={`${styles.mobileNavLink} ${styles.mobileNavLinkActive}`} aria-label="Home"><IconHome size={23} /></Link>
          <Link href="/search" className={styles.mobileNavLink} aria-label="Search"><IconSearch size={23} /></Link>
          <button className={`${styles.mobileNavLink} ${styles.mobileCreate}`} aria-label="Create a post" onClick={() => window.dispatchEvent(new CustomEvent("tutoria:create-post"))}><IconPlus size={25} /></button>
          <Link href="/discussions/saved" className={styles.mobileNavLink} aria-label="Saved"><IconBookmark size={23} /></Link>
          <Link href="/profile/me" className={styles.mobileNavLink} aria-label="Profile"><IconUser size={23} /></Link>
        </nav>
      </div>
    </div>
  );
}

function PostsTab({ searchQuery, feedMode }: {
  searchQuery: string;
  feedMode: "foryou" | "following" | "communities" | "questions";
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedPost, setSelectedPost] = useState<typeof POSTS[0] | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composePreselect, setComposePreselect] = useState<string | undefined>();

  const [likes, setLikes] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tutoria_likes") || "[]")); } catch { return new Set(); }
  });
  const [saves, setSaves] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tutoria_saves") || "[]")); } catch { return new Set(); }
  });
  const [following, setFollowing] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_following") || "[]"); } catch { return []; }
  });
  const [userPosts, setUserPosts] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_user_posts") || "[]"); } catch { return []; }
  });
  const [followedTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_followed_tags") || "[]"); } catch { return []; }
  });
  const [userName, setUserName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tutoria_signup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.name) setUserName(parsed.name);
      }
    } catch {}
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLikes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("tutoria_likes", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSaves(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("tutoria_saves", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleFollow = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowing(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      localStorage.setItem("tutoria_following", JSON.stringify(next));
      return next;
    });
  }, []);

  const addUserPost = useCallback((post: any) => {
    setUserPosts(prev => {
      const next = [post, ...prev];
      localStorage.setItem("tutoria_user_posts", JSON.stringify(next));
      return next;
    });
  }, []);

  const liked = likes;
  const saved = saves;

  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);

  useEffect(() => {
    setPublishedPosts(getPublishedPosts());
  }, []);

  useEffect(() => {
    const openComposer = () => {
      if (localStorage.getItem("tutoria_signup")) setShowCompose(true);
      else router.push("/auth/sign-in?next=/discussions");
    };
    window.addEventListener("tutoria:create-post", openComposer);
    return () => window.removeEventListener("tutoria:create-post", openComposer);
  }, []);

  let feed: any[] = [...publishedPosts.map((p) => ({
    id: p.id, author: p.authorName, role: p.authorRole || "Learner",
    avatar: p.authorAvatar || `https://picsum.photos/seed/${p.authorName}/60/60`,
    content: p.body, image: p.attachments.find((a) => a.type === "image")?.url || null,
    likes: p.likes, comments: p.comments, tags: p.topicName ? [p.topicName] : [],
    createdAt: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  })), ...POSTS];

  if (feedMode === "following" && following.length > 0) {
    feed = feed.filter(p => following.includes(p.author));
  } else if (feedMode === "communities" && followedTags.length > 0) {
    feed = feed.filter((p: any) => (p.tags || []).some((t: string) => followedTags.includes(t)));
  } else if (feedMode === "questions") {
    feed = feed.filter((p: any) => (p.content || "").includes("?"));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    feed = feed.filter((p: any) =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }

  const allFeed = (feedMode === "following" && following.length === 0) || (feedMode === "communities" && followedTags.length === 0) ? [] : feed;

  return (
    <>
      <div>
        {feedMode === "following" && following.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted">You're not following anyone yet.</p>
            <p className="text-xs text-muted mt-1">Tap the <IconUserPlus size={12} className="inline" /> button on posts to follow creators.</p>
          </div>
        )}

        {feedMode === "communities" && followedTags.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted">Follow topics to see community content.</p>
            <p className="text-xs text-muted mt-1">Tap tags above to follow topics that interest you.</p>
          </div>
        )}

        <div className={styles.postList}>
          {userPosts.map((up, i) => (
            <div key={`user-${i}`} className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{userName?.charAt(0)?.toUpperCase() || "Y"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-foreground">{userName || "You"}</span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light font-medium">You</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-muted">Just now</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-line">{up.content}</p>
                  <div className="flex items-center gap-1.5 mt-3">
                    {up.tags?.map((t: string) => (
                      <a key={t} href={`/discussions/tags/${encodeURIComponent(t)}`}
                        className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light hover:bg-primary/20 transition-colors">{t}</a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {allFeed.slice(0, visibleCount).map((post) => {
            const isLiked = liked.has(post.id);
            const isFollowing = following.includes(post.author);

            return (
              <div key={post.id} onClick={() => setSelectedPost(post)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelectedPost(post); }}
                className={styles.post}>
                  <div className={styles.avatarRail} onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(post.author)); }}>
                    <img src={post.avatar} alt={`${post.author}'s profile`} loading="lazy" width="40" height="40" />
                    <span className={styles.threadLine} aria-hidden="true" />
                  </div>
                  <div className={styles.postBody}>
                    <div className={styles.postMeta}>
                      <button onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(post.author)); }}
                        className={styles.author}>{post.author}</button>
                      <span className={styles.role}>· {post.role}</span>
                      <span className={styles.time}>· {post.createdAt}</span>
                      <button onClick={(e) => { e.stopPropagation(); toggleFollow(post.author, e); }} className={styles.moreButton} aria-label={isFollowing ? `Unfollow ${post.author}` : `More options for ${post.author}`}>
                        {isFollowing ? <IconUserCheck size={18} /> : <IconDots size={20} />}
                      </button>
                    </div>
                    <p className={styles.postCopy}>{post.content}</p>
                    {post.image && (
                      <img src={post.image} alt={`Post by ${post.author}`} className={styles.postImage} loading="lazy" width="600" height="400" />
                    )}
                    <div className={styles.tags}>
                      {(post.tags || []).map((t: string) => (
                        <button key={t} onClick={(e) => { e.stopPropagation(); router.push(`/discussions/tags/${encodeURIComponent(t)}`); }} className={styles.tag}>#{t.replaceAll(" ", "")}</button>
                      ))}
                    </div>
                    <div className={styles.postActions}>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                        className={`${styles.action} ${isLiked ? styles.actionLiked : ""}`} aria-label={`${isLiked ? "Unlike" : "Like"} post`}>
                        {isLiked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
                        <span className="tabular-nums">{post.likes + (isLiked ? 1 : 0)}</span>
                      </button>
                      <div onClick={(e) => e.stopPropagation()}
                        className={styles.action} aria-label="View replies">
                        <IconMessage2 size={17} />
                        <span className="tabular-nums">{post.comments}</span>
                      </div>
                      <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="Repost post">
                        <IconRepeat size={18} />
                        <span className="tabular-nums">{post.reposts ?? Math.max(1, Math.round(post.comments / 8))}</span>
                      </button>
                      <button onClick={(e) => e.stopPropagation()}
                        className={styles.action} aria-label="Share post">
                        <IconShare size={18} />
                        <span className="tabular-nums">{post.shares ?? Math.max(1, Math.round(post.likes / 36))}</span>
                      </button>
                    </div>
                  </div>
              </div>
            );
          })}
        </div>

        {visibleCount < allFeed.length && (
          <button onClick={() => setVisibleCount((c) => c + 10)} className={styles.loadMore}>Load more</button>
        )}

        {allFeed.length === 0 && feedMode !== "following" && feedMode !== "communities" && !searchQuery && (
          <div className={styles.empty}>No posts yet. Be the first to share something!</div>
        )}

        {allFeed.length === 0 && searchQuery.trim() && (
          <div className={styles.empty}>
            No results for &ldquo;{searchQuery}&rdquo;. Try a different search.
          </div>
        )}

        {feedMode === "following" && following.length > 0 && allFeed.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted">No posts from followed creators.</p>
          </div>
        )}

        {feedMode === "communities" && followedTags.length > 0 && allFeed.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted">No posts from your followed topics.</p>
          </div>
        )}
      </div>

      {showCompose && (
        <PostComposer onClose={() => { setShowCompose(false); setComposePreselect(undefined); }}
          onPublished={() => { setPublishedPosts(getPublishedPosts()); }}
          preselectType={composePreselect} />
      )}

      {selectedPost && (
        <ThreadModal post={selectedPost} onClose={() => setSelectedPost(null)}
          likes={liked} saves={saved} onLike={toggleLike} onSave={toggleSave} following={following} onFollow={toggleFollow}
          onCommentUpdate={() => { setPublishedPosts(getPublishedPosts()); }} />
      )}
    </>
  );
}

function ComposeModal({ userName, onClose, onPost }: { userName: string; onClose: () => void; onPost: (post: any) => void }) {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onPost({ content: content.trim(), tags: selectedTags, createdAt: "Just now" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[580px] mx-4 my-12 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <span className="text-sm font-semibold text-foreground">Create post</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{userName?.charAt(0)?.toUpperCase() || "Y"}</div>
            <div className="flex-1 min-w-0">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={`What's on your mind${userName ? `, ${userName}` : ""}?`}
                rows={4}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none leading-relaxed" />
              <div className="mt-4">
                <p className="text-xs text-muted mb-2">Tag topics (tap to select):</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TAGS.map((t) => (
                    <button key={t} onClick={() => setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].slice(0, 3))}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${selectedTags.includes(t) ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light" : "border-border text-muted hover:border-primary/30"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
                <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={!content.trim()}
                  className="px-5 py-1.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Post</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadModal({ post, onClose, likes, saves, onLike, onSave, following, onFollow, onCommentUpdate }: {
  post: typeof POSTS[0]; onClose: () => void;
  likes: Set<string>; saves: Set<string>; onLike: (id: string) => void; onSave: (id: string) => void;
  following: string[]; onFollow: (name: string, e: React.MouseEvent) => void;
  onCommentUpdate?: () => void;
}) {
  const router = useRouter();
  const comments = postComments[post.id] || [];
  const isLiked = likes.has(post.id);
  const isSaved = saves.has(post.id);
  const isFollowing = following.includes(post.author);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[580px] mx-4 my-8 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <span className="text-xs text-muted">Thread</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors">
            <IconX size={18} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <div onClick={() => { window.location.assign(publicProfileHref(post.author)); }} className="shrink-0 cursor-pointer">
              <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-primary transition-all" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button onClick={() => window.location.assign(publicProfileHref(post.author))}
                  className="font-semibold text-foreground hover:text-primary transition-colors">{post.author}</button>
                <span className="text-muted">{post.role}</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-muted">{post.createdAt}</span>
                <button onClick={(e) => onFollow(post.author, e)}
                  className={`ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${isFollowing ? "border-primary/30 text-primary bg-primary/5" : "border-border text-muted hover:border-primary/30 hover:text-primary"}`}>
                  {isFollowing ? <><IconUserCheck size={11} /> Following</> : <><IconUserPlus size={11} /> Follow</>}
                </button>
              </div>
              <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">{post.content}</p>
              {post.image && (
                <img src={post.image} alt="" className="mt-3 w-full rounded-xl object-cover max-h-80" loading="lazy" />
              )}
              <div className="flex items-center gap-1.5 mt-3">
                {post.tags.map((t) => (
                  <span key={t} onClick={(e) => { e.stopPropagation(); router.push(`/discussions/tags/${encodeURIComponent(t)}`); }}
                    className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light cursor-pointer hover:bg-primary/20 transition-colors">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted">
                <button onClick={() => onLike(post.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${isLiked ? "text-red-400 bg-red-50 dark:bg-red-900/10" : "hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-400"}`}>
                  {isLiked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
                  <span className="tabular-nums">{post.likes + (isLiked ? 1 : 0)}</span>
                </button>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer">
                  <IconMessage2 size={15} />
                  <span className="tabular-nums">{post.comments}</span>
                </div>
                <button onClick={() => onSave(post.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ml-auto transition-colors ${isSaved ? "text-primary bg-primary/5" : "hover:bg-surface hover:text-foreground"}`}>
                  {isSaved ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
                </button>
                <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors">
                  <IconShare size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {comments.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">{comments.length} {comments.length === 1 ? "reply" : "replies"}</h3>
            <div className="space-y-4">
              {comments.map((c, i) => (
                <div key={i} className="flex items-start gap-3">
                  <img src={c.avatar} alt={c.author} className="w-7 h-7 rounded-full object-cover shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">{c.author}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{c.createdAt}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <img src="https://picsum.photos/seed/default-avatar/60/60" alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            <input type="text" placeholder="Write a reply\u2026" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none" />
            <button className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">Post</button>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <CommentThread contentId={post.id} contentType="post" onUpdate={() => onCommentUpdate?.()} />
        </div>
      </div>
    </div>
  );
}

function BlogsTab({ searchQuery, feedMode }: {
  searchQuery: string;
  feedMode: "foryou" | "following" | "communities" | "questions";
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(8);
  const [followedTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_followed_tags") || "[]"); } catch { return []; }
  });
  const [following, setFollowing] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_following") || "[]"); } catch { return []; }
  });

  const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>([]);

  useEffect(() => {
    setPublishedArticles(getPublishedArticles());
  }, []);

  let feed: any[] = [...publishedArticles.map((a) => ({
    id: a.id, title: a.title, author: a.authorName, role: a.authorRole || "Learner",
    avatar: a.authorAvatar || `https://picsum.photos/seed/${a.authorName}/60/60`,
    excerpt: a.subtitle || a.excerpt || "", likes: a.likes, comments: a.comments,
    tags: a.topicName ? [a.topicName] : [],
    createdAt: new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    readTime: `${a.estimatedReadingMinutes} min read`,
    image: a.coverImage?.url || null,
  })), ...BLOGS];

  if (feedMode === "following" && following.length > 0) {
    feed = feed.filter(b => following.includes(b.author));
  } else if (feedMode === "communities" && followedTags.length > 0) {
    feed = feed.filter((b: any) => (b.tags || []).some((t: string) => followedTags.includes(t)));
  } else if (feedMode === "questions") {
    feed = feed.filter((b: any) => /^(how|what|why|when|where|can|should)\b/i.test(b.title || ""));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    feed = feed.filter((b: any) =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.excerpt || "").toLowerCase().includes(q) ||
      (b.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  }

  const allFeed = (feedMode === "following" && following.length === 0) || (feedMode === "communities" && followedTags.length === 0) ? [] : feed;

  return (
    <div className={styles.postList}>
      {feedMode === "following" && following.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted">You're not following anyone yet.</p>
          <p className="text-xs text-muted mt-1">Follow creators on the Posts tab to see their blogs here.</p>
        </div>
      )}

      {feedMode === "communities" && followedTags.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted">Follow topics to see community content.</p>
          <p className="text-xs text-muted mt-1">Tap tags above to follow topics that interest you.</p>
        </div>
      )}

      {allFeed.slice(0, visibleCount).map((blog) => {
        const avatar = blog.avatar || `https://picsum.photos/seed/${encodeURIComponent(blog.author)}-avatar/60/60`;
        return (
          <article key={blog.id} role="button" tabIndex={0}
            onClick={() => router.push(`/discussions/blogs/${blog.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/discussions/blogs/${blog.id}`); }}
            className={styles.post}>
            <div className={styles.avatarRail} onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(blog.author)); }}>
              <img src={avatar} alt={`${blog.author}'s profile`} loading="lazy" width="40" height="40" />
              <span className={styles.threadLine} aria-hidden="true" />
            </div>
            <div className={styles.postBody}>
              <div className={styles.postMeta}>
                <button onClick={(e) => { e.stopPropagation(); window.location.assign(publicProfileHref(blog.author)); }} className={styles.author}>{blog.author}</button>
                <span className={styles.role}>· {blog.role}</span>
                <span className={styles.time}>· {blog.createdAt}</span>
                <button onClick={(e) => e.stopPropagation()} className={styles.moreButton} aria-label={`More options for ${blog.title}`}><IconDots size={20} /></button>
              </div>
              <p className={styles.articleLabel}>Article · {blog.readTime}</p>
              <h2 className={styles.articleTitle}>{blog.title}</h2>
              <p className={styles.articleExcerpt}>{blog.excerpt}</p>
              {blog.image && <img src={blog.image} alt={`Cover for ${blog.title}`} className={styles.postImage} loading="lazy" width="600" height="400" />}
              <div className={styles.tags}>
                {(blog.tags || []).map((t: string) => (
                  <button key={t} onClick={(e) => { e.stopPropagation(); router.push(`/discussions/tags/${encodeURIComponent(t)}`); }} className={styles.tag}>#{t.replaceAll(" ", "")}</button>
                ))}
              </div>
              <div className={styles.postActions}>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="Like article"><IconHeart size={17} /><span>{blog.likes}</span></button>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="View article replies"><IconMessage2 size={17} /><span>{blog.comments}</span></button>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="Repost article"><IconRepeat size={18} /><span>{Math.max(1, Math.round(blog.comments / 8))}</span></button>
                <button onClick={(e) => e.stopPropagation()} className={styles.action} aria-label="Share article"><IconShare size={18} /><span>{Math.max(1, Math.round(blog.likes / 36))}</span></button>
              </div>
            </div>
          </article>
        );
      })}

      {visibleCount < allFeed.length && (
        <button onClick={() => setVisibleCount((c) => c + 8)} className={styles.loadMore}>Load more</button>
      )}

      {allFeed.length === 0 && feedMode !== "following" && feedMode !== "communities" && !searchQuery && (
        <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">No blogs yet.</div>
      )}

      {allFeed.length === 0 && searchQuery.trim() && (
        <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">
          No results for &ldquo;{searchQuery}&rdquo;. Try a different search.
        </div>
      )}

      {feedMode === "following" && following.length > 0 && allFeed.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted">No blogs from followed creators.</p>
        </div>
      )}

      {feedMode === "communities" && followedTags.length > 0 && allFeed.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted">No blogs from your followed topics.</p>
        </div>
      )}
    </div>
  );
}
