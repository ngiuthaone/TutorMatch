export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import EditCoursePageClient from "./page-client";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center"><div className="text-sm text-[#9ca3af]">Loading editor…</div></div>}>
      <RequireAuth>
        <EditCoursePageClient courseId={id} />
      </RequireAuth>
    </Suspense>
  );
}
