"use client";

import { IconStar, IconClock, IconUsers } from "@tabler/icons-react";

const courses = [
  {
    title: "Complete Web Development Bootcamp 2026",
    instructor: "Huy Tran",
    lessons: 48,
    duration: "16 hours",
    rating: 4.8,
    students: 1200,
    level: "Beginner",
    image: "https://picsum.photos/seed/web-course/400/240",
  },
  {
    title: "IELTS Speaking Masterclass",
    instructor: "Linh Nguyen",
    lessons: 24,
    duration: "8 hours",
    rating: 4.9,
    students: 890,
    level: "Intermediate",
    image: "https://picsum.photos/seed/ielts-course/400/240",
  },
  {
    title: "Public Speaking for Professionals",
    instructor: "Minh Anh",
    lessons: 16,
    duration: "6 hours",
    rating: 4.7,
    students: 650,
    level: "All levels",
    image: "https://picsum.photos/seed/speaking-course/400/240",
  },
  {
    title: "Digital Photography Fundamentals",
    instructor: "Duc Pham",
    lessons: 32,
    duration: "12 hours",
    rating: 4.8,
    students: 720,
    level: "Beginner",
    image: "https://picsum.photos/seed/photo-course/400/240",
  },
];

export function CoursesSection() {
  return (
    <section className="py-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Courses to start your journey
          </h2>
          <a href="/courses" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">
            Browse courses
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {courses.map((course) => (
            <a
              key={course.title}
href="/courses"
              className="group rounded-2xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all duration-200 overflow-hidden"
            >
              <div className="aspect-[4/3] overflow-hidden bg-surface relative">
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-medium rounded-md bg-white/90 dark:bg-zinc-800/90 text-foreground">
                  {course.level}
                </span>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {course.title}
                </h3>
                <p className="text-xs text-muted mt-1.5">{course.instructor}</p>

                <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                  <div className="flex items-center gap-1">
                    <IconClock size={12} />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconStar size={12} className="text-amber-400 fill-amber-400" />
                    <span>{course.rating}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <IconUsers size={12} />
                    <span>{course.students.toLocaleString("en-US")} students</span>
                  </div>
                  <span className="text-xs font-medium text-primary">{course.lessons} lessons</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
