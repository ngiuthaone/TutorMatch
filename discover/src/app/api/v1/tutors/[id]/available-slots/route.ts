import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tutorProfileId } = await params;
  if (!isUuid(tutorProfileId)) {
    return NextResponse.json({ slots: [] });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !isIsoDate(date)) {
    return NextResponse.json({ slots: [] });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const key = serviceKey || publishableKey;
  if (!url || !key) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.rpc("get_tutor_available_slots", {
    p_tutor_profile_id: tutorProfileId,
    p_from_date: date,
    p_days: 1,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slots: AvailableSlot[] = (Array.isArray(data) ? data : [])
    .filter(
      (slot: Partial<AvailableSlot>): slot is AvailableSlot =>
        typeof slot?.date === "string" &&
        typeof slot?.startTime === "string" &&
        typeof slot?.endTime === "string" &&
        typeof slot?.timezone === "string",
    )
    .filter((slot) => slot.date === date);

  return NextResponse.json({ slots });
}
