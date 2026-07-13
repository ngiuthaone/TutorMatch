import {
  IconChalkboardTeacher,
  IconBook2,
  IconArticle,
  IconVideo,
  IconUsersGroup,
  IconArrowRight,
} from "@tabler/icons-react";

const formats = [
  {
    title: "Find tutors",
    description: "Get personalized support from someone who understands your goals.",
    icon: IconChalkboardTeacher,
    gradient: "from-primary/10 to-primary/5",
  },
  {
    title: "Attend courses",
    description: "Follow structured lessons and learn at your own pace.",
    icon: IconBook2,
    gradient: "from-accent/10 to-accent/5",
  },
  {
    title: "Read articles",
    description: "Discover useful ideas, stories, and real-world experience.",
    icon: IconArticle,
    gradient: "from-primary/10 to-transparent",
  },
  {
    title: "Watch tutorials",
    description: "Learn through practical, step-by-step demonstrations.",
    icon: IconVideo,
    gradient: "from-accent/10 to-transparent",
  },
  {
    title: "Join workshops",
    description: "Practice, meet people, and turn knowledge into experience.",
    icon: IconUsersGroup,
    gradient: "from-primary/5 to-accent/5",
  },
];

export function LearningFormats() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Learn in the way that works for you
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {formats.map((format) => (
            <a
              key={format.title}
              href="#"
              className={`group relative p-5 rounded-2xl border border-border bg-gradient-to-br ${format.gradient} hover:shadow-md transition-all duration-200 overflow-hidden`}
            >
              <format.icon size={24} className="text-primary" />
              <h3 className="mt-4 font-semibold text-sm text-foreground">{format.title}</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed line-clamp-3">
                {format.description}
              </p>
              <IconArrowRight
                size={14}
                className="mt-3 text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
