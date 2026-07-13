"use client";

import { IconUsers } from "@tabler/icons-react";

const communities = [
  {
    name: "Young Founders Vietnam",
    description: "Build ideas, meet collaborators, and learn from early-stage founders.",
    members: 1200,
    active: "12 posts today",
    images: [
      "https://picsum.photos/seed/founder1/100/100",
      "https://picsum.photos/seed/founder2/100/100",
      "https://picsum.photos/seed/founder3/100/100",
    ],
  },
  {
    name: "Hanoi Photography Walks",
    description: "Learn together, share work, and attend local photo walks every weekend.",
    members: 850,
    active: "8 posts today",
    images: [
      "https://picsum.photos/seed/photo1/100/100",
      "https://picsum.photos/seed/photo2/100/100",
      "https://picsum.photos/seed/photo3/100/100",
    ],
  },
  {
    name: "IELTS Speaking Practice",
    description: "Find partners, exchange feedback, and practice consistently to improve.",
    members: 2100,
    active: "24 posts today",
    images: [
      "https://picsum.photos/seed/ielts1/100/100",
      "https://picsum.photos/seed/ielts2/100/100",
      "https://picsum.photos/seed/ielts3/100/100",
    ],
  },
  {
    name: "Vietnamese Creators Collective",
    description: "Supporting local creators to share, collaborate, and grow their audience.",
    members: 3400,
    active: "45 posts today",
    images: [
      "https://picsum.photos/seed/creator1/100/100",
      "https://picsum.photos/seed/creator2/100/100",
      "https://picsum.photos/seed/creator3/100/100",
    ],
  },
];

export function CommunitiesSection() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Communities to explore
          </h2>
          <a
            href="/communities"
            className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Explore communities
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {communities.map((community) => (
            <div
              key={community.name}
              className="rounded-2xl border border-border bg-background p-5 hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <h3 className="font-semibold text-sm text-foreground">{community.name}</h3>
              <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-2">
                {community.description}
              </p>

              <div className="flex items-center gap-3 mt-4">
                <div className="flex -space-x-2">
                  {community.images.map((src, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-background overflow-hidden"
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <IconUsers size={12} />
                  <span>{community.members.toLocaleString("en-US")}</span>
                </div>
              </div>

              <p className="text-xs text-muted mt-2">{community.active}</p>

              <button className="mt-4 w-full px-3 py-2 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all duration-200">
                Join community
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
