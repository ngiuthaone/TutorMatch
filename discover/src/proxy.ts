import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/courses/new") {
    return NextResponse.next();
  }

  const slug = request.nextUrl.pathname.slice("/courses/".length);
  return NextResponse.rewrite(new URL(`/course-profile/${encodeURIComponent(slug)}`, request.url));
}

export const config = {
  matcher: "/courses/:slug",
};
