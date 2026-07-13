export interface ForYouItem {
  type: string;
  typeLabel: string;
  typeColor: string;
  title: string;
  author: string;
  meta: string;
  saves?: number;
  comments?: number;
  rating?: number;
  image: string;
  href: string;
  online?: boolean;
  price?: string;
  topic?: string;
}

export const forYouItems: ForYouItem[] = [
  { type: "Article", typeLabel: "ARTICLE", typeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", title: "Five mistakes beginners make when learning photography", author: "Duc Pham", meta: "8 min read", saves: 234, comments: 18, image: "https://picsum.photos/seed/fyp-photo/400/240", href: "/discussions/blogs/b1", online: true, price: "Free", topic: "Photography" },
  { type: "One-on-one", typeLabel: "ONE-ON-ONE", typeColor: "bg-primary/10 text-primary-dark dark:text-primary-light", title: "Public speaking: from nervous to natural in 30 days", author: "Minh Anh", meta: "6 sessions", image: "https://picsum.photos/seed/fyp-speaking/400/240", href: "/people?topic=Personal+development", online: true, price: "Paid", topic: "Personal development" },
  { type: "Course", typeLabel: "COURSE", typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", title: "Complete web development bootcamp 2026", author: "Huy Tran", meta: "48 lessons", rating: 4.8, image: "https://picsum.photos/seed/fyp-web/400/240", href: "/courses?topic=Technology", online: true, price: "Paid", topic: "Technology" },
  { type: "Community", typeLabel: "COMMUNITY", typeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", title: "Young Founders Vietnam", author: "Build ideas, meet collaborators", meta: "1,200 members", image: "https://picsum.photos/seed/fyp-founders/400/240", href: "/communities?topic=Business", topic: "Business" },
  { type: "Workshop", typeLabel: "WORKSHOP", typeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", title: "Beginner pottery: make your first cup", author: "Thu Ha", meta: "Sat, 2:00 PM", image: "https://picsum.photos/seed/fyp-pottery/400/240", href: "/events?topic=Creative+arts", online: false, price: "Paid", topic: "Creative arts" },
  { type: "Article", typeLabel: "ARTICLE", typeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", title: "How I improved my IELTS speaking from 6.0 to 7.5", author: "Linh Nguyen", meta: "6 min read", saves: 412, comments: 37, image: "https://picsum.photos/seed/fyp-ielts/400/240", href: "/discussions/blogs/b2", online: true, price: "Free", topic: "Languages" },
  { type: "Course", typeLabel: "COURSE", typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", title: "IELTS Speaking Masterclass", author: "Linh Nguyen", meta: "24 lessons", rating: 4.9, image: "https://picsum.photos/seed/fyp-masterclass/400/240", href: "/courses?topic=Languages", online: true, price: "Paid", topic: "Languages" },
  { type: "Community", typeLabel: "COMMUNITY", typeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", title: "Hanoi Photography Walks", author: "Photo walks every weekend", meta: "850 members", image: "https://picsum.photos/seed/fyp-photowalk/400/240", href: "/communities?topic=Photography", topic: "Photography" },
  { type: "One-on-one", typeLabel: "ONE-ON-ONE", typeColor: "bg-primary/10 text-primary-dark dark:text-primary-light", title: "Coding mentorship with Huy", author: "Huy Tran", meta: "Hourly sessions", image: "https://picsum.photos/seed/fyp-mentor/400/240", href: "/people?topic=Technology", online: true, price: "Paid", topic: "Technology" },
  { type: "Workshop", typeLabel: "WORKSHOP", typeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", title: "Startup Networking Night", author: "Bao Long", meta: "Fri, 6:30 PM", image: "https://picsum.photos/seed/fyp-networking/400/240", href: "/events?topic=Business", online: false, price: "Free", topic: "Business" },
];
