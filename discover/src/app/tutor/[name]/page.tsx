import { TutorProfileFrame } from "@/components/discover/tutor-profile-frame";
import { listTutors, isPublicTutorUuid, getTutor } from "@/lib/tutor-cv-api";
import { TutorProfileReviews } from "./tutor-profile-reviews";
import { TutorProfileSessions } from "./tutor-profile-sessions";
import { TutorActivitySparkline } from "@/components/tutor/tutor-activity-sparkline";

export const dynamic = "force-dynamic";

async function resolveTutor(name: string): Promise<{ id: string; displayName: string } | null> {
  const decoded = decodeURIComponent(name).trim();
  if (isPublicTutorUuid(decoded)) {
    try {
      const detail = await getTutor(decoded);
      return { id: detail.id, displayName: detail.displayName };
    } catch {
      return null;
    }
  }
  const wanted = decoded.toLocaleLowerCase();
  let cursor: string | null = null;
  for (let page = 0; page < 6; page += 1) {
    try {
      const result = await listTutors({ limit: 24, ...(cursor ? { cursor } : {}) });
      const match = result.items.find((item) => item.displayName.toLocaleLowerCase().trim() === wanted);
      if (match) return { id: match.id, displayName: match.displayName };
      if (!result.nextCursor) return null;
      cursor = result.nextCursor;
    } catch {
      return null;
    }
  }
  return null;
}

export default async function TutorProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const resolved = await resolveTutor(name);

  return (
    <div>
      <TutorProfileFrame name={name} />
      {resolved && (
        <aside className="bg-[#101011] px-5 py-10 text-[#e8e6df] sm:px-10">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_.8fr]">
            <TutorProfileReviews tutorProfileId={resolved.id} />
            <TutorProfileSessions tutorProfileId={resolved.id} />
          </div>
        </aside>
      )}
      {resolved && (
        <section className="bg-white px-5 py-10 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <TutorActivitySparkline tutorProfileId={resolved.id} />
          </div>
        </section>
      )}
    </div>
  );
}
