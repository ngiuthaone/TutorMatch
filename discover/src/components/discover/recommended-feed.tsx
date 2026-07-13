"use client";

import { IconStar, IconClock, IconHeart, IconBookmark } from "@tabler/icons-react";

interface FeedItem {
  type: string;
  typeColor: string;
  title: string;
  author: string;
  image: string;
  time?: string;
  rating?: number;
  members?: number;
  price?: string;
  date?: string;
  saves?: number;
  comments?: number;
}

const items: FeedItem[] = [
  {
    type: "ARTICLE",
    typeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    title: "Five mistakes beginners make when learning photography",
    author: "Duc Pham",
    time: "8 min read",
    saves: 234,
    comments: 18,
    image: "https://picsum.photos/seed/photography-mistakes/400/240",
  },
  {
    type: "ONE-ON-ONE",
    typeColor: "bg-primary/10 text-primary-dark dark:text-primary-light",
    title: "Public speaking: from nervous to natural in 30 days",
    author: "Minh Anh",
    time: "6 sessions",
    price: "From 250,000 VND",
    image: "https://picsum.photos/seed/public-speaking/400/240",
  },
  {
    type: "COURSE",
    typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    title: "Complete web development bootcamp 2026",
    author: "Huy Tran",
    time: "48 lessons",
    rating: 4.8,
    image: "https://picsum.photos/seed/web-dev/400/240",
  },
  {
    type: "COMMUNITY",
    typeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    title: "Young Founders Vietnam",
    author: "Build ideas, meet collaborators",
    members: 1200,
    image: "https://picsum.photos/seed/young-founders/400/240",
  },
  {
    type: "WORKSHOP",
    typeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    title: "Beginner pottery: make your first cup",
    author: "Thu Ha",
    time: "2 hours",
    date: "Next Saturday",
    image: "https://picsum.photos/seed/pottery/400/240",
  },
];

export function RecommendedFeed() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Recommended for you
          </h2>
          <a
            href="/discover/for-you"
            className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            See all recommendations
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <a
              key={item.title}
href="/discover/for-you"
              className="group rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden"
            >
              <div className="aspect-[5/3] overflow-hidden bg-surface relative">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <span
                  className={`absolute top-3 left-3 px-2 py-0.5 text-[10px] font-semibold rounded-md ${item.typeColor}`}
                >
                  {item.type}
                </span>
                <button className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/40 transition-colors">
                  <IconBookmark size={14} />
                </button>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted mt-1.5">{item.author}</p>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                  {item.time && (
                    <div className="flex items-center gap-1">
                      <IconClock size={12} />
                      <span>{item.time}</span>
                    </div>
                  )}
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      <IconStar size={12} className="text-amber-400 fill-amber-400" />
                      <span>{item.rating}</span>
                    </div>
                  )}
                  {item.members && (
                    <span>{item.members.toLocaleString("en-US")} members</span>
                  )}
                  {item.price && (
                    <span className="font-medium text-foreground">{item.price}</span>
                  )}
                  {item.date && (
                    <span>{item.date}</span>
                  )}
                </div>

                {item.saves !== undefined && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <div className="flex items-center gap-1">
                      <IconBookmark size={12} />
                      <span>{item.saves}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconHeart size={12} />
                      <span>{item.comments}</span>
                    </div>
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
