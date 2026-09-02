import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-server-session";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId, videoPosition, completed } = body;

    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update progress:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
