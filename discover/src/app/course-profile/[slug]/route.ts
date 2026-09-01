import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCatalogCourseBySlug, getCatalogSimilarCourses, type CourseDetail } from "@/lib/course-data";
import { getApiBaseUrl, isLiveMode } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

function serializeForScript(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

async function fetchBackendCourse(slug: string): Promise<CourseDetail | null> {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/marketplace/course/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: boolean; item?: { payload?: Record<string, unknown>; slug?: string; title?: string } };
    if (body.ok !== true || !body.item) return null;
    const p = body.item.payload ?? {};
    return {
      slug: body.item.slug ?? slug,
      title: body.item.title ?? String(p.title ?? ""),
      subtitle: String(p.subtitle ?? ""),
      category: String(p.category ?? "General"),
      level: String(p.level ?? "All levels"),
      instructor: String(p.instructor ?? p.creatorName ?? "Tutoria creator"),
      instructorRole: String(p.instructorRole ?? "Course creator"),
      instructorBio: String(p.instructorBio ?? ""),
      instructorImage: String(p.instructorImage ?? ""),
      image: String(p.image ?? ""),
      lessons: Number(p.lessons ?? 0),
      duration: String(p.duration ?? "0h"),
      rating: Number(p.rating ?? 0),
      students: Number(p.students ?? 0),
      price: String(p.price ?? "Free"),
      description: Array.isArray(p.description) ? p.description as string[] : [],
      outcomes: Array.isArray(p.outcomes) ? p.outcomes as string[] : [],
      requirements: Array.isArray(p.requirements) ? p.requirements as string[] : [],
      faqs: Array.isArray(p.faqs) ? p.faqs as { question: string; answer: string }[] : [],
      curriculum: Array.isArray(p.curriculum) ? p.curriculum as { title: string; duration: string; lessons: string[] }[] : [],
      reviews: Array.isArray(p.reviews) ? (p.reviews as { name?: string; rating?: number; date?: string; body?: string; avatar?: string }[]).map((r) => ({ name: String(r.name ?? ""), rating: Number(r.rating ?? 0), date: String(r.date ?? ""), body: String(r.body ?? ""), avatar: String(r.avatar ?? "") })) : [],
      reviewCount: Number(p.reviewCount ?? 0),
      updated: String(p.updated ?? ""),
      language: String(p.language ?? "English"),
      certificate: Boolean(p.certificate),
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const template = await readFile(
    path.join(process.cwd(), "public", "course-profile.html"),
    "utf8",
  );
  let course = getCatalogCourseBySlug(slug) ?? null;
  const similarCourses = course ? getCatalogSimilarCourses(slug) : [];

  // In live mode, non-catalog slugs fall back to the production backend read.
  if (!course && isLiveMode()) {
    course = await fetchBackendCourse(slug);
  }

  const runtime = `<script>window.__TUTORIA_COURSE_PROFILE__=${serializeForScript({
    slug,
    course,
    similarCourses,
  })};</script><script>window.addEventListener("scroll",()=>window.parent.postMessage({type:"tutoria-course-profile-scroll",y:window.scrollY},"*"),{passive:true});</script><script src="/course-profile-data.js"></script>`;
  const html = template.replace("<script>", `${runtime}\n  <script>`);

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
