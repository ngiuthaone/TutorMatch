import {
  IconPalette,
  IconCode,
  IconBook2,
  IconChalkboardTeacher,
  IconUsersGroup,
} from "@tabler/icons-react";

const categories = [
  {
    title: "Pick up a hobby",
    description: "Photography, guitar, cooking, chess, pottery, flower arranging, swimming.",
    icon: IconPalette,
    gradient: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    title: "Learn a practical skill",
    description: "Excel, coding, public speaking, design, marketing, AI, finance.",
    icon: IconCode,
    gradient: "from-accent/20 to-accent/5",
    iconBg: "bg-accent/10 text-accent",
  },
  {
    title: "Get academic support",
    description: "School subjects, university courses, IELTS, SAT, exam preparation.",
    icon: IconBook2,
    gradient: "from-primary/15 to-primary/5",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    title: "Share what you know",
    description: "Offer sessions, publish tutorials, teach a course, mentor others.",
    icon: IconChalkboardTeacher,
    gradient: "from-accent/15 to-accent/5",
    iconBg: "bg-accent/10 text-accent",
  },
  {
    title: "Find your people",
    description: "Communities, startup partners, volunteering, events, networking.",
    icon: IconUsersGroup,
    gradient: "from-primary/20 to-accent/5",
    iconBg: "bg-primary/10 text-primary",
  },
];

export function ExploreCategories() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Explore by intention
          </h2>
          <a
            href="#"
            className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            View all
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.title}
              type="button"
              className="group relative text-left p-5 rounded-2xl border border-border bg-gradient-to-br hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl ${cat.iconBg} flex items-center justify-center`}>
                  <cat.icon size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-sm text-foreground">{cat.title}</h3>
                <p className="mt-1.5 text-xs text-muted leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
