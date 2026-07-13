"use client";

import { IconHeart, IconMessage2 } from "@tabler/icons-react";

const recentPosts = [
  { id: "p1", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Golden hour at West Lake today. The light was absolutely incredible 🌅", image: "https://picsum.photos/seed/golden-hour/600/400", likes: 142, comments: 8, tags: ["Photography"], createdAt: "1h ago" },
  { id: "p2", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "Just finished a 2-hour speaking session with a student who went from total silence to a full 7-minute monologue. This is why I love teaching. 🎯", likes: 89, comments: 12, tags: ["IELTS", "Languages"], createdAt: "3h ago" },
  { id: "p3", author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "Made phở for 20 people today. My kitchen smells like paradise. Recipe in comments 🍜", image: "https://picsum.photos/seed/pho-bowl/600/400", likes: 203, comments: 24, tags: ["Cooking"], createdAt: "5h ago" },
];

export function Discussions() {
  return (
    <section className="py-12">
      <div className="max-w-[680px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Discussions</h2>
          <a href="/discussions" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">See all</a>
        </div>
        <div className="space-y-3">
          {recentPosts.map((post) => (
            <a key={post.id} href="/discussions"
              className="block rounded-2xl border border-border bg-background p-4 hover:shadow-sm hover:border-primary/20 transition-all duration-200">
              <div className="flex items-start gap-3">
                <img src={post.avatar} alt={post.author} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-foreground">{post.author}</span>
                    <span className="text-muted">{post.role}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-muted">{post.createdAt}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground leading-relaxed line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {post.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <div className="flex items-center gap-1">
                      <IconHeart size={13} />
                      <span className="tabular-nums">{post.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconMessage2 size={13} />
                      <span className="tabular-nums">{post.comments}</span>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
