import Link from "next/link";
import { callTutorRpc } from "@/lib/tutor-profile-rpc";

interface TutorProfileSessionsProps {
  tutorProfileId: string;
}

interface BookableSession {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  spotsLeft: number | null;
  offering?: { id: string; kind: string; title: string };
}

function formatWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export async function TutorProfileSessions({ tutorProfileId }: TutorProfileSessionsProps) {
  const all = await callTutorRpc<BookableSession[]>("list_bookable_sessions", {
    p_tutor_profile_id: tutorProfileId,
  });
  const sessions = (all ?? [])
    .filter((session) => session.status === "scheduled" && Date.parse(session.startsAt) > Date.now())
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .slice(0, 8);

  return (
    <section aria-labelledby="tutor-sessions-heading" className="rounded-3xl border border-white/[.12] bg-[#17181c] p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="tutor-sessions-heading" className="text-lg font-semibold tracking-tight">
          Upcoming sessions
        </h2>
        <p className="text-xs text-white/45">{sessions.length} scheduled</p>
      </header>
      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">No upcoming sessions published yet. Check back soon.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
              <div>
                <p className="text-sm font-medium text-white">{formatWhen(session.startsAt)}</p>
                <p className="mt-1 text-xs text-white/55">
                  {session.offering?.title ?? "1:1 lesson"}
                </p>
                {session.spotsLeft !== null && (
                  <p className="mt-1 text-xs text-white/40">
                    {Math.max(0, session.spotsLeft)} spot{session.spotsLeft === 1 ? "" : "s"} left
                  </p>
                )}
              </div>
              <Link
                href={`/tutor/${encodeURIComponent(tutorProfileId)}?bookingSessionId=${encodeURIComponent(session.id)}&bookingStep=review`}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black"
              >
                Book
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
