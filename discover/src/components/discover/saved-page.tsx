"use client";

import { useState, useEffect } from "react";
import { IconHeart, IconMessage2, IconBookmark, IconArrowLeft } from "@tabler/icons-react";

const POSTS = [
  { id: "p1", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Golden hour at West Lake today. The light was absolutely incredible \u{1F305}", image: "https://picsum.photos/seed/golden-hour/600/400", likes: 142, comments: 8, tags: ["Photography"], createdAt: "1h ago" },
  { id: "p2", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "Just finished a 2-hour speaking session with a student who went from total silence to a full 7-minute monologue.", likes: 89, comments: 12, tags: ["IELTS", "Languages"], createdAt: "3h ago" },
  { id: "p3", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Made ph\u1EDF for 20 people today. My kitchen smells like heaven.", image: "https://picsum.photos/seed/pho-bowl/600/400", likes: 203, comments: 24, tags: ["Cooking"], createdAt: "5h ago" },
  { id: "p4", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Hot take: TypeScript is great but sometimes I miss the chaos of writing plain JS.", likes: 67, comments: 31, tags: ["Technology"], createdAt: "7h ago" },
  { id: "p5", author: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/60/60", content: "Just wrapped a workshop on impromptu speaking. One tip that blew everyone's mind: pause before answering.", likes: 156, comments: 14, tags: ["Personal development"], createdAt: "10h ago" },
  { id: "p6", author: "Bao Long", role: "Business Strategy Mentor", avatar: "https://picsum.photos/seed/bao-avatar/60/60", content: "Read 50 startup pitch decks this week. The ones that stood out had one thing in common.", image: "https://picsum.photos/seed/pitch-deck/600/400", likes: 95, comments: 7, tags: ["Business"], createdAt: "12h ago" },
  { id: "p7", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Trying film photography for the first time. 36 shots. No preview. No delete button.", likes: 178, comments: 22, tags: ["Photography"], createdAt: "1d ago" },
  { id: "p8", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "New resource drop: 50 IELTS speaking Part 2 topics with model answers. Free link in bio!", likes: 312, comments: 45, tags: ["IELTS", "Languages"], createdAt: "1d ago" },
  { id: "p9", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Weekend baking project: b\u00E1nh m\u00EC from scratch. Took 3 attempts but finally got that perfect crust.", image: "https://picsum.photos/seed/banh-mi/600/400", likes: 134, comments: 18, tags: ["Cooking"], createdAt: "2d ago" },
  { id: "p10", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Shipped a side project in 48 hours. Vibe coding is real y'all. AI wrote 70% of it.", likes: 221, comments: 36, tags: ["Technology"], createdAt: "2d ago" },
];

const BLOGS = [
  { id: "b1", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", excerpt: "After teaching photography workshops for 5 years, I've seen the same patterns.", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
  { id: "b2", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", excerpt: "Three months of consistent practice. The key insight that changed everything.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
  { id: "b3", title: "What I wish I knew before starting a small business", author: "Huy Tran", excerpt: "Four years in, here are the hard lessons about regulations and hiring.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
  { id: "b4", title: "Beginner guide to arranging flowers at home", author: "Thu Ha", excerpt: "You don't need expensive tools to create beautiful arrangements.", likes: 156, comments: 12, tags: ["Creative"], createdAt: "3d ago", readTime: "5 min read", image: "https://picsum.photos/seed/post-flowers/400/240" },
  { id: "b5", title: "React Server Components explained simply", author: "Huy Tran", excerpt: "Server Components never send JS to the client. Here's when and why.", likes: 320, comments: 45, tags: ["Technology"], createdAt: "1d ago", readTime: "12 min read", image: "https://picsum.photos/seed/post-react/400/240" },
  { id: "b6", title: "How to stay consistent with language learning", author: "Linh Nguyen", excerpt: "Consistency beats intensity. Daily micro-habits that actually work.", likes: 278, comments: 31, tags: ["Languages", "Personal development"], createdAt: "4d ago", readTime: "4 min read", image: "https://picsum.photos/seed/post-language/400/240" },
  { id: "b7", title: "IELTS Reading: 7 tips for skimming effectively", author: "Linh Nguyen", excerpt: "Stop reading every word. These 7 techniques save precious time.", likes: 521, comments: 63, tags: ["IELTS", "Academic"], createdAt: "6d ago", readTime: "7 min read", image: "https://picsum.photos/seed/post-reading/400/240" },
  { id: "b8", title: "Why you should start a community project", author: "Bao Long", excerpt: "We started a clean-up group. A year later it's a registered NGO.", likes: 112, comments: 15, tags: ["Community"], createdAt: "1w ago", readTime: "9 min read", image: "https://picsum.photos/seed/post-community/400/240" },
  { id: "b9", title: "Photography composition cheat sheet", author: "Duc Pham", excerpt: "Rule of thirds, leading lines, symmetry \u2014 a cheat sheet for every shoot.", likes: 445, comments: 28, tags: ["Photography"], createdAt: "2d ago", readTime: "3 min read", image: "https://picsum.photos/seed/post-composition/400/240" },
  { id: "b10", title: "Building a personal brand without burning out", author: "Minh Anh", excerpt: "I grew from zero to 50K while working full-time. It's about having a system.", likes: 167, comments: 22, tags: ["Personal development"], createdAt: "5d ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-brand/400/240" },
  { id: "b11", title: "Coding interview prep guide for 2026", author: "Huy Tran", excerpt: "More system design, less leetcode. What to focus on this year.", likes: 289, comments: 41, tags: ["Technology"], createdAt: "3d ago", readTime: "15 min read", image: "https://picsum.photos/seed/post-interview/400/240" },
  { id: "b12", title: "How to start a conversation in any language", author: "Linh Nguyen", excerpt: "5 conversation starters that work in any language. Connection over perfection.", likes: 198, comments: 19, tags: ["Languages"], createdAt: "1w ago", readTime: "5 min read", image: "https://picsum.photos/seed/post-conversation/400/240" },
];

export function SavedPage() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setSavedIds(new Set(JSON.parse(localStorage.getItem("tutoria_saves") || "[]")));
    } catch {}
  }, []);

  const savedPosts = POSTS.filter(p => savedIds.has(p.id));
  const savedBlogs = BLOGS.filter(b => savedIds.has(b.id));
  const total = savedPosts.length + savedBlogs.length;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <main className="flex-1">
        <div className="max-w-[680px] mx-auto px-4 pt-12 pb-1">
          <a href="/discussions"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-4">
            <IconArrowLeft size={14} /> Discussions
          </a>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Saved</h1>
          <p className="mt-2 text-sm text-muted">{total} saved {total === 1 ? "item" : "items"}</p>
        </div>

        <div className="max-w-[680px] mx-auto px-4 pb-16 pt-6 space-y-3">
          {total === 0 && (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <IconBookmark size={32} className="mx-auto text-muted/40" />
              <p className="mt-3 text-sm text-muted">Nothing saved yet.</p>
              <p className="text-xs text-muted mt-1">Tap the bookmark icon on posts and blogs to save them here.</p>
            </div>
          )}

          {savedPosts.map(post => (
            <div key={post.id}
              className="rounded-2xl border border-border bg-background p-5">
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
                  <div className="flex items-center gap-1.5 mt-3">
                    {post.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted">
                    <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{post.likes}</span></div>
                    <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{post.comments}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {savedBlogs.map(blog => (
            <a key={blog.id} href={`/discussions/blogs/${blog.id}`}
              className="block rounded-2xl border border-border bg-background p-5 hover:shadow-sm hover:border-primary/20 transition-all duration-200 group">
              <div className="flex items-start gap-4">
                {blog.image && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface">
                    <img src={blog.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{blog.title}</h2>
                  <p className="mt-1 text-xs text-muted line-clamp-1">{blog.excerpt}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted flex-wrap">
                    <span className="font-medium text-foreground">{blog.author}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{blog.createdAt}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{blog.readTime}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                    <div className="flex items-center gap-1"><IconHeart size={13} /><span className="tabular-nums">{blog.likes}</span></div>
                    <div className="flex items-center gap-1"><IconMessage2 size={13} /><span className="tabular-nums">{blog.comments}</span></div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
