"use client";

import { IconHeart, IconMessage2, IconBookmark, IconShare, IconArrowLeft, IconClock } from "@tabler/icons-react";

const blogs: Record<string, {
  id: string; title: string; author: string; role: string; avatar: string;
  content: string; likes: number; comments: number; tags: string[]; createdAt: string; readTime: string; image: string;
}> = {
  b1: { id: "b1", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "After teaching photography workshops for 5 years, I've noticed the same patterns over and over. Here are the most common mistakes and how to fix them — whether you're shooting on a DSLR or just your phone.\n\n1. Not understanding your camera's light meter\nMost beginners rely on auto mode and never learn to read the exposure meter. This single skill changes everything.\n\n2. Shooting in auto white balance\nYour camera guesses wrong more often than you'd think. Set it manually based on your lighting situation.\n\n3. Ignoring composition rules\nRule of thirds, leading lines, and negative space aren't restrictions — they're tools that work.\n\n4. Taking too many photos instead of thinking\nSlow down. Frame your shot. Wait for the right moment. One great photo beats 100 mediocre ones.\n\n5. Neglecting post-processing\nEven the best photographers edit their work. You don't need Photoshop — Lightroom mobile is free and powerful.\n\nWhat mistakes have you noticed in your own learning journey? Share below!", likes: 234, comments: 18, tags: ["Photography"], createdAt: "2h ago", readTime: "8 min read", image: "https://picsum.photos/seed/post-photo/400/240" },
  b2: { id: "b2", title: "How I improved my IELTS speaking from 6.0 to 7.5 in 3 months", author: "Linh Nguyen", role: "English & IELTS Coach", avatar: "https://picsum.photos/seed/linh-avatar/60/60", content: "It was a grind, but completely doable. The key insight that changed everything: stop memorising answers and start thinking in English. Here's my full routine.\n\nMonths 1-2: Input phase\n- Watched 30 min of English YouTube daily (no subtitles)\n- Listened to BBC 6 Minute English during commutes\n- Read one English article out loud every morning\n\nMonth 3: Output phase\n- Recorded myself answering prompts and listened back\n- Practised with a partner 3x a week\n- Focused on fluency over accuracy\n\nThe biggest breakthrough came when I stopped trying to sound native and started focusing on clarity.", likes: 412, comments: 37, tags: ["IELTS", "Languages"], createdAt: "5h ago", readTime: "6 min read", image: "https://picsum.photos/seed/post-ielts/400/240" },
  b3: { id: "b3", title: "What I wish I knew before starting a small business in Vietnam", author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "Four years in, here are the hard lessons I learned about regulations, hiring, market fit, and why having a co-founder matters more than you think.\n\n1. Regulations are complex — get help early\nDon't try to handle licensing and taxes alone. A good accountant pays for themselves.\n\n2. Hiring is the hardest part\nSkills can be taught. Attitude and reliability cannot. Take your time with early hires.\n\n3. Market fit takes longer than expected\nWe pivoted three times before finding product-market fit. Each pivot taught us something valuable.\n\n4. A co-founder makes the journey bearable\nThe emotional lows of entrepreneurship are real. Having someone who shares the weight is invaluable.", likes: 189, comments: 24, tags: ["Business"], createdAt: "1d ago", readTime: "10 min read", image: "https://picsum.photos/seed/post-business/400/240" },
};

const comments: Record<string, { author: string; role: string; avatar: string; content: string; createdAt: string; likes: number }[]> = {
  b1: [
    { author: "Minh Anh", role: "Public Speaking Coach", avatar: "https://picsum.photos/seed/minh-avatar/60/60", content: "Great list! I'd add a 6th: not reviewing your photos critically. Every photographer should ask 'what could be better?'", createdAt: "1h ago", likes: 28 },
    { author: "Thu Ha", role: "Cooking Instructor", avatar: "https://picsum.photos/seed/thu-avatar/60/60", content: "The point about slowing down really resonates. I see the same thing with cooking — people rush and miss the fundamentals.", createdAt: "45m ago", likes: 15 },
  ],
  b2: [
    { author: "Duc Pham", role: "Photography Artist", avatar: "https://picsum.photos/seed/duc-avatar/60/60", content: "Recording yourself is brilliant. I do the same for my teaching.", createdAt: "3h ago", likes: 22 },
    { author: "Huy Tran", role: "Full-stack Developer", avatar: "https://picsum.photos/seed/huy-avatar/60/60", content: "The input phase approach works for coding too. Read code before writing it.", createdAt: "2h ago", likes: 18 },
  ],
};

export function BlogDetail({ id }: { id: string }) {
  const blog = blogs[id];

  if (!blog) {
    return (
      <main className="flex-1">
        <div className="max-w-[680px] mx-auto px-4 pt-12 pb-16 text-center">
          <h1 className="text-xl font-semibold text-foreground">Blog not found</h1>
          <p className="text-sm text-muted mt-2">This blog post may have been removed or doesn't exist.</p>
          <a href="/discussions" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            <IconArrowLeft size={14} /> Back to discussions
          </a>
        </div>
      </main>
    );
  }

  const postComments = comments[id] || [];

  return (
    <main className="flex-1">
      <div className="max-w-[680px] mx-auto px-4 pt-12 pb-16">
        <a href="/discussions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6">
          <IconArrowLeft size={14} /> All discussions
        </a>

        <article className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="aspect-[3/2] overflow-hidden bg-surface">
            <img src={blog.image} alt={blog.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-6">
            <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
              <span className="font-semibold text-foreground">{blog.author}</span>
              <span className="text-muted">{blog.role}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>{blog.createdAt}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1"><IconClock size={12} />{blog.readTime}</span>
            </div>
            <h1 className="mt-3 text-xl md:text-2xl font-semibold tracking-tight text-foreground">{blog.title}</h1>
            <div className="flex items-center gap-1.5 mt-2">
              {blog.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[10px] rounded-md bg-primary/10 text-primary-dark dark:text-primary-light">{t}</span>
              ))}
            </div>
            <div className="mt-6 text-sm text-foreground leading-relaxed whitespace-pre-line">{blog.content}</div>
            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border text-xs text-muted">
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-400 transition-colors">
                <IconHeart size={15} /><span className="tabular-nums">{blog.likes}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors">
                <IconMessage2 size={15} /><span className="tabular-nums">{blog.comments}</span>
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors ml-auto">
                <IconBookmark size={15} />
              </button>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface hover:text-foreground transition-colors">
                <IconShare size={15} />
              </button>
            </div>
          </div>
        </article>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <IconMessage2 size={16} className="text-primary" />
            {postComments.length} {postComments.length === 1 ? "Comment" : "Comments"}
          </h2>
          <div className="space-y-3">
            {postComments.map((c, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-start gap-3">
                  <img src={c.avatar} alt={c.author} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                      <span className="font-medium text-foreground">{c.author}</span>
                      <span className="text-muted">{c.role}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{c.createdAt}</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground leading-relaxed">{c.content}</p>
                    <button className="flex items-center gap-1 mt-2 text-xs text-muted hover:text-red-400 transition-colors">
                      <IconHeart size={12} /><span>{c.likes}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
