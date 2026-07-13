"use client";

import { useState, useCallback } from "react";
import { IconArrowLeft, IconMessage2, IconHeart, IconUserPlus, IconUserCheck } from "@tabler/icons-react";

const ALL_POSTS = [
  { id: "p1", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Golden hour at West Lake today. The light was absolutely incredible 🌅", image: "https://picsum.photos/seed/golden-hour/600/400", likes: 142, comments: 8, tags: ["Photography"], createdAt: "1h ago" },
  { id: "p2", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "Just finished a 2-hour speaking session with a student who went from total silence to a full 7-minute monologue. This is why I love teaching. 🎯", likes: 89, comments: 12, tags: ["IELTS", "Languages"], createdAt: "3h ago" },
  { id: "p3", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Made phở for 20 people today. My kitchen smells like paradise. Recipe in comments 🍜", image: "https://picsum.photos/seed/pho-bowl/600/400", likes: 203, comments: 24, tags: ["Cooking"], createdAt: "5h ago" },
  { id: "p4", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Hot take: TypeScript is great but sometimes I miss the chaos of writing plain JS. Anyone else? 😅", likes: 67, comments: 31, tags: ["Technology"], createdAt: "7h ago" },
  { id: "p5", author: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/60/60", content: "Just wrapped a workshop on impromptu speaking. One tip that blew everyone's mind: pause before answering.", likes: 156, comments: 14, tags: ["Personal development"], createdAt: "10h ago" },
  { id: "p6", author: "Bao Long", role: "Business Strategy Mentor", avatar: "https://picsum.photos/seed/bao-avatar/60/60", content: "Read 50 startup pitch decks this week. The ones that stood out had one thing in common.", image: "https://picsum.photos/seed/pitch-deck/600/400", likes: 95, comments: 7, tags: ["Business"], createdAt: "12h ago" },
  { id: "p7", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Trying film photography for the first time. 36 shots. No preview. No delete button. 📷", likes: 178, comments: 22, tags: ["Photography"], createdAt: "1d ago" },
  { id: "p8", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "New resource drop: 50 IELTS speaking Part 2 topics with model answers. Free link in bio! 📚", likes: 312, comments: 45, tags: ["IELTS", "Languages"], createdAt: "1d ago" },
  { id: "p9", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Weekend baking project: bánh mì from scratch. Took 3 attempts but finally got that perfect crust. 💪🥖", image: "https://picsum.photos/seed/banh-mi/600/400", likes: 134, comments: 18, tags: ["Cooking"], createdAt: "2d ago" },
  { id: "p10", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Shipped a side project in 48 hours. Vibe coding is real y'all. AI wrote 70% of it.", likes: 221, comments: 36, tags: ["Technology"], createdAt: "2d ago" },
];

const ALL_BLOGS = [
  { id: "b1", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", excerpt: "After teaching photography workshops for 5 years, I've seen the same patterns.", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
  { id: "b2", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", excerpt: "Three months of consistent practice. The key insight that changed everything.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
  { id: "b3", title: "What I wish I knew before starting a small business", author: "Huy Tran", excerpt: "Four years in, here are the hard lessons about regulations, hiring, and co-founders.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
  { id: "b5", title: "React Server Components explained simply", author: "Huy Tran", excerpt: "Server Components never send JS to the client. Here's when and why.", likes: 320, comments: 45, tags: ["Technology"], createdAt: "1d ago", readTime: "12 min read", image: "https://picsum.photos/seed/post-react/400/240" },
  { id: "b6", title: "How to stay consistent with language learning", author: "Linh Nguyen", excerpt: "Consistency beats intensity. Daily micro-habits that actually work.", likes: 278, comments: 31, tags: ["Languages", "Personal development"], createdAt: "4d ago", readTime: "4 min read", image: "https://picsum.photos/seed/post-language/400/240" },
  { id: "b9", title: "Photography composition cheat sheet", author: "Duc Pham", excerpt: "Rule of thirds, leading lines, symmetry — a cheat sheet for every shoot.", likes: 445, comments: 28, tags: ["Photography"], createdAt: "2d ago", readTime: "3 min read", image: "https://picsum.photos/seed/post-composition/400/240" },
];

const tagIcons: Record<string, string> = {
  Photography: "📷",
  IELTS: "🎯",
  Languages: "🌍",
  Business: "💼",
  Technology: "💻",
  Creative: "🎨",
  Cooking: "🍳",
  "Personal development": "🌱",
  Academic: "📚",
  Community: "🤝",
};

export function TagPage({ tag }: { tag: string }) {
  const decoded = decodeURIComponent(tag);

  const [followedTags, setFollowedTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tutoria_followed_tags") || "[]"); } catch { return []; }
  });

  const isFollowed = followedTags.some(t => t.toLowerCase() === decoded.toLowerCase());

  const toggleFollow = useCallback(() => {
    setFollowedTags(prev => {
      const next = prev.some(t => t.toLowerCase() === decoded.toLowerCase())
        ? prev.filter(t => t.toLowerCase() !== decoded.toLowerCase())
        : [...prev, decoded];
      localStorage.setItem("tutoria_followed_tags", JSON.stringify(next));
      return next;
    });
  }, [decoded]);

  const matchingPosts = ALL_POSTS.filter(p => p.tags.some(t => t.toLowerCase() === decoded.toLowerCase()));
  const matchingBlogs = ALL_BLOGS.filter(b => b.tags.some(t => t.toLowerCase() === decoded.toLowerCase()));

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <main className="flex-1">
        <div className="max-w-[680px] mx-auto px-4 pt-12 pb-1">
          <a href="/discussions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-4">
            <IconArrowLeft size={14} /> Discussions
          </a>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{tagIcons[decoded] || "🏷️"}</span>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">{decoded}</h1>
                <button onClick={toggleFollow}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${isFollowed ? "border-primary bg-primary/10 text-primary-dark dark:text-primary-light" : "border-border text-muted hover:border-primary/30 hover:text-foreground"}`}>
                  {isFollowed ? <><IconUserCheck size={14} /> Following</> : <><IconUserPlus size={14} /> Follow</>}
                </button>
              </div>
              <p className="text-sm text-muted mt-1">{matchingPosts.length + matchingBlogs.length} {matchingPosts.length + matchingBlogs.length === 1 ? "post" : "posts"} · Explore content about {decoded.toLowerCase()}</p>
            </div>
          </div>
        </div>

        <div className="max-w-[680px] mx-auto px-4 pb-16 pt-6 space-y-3">
          {matchingPosts.map(post => (
            <a key={post.id} href="/discussions"
              className="block rounded-2xl border border-border bg-background p-5 hover:shadow-sm hover:border-primary/20 transition-all duration-200">
              <div className="flex items-start gap-3">
                <img src={post.avatar} alt={post.author} className="w-9 h-9 rounded-full object-cover shrink-0" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-foreground">{post.author}</span>
                    <span className="text-muted">{post.role}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-muted">{post.createdAt}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground leading-relaxed line-clamp-3">{post.content}</p>
                  {post.image && (
                    <img src={post.image} alt="" className="mt-3 w-full rounded-xl object-cover max-h-48" loading="lazy" />
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                    <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{post.likes}</span></div>
                    <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{post.comments}</span></div>
                  </div>
                </div>
              </div>
            </a>
          ))}

          {matchingBlogs.map(blog => (
            <a key={blog.id} href={`/discussions/blogs/${blog.id}`}
              className="block rounded-2xl border border-border bg-background p-5 hover:shadow-sm hover:border-primary/20 transition-all duration-200">
              <div className="flex items-start gap-4">
                {blog.image && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface">
                    <img src={blog.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug">{blog.title}</h3>
                  <p className="mt-1 text-xs text-muted line-clamp-1">{blog.excerpt}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                    <span>by {blog.author}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{blog.createdAt}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{blog.readTime}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{blog.likes}</span></div>
                    <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{blog.comments}</span></div>
                  </div>
                </div>
              </div>
            </a>
          ))}

          {matchingPosts.length === 0 && matchingBlogs.length === 0 && (
            <div className="text-center py-16 text-sm text-muted border border-dashed border-border rounded-2xl">
              No content tagged with <strong>{decoded}</strong> yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
