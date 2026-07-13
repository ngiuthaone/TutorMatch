"use client";

import { useState, useEffect } from "react";
import { getUserFromStorage } from "@/lib/types";
import {
  IconHeart, IconMessage2, IconArrowLeft, IconUserCheck, IconUserPlus,
  IconMapPin, IconGlobe, IconStar, IconCircleCheck,
} from "@tabler/icons-react";

interface ProfileUser {
  name: string; role: string; avatar: string; cover: string; bio: string;
  detailedBio: string; location: string; website: string; joined: string;
  rating: number; learners: number; reviews: number; following: number; posts: number;
  skills: string[]; verified: boolean; experience: { title: string; org: string; years: string }[];
}

interface ProfilePost {
  id: string; type: "post" | "blog";
  content?: string; title?: string; excerpt?: string;
  likes: number; comments: number; tags: string[];
  createdAt: string; readTime?: string; image?: string;
}

const ALL_USERS: ProfileUser[] = [
  { name: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/200/200", cover: "https://picsum.photos/seed/duc-cover/1200/300", bio: "Commercial photographer and exhibition curator. Teaching photography for 5+ years.", detailedBio: "I've been behind the lens for over a decade, capturing everything from intimate portraits to sprawling landscapes. My work has been exhibited in galleries across Vietnam and Southeast Asia. I believe photography is not just about taking pictures — it's about telling stories, freezing moments, and seeing the extraordinary in the ordinary.", location: "Tay Ho, Ha Noi", website: "ducpham.photo", joined: "2023", rating: 4.9, learners: 1200, reviews: 89, following: 245, posts: 4, skills: ["Photography", "Lightroom", "Photoshop", "Composition"], verified: true, experience: [{ title: "Lead Photographer", org: "Freelance", years: "2018–Present" }, { title: "Workshop Instructor", org: "Hanoi Photo Club", years: "2020–Present" }] },
  { name: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/200/200", cover: "https://picsum.photos/seed/linh-cover/1200/300", bio: "7.5 IELTS scorer. Helping learners achieve their language goals since 2020.", detailedBio: "I scored 7.5 on the IELTS academic module and have since dedicated myself to helping others achieve the same. My teaching approach combines structured practice with real-world language immersion. I've worked with students from all over Vietnam.", location: "Dong Da, Ha Noi", website: "linhnguyen.english", joined: "2020", rating: 4.9, learners: 2000, reviews: 156, following: 1890, posts: 4, skills: ["IELTS", "English", "TOEFL", "Academic Writing"], verified: true, experience: [{ title: "Senior IELTS Coach", org: "Language Link Vietnam", years: "2020–Present" }, { title: "English Teacher", org: "Hanoi University", years: "2018–2020" }] },
  { name: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/200/200", cover: "https://picsum.photos/seed/thu-cover/1200/300", bio: "French culinary arts graduate. 200+ classes taught. Love sharing Vietnamese cuisine.", detailedBio: "I graduated from Le Cordon Bleu and have since blended French techniques with Vietnamese culinary traditions. My classes range from street food favorites to elaborate banquet dishes.", location: "Hoan Kiem, Ha Noi", website: "thuhacooks.com", joined: "2022", rating: 4.9, learners: 3100, reviews: 203, following: 3420, posts: 2, skills: ["Vietnamese Cuisine", "Baking", "French Culinary"], verified: true, experience: [{ title: "Head Instructor", org: "Saigon Culinary Centre", years: "2022–Present" }, { title: "Pastry Chef", org: "Sofitel Legend Metropole", years: "2019–2022" }] },
  { name: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/200/200", cover: "https://picsum.photos/seed/huy-cover/1200/300", bio: "8 years building web apps for startups. Mentoring the next generation of devs.", detailedBio: "I started coding at 16 and haven't stopped since. I've built products for fintech, e-commerce, and edtech startups across Southeast Asia.", location: "Ba Dinh, Ha Noi", website: "huydev.io", joined: "2024", rating: 4.8, learners: 890, reviews: 67, following: 567, posts: 4, skills: ["JavaScript", "React", "Node.js", "Python"], verified: true, experience: [{ title: "Senior Frontend Engineer", org: "TechStart Vietnam", years: "2022–Present" }, { title: "Full-stack Developer", org: "EcomCorp", years: "2019–2022" }] },
  { name: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/200/200", cover: "https://picsum.photos/seed/minh-cover/1200/300", bio: "Helped 200+ learners speak with confidence. Workshop facilitator and keynote speaker.", detailedBio: "I went from being terrified of public speaking to delivering keynotes at conferences across Vietnam. My methodology combines practical techniques from theater, psychology, and business communication.", location: "Cau Giay, Ha Noi", website: "minhanhspeaks.com", joined: "2023", rating: 4.9, learners: 1200, reviews: 124, following: 890, posts: 1, skills: ["Public Speaking", "Communication", "Leadership"], verified: true, experience: [{ title: "Founder & Coach", org: "SpeakEasy Vietnam", years: "2021–Present" }, { title: "Communications Lead", org: "VF上市公司", years: "2018–2021" }] },
  { name: "Bao Long", role: "Business Strategy Mentor", avatar: "https://picsum.photos/seed/bao-avatar/200/200", cover: "https://picsum.photos/seed/bao-cover/1200/300", bio: "Ex-VC, founded 2 successful startups. Now mentoring founders and entrepreneurs.", detailedBio: "I spent 5 years in venture capital before founding my own startups. I've seen hundreds of pitch decks and learned what separates successful startups from the rest.", location: "District 1, Ho Chi Minh City", website: "baolong.me", joined: "2022", rating: 4.7, learners: 650, reviews: 78, following: 1520, posts: 1, skills: ["Startups", "Strategy", "Marketing", "Fundraising"], verified: false, experience: [{ title: "Founder & CEO", org: "Lumi Ventures", years: "2021–Present" }, { title: "Investment Associate", org: "Mekong Capital", years: "2018–2021" }] },
];

const USER_POSTS: Record<string, ProfilePost[]> = {
  "Duc Pham": [
    { id: "p1", type: "post", content: "Golden hour at West Lake today. The light was absolutely incredible 🌅\n\nSometimes you just need to stop and appreciate the moment.", likes: 142, comments: 8, tags: ["Photography"], createdAt: "1h ago", image: "https://picsum.photos/seed/golden-hour/600/400" },
    { id: "p7", type: "post", content: "Trying film photography for the first time. 36 shots. No preview. No delete button. 📷", likes: 178, comments: 22, tags: ["Photography"], createdAt: "1d ago" },
    { id: "b1", type: "blog", title: "Five mistakes beginners make when learning photography", excerpt: "After teaching photography workshops for 5 years, I've seen the same patterns.", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
    { id: "b9", type: "blog", title: "Photography composition cheat sheet", excerpt: "Rule of thirds, leading lines, symmetry — a cheat sheet for every shoot.", likes: 445, comments: 28, tags: ["Photography"], createdAt: "2d ago", readTime: "3 min read", image: "https://picsum.photos/seed/post-composition/400/240" },
  ],
  "Linh Nguyen": [
    { id: "p2", type: "post", content: "Just finished a 2-hour speaking session with a student who went from total silence to a full 7-minute monologue. 🎯", likes: 89, comments: 12, tags: ["IELTS", "Languages"], createdAt: "3h ago" },
    { id: "p8", type: "post", content: "New resource drop: 50 IELTS speaking Part 2 topics with model answers. Free link in bio! 📚", likes: 312, comments: 45, tags: ["IELTS", "Languages"], createdAt: "1d ago" },
    { id: "b2", type: "blog", title: "How I improved my IELTS speaking from 6.0 to 7.5", excerpt: "Three months of consistent practice. The key insight that changed everything.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
    { id: "b6", type: "blog", title: "How to stay consistent with language learning", excerpt: "Consistency beats intensity. Daily micro-habits that actually work.", likes: 278, comments: 31, tags: ["Languages", "Personal development"], createdAt: "4d ago", readTime: "4 min read", image: "https://picsum.photos/seed/post-language/400/240" },
  ],
  "Thu Ha": [
    { id: "p3", type: "post", content: "Made phở for 20 people today. My kitchen smells like paradise. Recipe in comments 🍜", likes: 203, comments: 24, tags: ["Cooking"], createdAt: "5h ago", image: "https://picsum.photos/seed/pho-bowl/600/400" },
    { id: "p9", type: "post", content: "Weekend baking project: bánh mì from scratch. Took 3 attempts but finally got that perfect crust. 💪🥖", likes: 134, comments: 18, tags: ["Cooking"], createdAt: "2d ago", image: "https://picsum.photos/seed/banh-mi/600/400" },
  ],
  "Huy Tran": [
    { id: "p4", type: "post", content: "Hot take: TypeScript is great but sometimes I miss the chaos of writing plain JS. 😅", likes: 67, comments: 31, tags: ["Technology"], createdAt: "7h ago" },
    { id: "p10", type: "post", content: "Shipped a side project in 48 hours. Vibe coding is real y'all. AI wrote 70% of it.", likes: 221, comments: 36, tags: ["Technology"], createdAt: "2d ago" },
    { id: "b3", type: "blog", title: "What I wish I knew before starting a small business", excerpt: "Four years in, here are the hard lessons about regulations, hiring, and co-founders.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
    { id: "b5", type: "blog", title: "React Server Components explained simply", excerpt: "Server Components never send JS to the client. Here's when and why.", likes: 320, comments: 45, tags: ["Technology"], createdAt: "1d ago", readTime: "12 min read", image: "https://picsum.photos/seed/post-react/400/240" },
  ],
  "Minh Anh": [
    { id: "p5", type: "post", content: "Just wrapped a workshop on impromptu speaking. One tip: pause before answering. It makes you look confident.", likes: 156, comments: 14, tags: ["Personal development"], createdAt: "10h ago" },
  ],
  "Bao Long": [
    { id: "p6", type: "post", content: "Read 50 startup pitch decks this week. The ones that stood out had one thing in common: they explained the problem like you've lived it.", likes: 95, comments: 7, tags: ["Business"], createdAt: "12h ago", image: "https://picsum.photos/seed/pitch-deck/600/400" },
  ],
};

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-foreground tracking-tight">{value}</div>
      <div className="text-[11px] text-muted mt-px">{label}</div>
    </div>
  );
}

export function UserProfile({ name }: { name: string }) {
  const decoded = decodeURIComponent(name);
  const matchedUser = ALL_USERS.find(u => u.name.toLowerCase() === decoded.toLowerCase());
  const [mounted, setMounted] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [tab, setTab] = useState<"posts" | "articles">("posts");

  useEffect(() => {
    setMounted(true);
    try {
      const stored = JSON.parse(localStorage.getItem("tutoria_following") || "[]");
      setFollowing(stored);
    } catch {}
  }, []);

  const signedIn = getUserFromStorage();
  const isOwnProfile = signedIn && signedIn.name.toLowerCase() === decoded.toLowerCase();
  const user: ProfileUser | null = matchedUser ?? (isOwnProfile ? {
    name: signedIn!.name,
    role: signedIn!.role || "Learner",
    avatar: signedIn!.avatarUrl || "https://picsum.photos/seed/default-avatar/200/200",
    cover: "https://picsum.photos/seed/default-cover/1200/300",
    bio: "No bio yet.",
    detailedBio: "",
    location: "",
    website: "",
    joined: new Date().getFullYear().toString(),
    rating: 0,
    learners: 0,
    reviews: 0,
    following: 0,
    posts: 0,
    skills: [],
    verified: false,
    experience: [],
  } : null);
  const allPosts = matchedUser ? USER_POSTS[matchedUser.name] || [] : [];

  const isFollowing = following.some(f => f.toLowerCase() === decoded.toLowerCase());

  const toggleFollow = () => {
    setFollowing(prev => {
      const next = prev.some(f => f.toLowerCase() === decoded.toLowerCase())
        ? prev.filter(f => f.toLowerCase() !== decoded.toLowerCase())
        : [...prev, decoded];
      localStorage.setItem("tutoria_following", JSON.stringify(next));
      return next;
    });
  };

  const posts = allPosts.filter(p => p.type === "post");
  const articles = allPosts.filter(p => p.type === "blog");

  if (!mounted) {
    return (
      <main className="flex-1">
        <div className="max-w-[640px] mx-auto px-4 pt-8 pb-16">
          <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="aspect-[4/1] bg-surface" />
            <div className="px-6 pb-6 text-center">
              <div className="w-20 h-20 rounded-full bg-surface mx-auto -mt-10 relative z-10" />
              <div className="mt-4 h-5 w-48 bg-surface rounded mx-auto" />
              <div className="mt-2 h-4 w-32 bg-surface rounded mx-auto" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1">
        <div className="max-w-[640px] mx-auto px-4 pt-12 pb-16 text-center">
          <h1 className="text-xl font-semibold text-foreground">User not found</h1>
          <p className="text-sm text-muted mt-2">This profile doesn&apos;t exist or may have been removed.</p>
          <a href="/discussions" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            <IconArrowLeft size={14} /> Back to discussions
          </a>
        </div>
      </main>
    );
  }

  const stats = [
    { value: posts.length.toString(), label: "Posts" },
    { value: user.learners.toLocaleString("en-US"), label: "Learners" },
    { value: user.rating > 0 ? user.rating.toFixed(1) : "—", label: "Rating" },
    { value: user.following.toLocaleString("en-US"), label: "Following" },
  ];

  return (
    <main className="flex-1">
      <div className="max-w-[640px] mx-auto px-4 pt-8 pb-16">
        <a href="/discussions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6">
          <IconArrowLeft size={14} /> Discussions
        </a>

        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="aspect-[4/1] bg-gradient-to-br from-primary/20 via-primary/10 to-surface relative overflow-hidden">
            <img src={user.cover} alt="" className="w-full h-full object-cover" />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex justify-center -mt-10 mb-3 relative z-10">
              <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full border-4 border-background object-cover shadow-md" />
            </div>

            {/* Name + role + location */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{user.name}</h1>
                {user.verified && <IconCircleCheck size={16} className="text-primary shrink-0" />}
              </div>
              <p className="text-sm text-primary font-medium mt-0.5">{user.role}</p>
              {user.location && (
                <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted">
                  <IconMapPin size={12} />
                  <span>{user.location}</span>
                </div>
              )}
              {user.website && (
                <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-primary">
                  <IconGlobe size={12} />
                  <span>{user.website}</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="mt-3 text-sm text-muted leading-relaxed text-center max-w-md mx-auto">{user.bio}</p>
            )}

            {/* Stats row — Threads style */}
            <div className="flex items-center justify-center gap-6 mt-5">
              {stats.map(s => (
                <StatBlock key={s.label} value={s.value} label={s.label} />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={toggleFollow}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-xl border transition-all ${isFollowing ? "border-primary/30 text-primary bg-primary/5" : "border-border text-foreground hover:bg-primary hover:text-white hover:border-primary"}`}>
                {isFollowing ? <><IconUserCheck size={14} /> Following</> : <><IconUserPlus size={14} /> Follow</>}
              </button>
              <button className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface transition-colors">
                <IconMessage2 size={14} /> Message
              </button>
            </div>

            {/* Rich content — always visible */}
            <div className="mt-6 pt-6 border-t border-border space-y-5">
              {/* Skills */}
              {user.skills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.skills.map(s => (
                      <span key={s} className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* About */}
              {user.detailedBio && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">About</p>
                  <p className="text-xs text-muted leading-relaxed">{user.detailedBio}</p>
                </div>
              )}

              {/* Experience */}
              {user.experience.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Experience</p>
                  <div className="space-y-3">
                    {user.experience.map(ex => (
                      <div key={ex.title} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{ex.title}</p>
                          <p className="text-[11px] text-muted">{ex.org} · {ex.years}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-1 border-b border-border">
          {[
            { key: "posts" as const, label: "Posts", count: posts.length },
            { key: "articles" as const, label: "Articles", count: articles.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-[1px] ${tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
              {t.label}{t.count > 0 && <span className="ml-1.5 text-xs tabular-nums text-muted">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Posts tab */}
        {tab === "posts" && (
          posts.length === 0 ? (
            <div className="mt-8 text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">No posts yet.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {posts.map(p => (
                <a key={p.id} href="/discussions" className="block rounded-2xl border border-border bg-background p-5 hover:shadow-sm hover:border-primary/20 transition-all duration-200">
                  <div className="flex items-start gap-3">
                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-semibold text-foreground">{user.name}</span>
                        <span className="text-muted">{user.role}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-muted">{p.createdAt}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-line">{p.content}</p>
                      {p.image && <img src={p.image} alt="" className="mt-3 w-full rounded-xl object-cover max-h-64" loading="lazy" />}
                      <div className="flex items-center gap-1.5 mt-2">
                        {p.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{t}</span>)}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{p.likes}</span></div>
                        <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{p.comments}</span></div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        )}

        {/* Articles tab */}
        {tab === "articles" && (
          articles.length === 0 ? (
            <div className="mt-8 text-center py-12 text-sm text-muted border border-dashed border-border rounded-2xl">No articles published yet.</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {articles.map(a => (
                <a key={a.id} href={`/discussions/blogs/${a.id}`} className="group rounded-2xl border border-border bg-background overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-200">
                  {a.image && <div className="aspect-[5/3] overflow-hidden bg-surface"><img src={a.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" /></div>}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{a.title}</h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{a.excerpt}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                      <span>{a.createdAt}</span>
                      {a.readTime && <><span className="w-1 h-1 rounded-full bg-border" /><span>{a.readTime}</span></>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {a.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{t}</span>)}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                      <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{a.likes}</span></div>
                      <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{a.comments}</span></div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        )}

        {/* Similar people */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-foreground mb-4">Similar people</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_USERS.filter(u => u.name !== user.name).slice(0, 4).map(u => (
              <a key={u.name} href={`/profile/${encodeURIComponent(u.name)}`} className="rounded-xl border border-border bg-background p-3 hover:shadow-sm hover:border-primary/20 transition-all duration-200 text-center">
                <img src={u.avatar} alt={u.name} className="w-11 h-11 rounded-full object-cover mx-auto" />
                <p className="text-xs font-semibold text-foreground mt-2 line-clamp-1">{u.name}</p>
                <p className="text-[10px] text-muted line-clamp-1">{u.role}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
