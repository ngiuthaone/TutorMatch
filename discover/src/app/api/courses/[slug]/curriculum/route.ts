import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const DATA_DIR = path.join(process.cwd(), "data");

interface Lesson {
  id: string;
  title: string;
  lesson_type: "video" | "text" | "quiz" | "resource";
  position: number;
  section_id: string;
  video_url?: string;
  text_content?: string;
  is_preview: boolean;
}

interface Section {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
}

interface CourseData {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
}

async function readCourseData(slug: string): Promise<CourseData | null> {
  try {
    const filePath = path.join(DATA_DIR, "courses", `${slug}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as CourseData;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const course = await readCourseData(slug);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const completedLessons: string[] = [];

    return NextResponse.json({
      courseId: course.id,
      title: course.title,
      sections: course.sections,
      completedLessons,
    });
  } catch (error) {
    console.error("Failed to fetch course curriculum:", error);
    return NextResponse.json({ error: "Failed to fetch curriculum" }, { status: 500 });
  }
}
