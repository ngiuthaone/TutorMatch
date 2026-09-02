import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Pattern adapted from NextTutor's @vercel/og tutor card route (MIT). Reimplemented under
// Tutoria's own visual language (charcoal gradient, generous padding) — no shared styles or
// markup with the source. If the slug cannot be resolved to a published tutor, we fall back
// to a generic Tutoria card rather than 404 — OG scrapers handle failures poorly.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name: slug } = await params;
  let displayName = slug || "Tutor";
  let headline = "";
  let ratingText = "New tutor";
  let hourly = "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (url && key && slug) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/get_published_tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ p_tutor_profile_id: slug }),
      });
      if (r.ok) {
        const data: {
          displayName?: string;
          headline?: string;
          rating?: { count: number; average: number | null };
          hourlyRateVnd?: number | null;
        } | null = await r.json();
        if (data) {
          if (typeof data.displayName === "string" && data.displayName.length > 0) {
            displayName = data.displayName;
          }
          if (typeof data.headline === "string") headline = data.headline;
          if (data.rating && data.rating.count > 0 && typeof data.rating.average === "number") {
            ratingText = `${data.rating.average.toFixed(1)}★ (${data.rating.count})`;
          }
          if (typeof data.hourlyRateVnd === "number") {
            hourly = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(data.hourlyRateVnd)} VND/hr`;
          }
        }
      }
    } catch {
      // fall through with default values
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          background: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ fontSize: 28, color: "#a1a1aa", marginBottom: 16 }}>Tutoria</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginBottom: 16 }}>{displayName}</div>
        {headline && (
          <div style={{ fontSize: 32, color: "#d4d4d8", marginBottom: 24 }}>{headline}</div>
        )}
        <div style={{ display: "flex", gap: 24, fontSize: 28, color: "#a1a1aa" }}>
          {ratingText && <div>{ratingText}</div>}
          {hourly && <div>· {hourly}</div>}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
