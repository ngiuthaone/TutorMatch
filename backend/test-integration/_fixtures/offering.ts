import { randomUUID } from "node:crypto";
import postgres from "postgres";

export function futureWindow(hoursOffset = 2) {
  const startsAt = new Date(Date.now() + hoursOffset * 3600e3).toISOString();
  const endsAt = new Date(Date.now() + (hoursOffset + 1) * 3600e3).toISOString();
  return { startsAt, endsAt };
}

export type OfferingType = "workshop" | "tutor" | "class" | "event";
export type PricingModel = "flat_per_participant_v1" | "hourly_v1";

let cachedSql: ReturnType<typeof postgres> | null = null;
function adminSql() {
  if (cachedSql) return cachedSql;
  const url = process.env.SUPABASE_TEST_DB_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
  cachedSql = postgres(url, { max: 4, prepare: false });
  return cachedSql;
}

export async function makeOffering(
  client: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: { id: string; version: number } | null; error: { message: string } | null }>;
  },
  hostUserId: string,
  kind: OfferingType,
  pricingModel: PricingModel = "flat_per_participant_v1",
  overrides: { hourlyRateVnd?: number; pricePerParticipantVnd?: number } = {},
): Promise<string> {
  const args: Record<string, unknown> = {
    p_offering_type: kind,
    p_title: `${kind[0].toUpperCase()}${kind.slice(1)} ${randomUUID().slice(0, 8)}`,
    p_pricing_model: pricingModel,
    p_booking_mode: "instant",
  };
  if (pricingModel === "flat_per_participant_v1") {
    args.p_price_per_participant_vnd = overrides.pricePerParticipantVnd ?? 500000;
  } else if (pricingModel === "hourly_v1") {
    args.p_hourly_rate_vnd = overrides.hourlyRateVnd ?? 200000;
  }
  const offering = await client.rpc("create_offering", args);
  if (offering.error || !offering.data) throw offering.error ?? new Error(`create_offering failed`);

  const sql = adminSql();
  await sql`
    insert into public.offering_hosts (offering_id, user_id, capability, granted_by)
    values (${offering.data.id}, ${hostUserId}, 'owner', ${hostUserId})
    on conflict (offering_id, user_id) where revoked_at is null do nothing
  `;

  const published = await client.rpc("update_offering_status", {
    p_offering_id: offering.data.id,
    p_expected_version: offering.data.version,
    p_status: "published",
  });
  if (published.error) throw new Error(`publish failed: ${published.error.message}`);
  return offering.data.id;
}

export async function createSessionWithOffering(
  tutor: { client: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> } },
  offeringId: string,
  payload: Record<string, unknown>,
) {
  const session = await tutor.client.rpc("create_session", { payload: { offeringId, ...payload } });
  if (session.error) throw new Error(`create_session failed: ${session.error.message}`);
  return session.data as { id: string; version: number };
}