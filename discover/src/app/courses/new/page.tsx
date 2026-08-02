import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";

export const metadata: Metadata = {
  title: "Create a course | Tutoria",
  description: "Build, preview, price, and publish a self-paced course on Tutoria.",
};

export default function NewCoursePage() {
  return (
    <RequireAuth>
      <iframe
        title="Create a course"
        src="/course-creator-reference.html"
        style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#e9ebed" }}
      />
    </RequireAuth>
  );
}
