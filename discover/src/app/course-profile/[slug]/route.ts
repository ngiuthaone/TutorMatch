import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCourseBySlug, getSimilarCourses } from "@/lib/course-data";

export const dynamic = "force-dynamic";

function serializeForScript(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
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
  const course = getCourseBySlug(slug) ?? null;
  const similarCourses = course ? getSimilarCourses(slug) : [];
  const runtime = `<script>window.__TUTORIA_COURSE_PROFILE__=${serializeForScript({
    slug,
    course,
    similarCourses,
  })};</script><script src="/course-profile-data.js"></script>`;
  const html = template.replace("<script>", `${runtime}\n  <script>`);

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
