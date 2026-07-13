"use client";

import { IconStar, IconMapPin, IconHeart } from "@tabler/icons-react";

const creators = [
  {
    name: "Minh Anh",
    expertise: "Public Speaking Coach",
    bio: "Helped 200+ learners speak with confidence",
    rating: 4.9,
    price: "From 250,000 VND",
    location: "Online",
    image: "https://picsum.photos/seed/minh-anh/200/200",
  },
  {
    name: "Huy Tran",
    expertise: "Full-stack Developer",
    bio: "8 years building web apps for startups",
    rating: 4.8,
    price: "From 350,000 VND",
    location: "Online",
    image: "https://picsum.photos/seed/huy-tran/200/200",
  },
  {
    name: "Linh Nguyen",
    expertise: "English & IELTS",
    bio: "7.5 IELTS scorer, 5 years teaching",
    rating: 4.9,
    price: "From 200,000 VND",
    location: "Online & In person",
    image: "https://picsum.photos/seed/linh-nguyen/200/200",
  },
  {
    name: "Duc Pham",
    expertise: "Photography Artist",
    bio: "Commercial photographer, exhibition curator",
    rating: 4.7,
    price: "From 400,000 VND",
    location: "In person",
    image: "https://picsum.photos/seed/duc-pham/200/200",
  },
  {
    name: "Thu Ha",
    expertise: "Cooking Instructor",
    bio: "French culinary arts, 200+ classes taught",
    rating: 4.9,
    price: "From 300,000 VND",
    location: "Online & In person",
    image: "https://picsum.photos/seed/thu-ha/200/200",
  },
];

export function CreatorCards() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            People you may want to learn from
          </h2>
          <a
            href="/people"
            className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Explore people
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {creators.map((creator) => (
            <div
              key={creator.name}
              className="group rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden"
            >
              <div className="aspect-square overflow-hidden bg-surface">
                <img
                  src={creator.image}
                  alt={creator.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground">{creator.name}</h3>
                <p className="text-xs text-primary font-medium mt-0.5">{creator.expertise}</p>
                <p className="text-xs text-muted mt-1.5 line-clamp-1">{creator.bio}</p>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <IconStar size={12} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium text-foreground">{creator.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconMapPin size={12} className="text-muted" />
                    <span className="text-xs text-muted">Online</span>
                  </div>
                </div>

                <p className="text-xs font-medium text-foreground mt-2">{creator.price}</p>

                <div className="mt-3 flex items-center gap-2">
                  <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors">
                    View profile
                  </button>
                  <button className="p-1.5 rounded-lg border border-border text-muted hover:text-red-400 hover:border-red-200 transition-all">
                    <IconHeart size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
