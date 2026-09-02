import { randomUUID } from "node:crypto"; import { readFile } from "node:fs/promises"; import { fileURLToPath } from "node:url"; import { createClient } from "@supabase/supabase-js"; import postgres from "postgres"; import { afterAll, beforeAll, describe, expect, it } from "vitest"; import { signUpConfirmed } from "./auth-helpers.js";import { makeOffering } from "./_fixtures/offering.js";
const url=process.env.SUPABASE_TEST_URL,key=process.env.SUPABASE_TEST_PUBLISHABLE_KEY,dbUrl=process.env.SUPABASE_TEST_DB_URL,serviceKey=process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if(!url||!key||!dbUrl||!serviceKey)throw new Error("Integration tests require local Supabase URL, publishable key, DB URL, and service role key.");
if(!["localhost","127.0.0.1","host.docker.internal"].includes(new URL(url).hostname))throw new Error("Refusing to run integration tests against a non-local Supabase target.");
const anon=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),sql=postgres(dbUrl,{max:4}),password="Local-test-only-Password1!";
async function signup(role:"student"|"tutor"){const email=`tc-${randomUUID()}@example.test`;return signUpConfirmed({anon,url:url!,publishableKey:key!,serviceRoleKey:serviceKey!,email,password,metadata:{name:"TutorConc",role},trustedTutor:role==="tutor"})}
const FUTURE={startsAt:new Date(Date.now()+2*3600e3).toISOString(),endsAt:new Date(Date.now()+3*3600e3).toISOString()};
async function createSession(tutor:any,o:any={}){const offeringId=await makeOffering(tutor.client,tutor.user.id,"workshop");return tutor.client.rpc("create_session",{payload:{offeringId,...FUTURE,...o}})}
describe.sequential("tutor system concurrency invariants",()=>{
  beforeAll(async()=>{
    for(const n of ["0001_create_profiles.sql","0002_create_tutor_cvs.sql","0004_create_sessions_and_bookings.sql","0005_create_booking_session_rpcs.sql","0006_create_event_outbox.sql","0007_emit_domain_events_from_booking_session_rpcs.sql","20260907000001_tutor_reviews.sql","20260907000002_tutor_availability_exceptions.sql","20260907000003_tutor_dashboard_rpcs.sql","20260911000010_session_published_self_notification.sql"]){
      const m=await readFile(fileURLToPath(new URL(`../supabase/migrations/${n}`,import.meta.url)),"utf8");
      await sql.unsafe(m);
    }
    await sql`drop function if exists public.create_booking(uuid, integer)`;
  });

  it("1. two learners attempt to book the same session — exactly one wins",async()=>{
    const tutor=await signup("tutor");const l1=await signup("student");const l2=await signup("student");
    const s=await createSession(tutor,{maxParticipants:1});
    const results=await Promise.all([
      l1.client.rpc("create_booking",{session_id:s.data.id,participant_count:1}),
      l2.client.rpc("create_booking",{session_id:s.data.id,participant_count:1}),
    ]);
    expect(results.filter(r=>!r.error)).toHaveLength(1);
    expect(results.find(r=>r.error)?.error?.message).toContain("INSUFFICIENT_CAPACITY");
    const reserved=(await sql`select coalesce(sum(participant_count),0)::int as n from public.bookings where session_id=${s.data.id} and status in ('requested','confirmed')`)[0].n;
    expect(reserved).toBe(1);
  });

  it("2. tutor unpublishes offering — associated session cannot be booked",async()=>{
    const tutor=await signup("tutor");const learner=await signup("student");
    const offeringId=await makeOffering(tutor.client,tutor.user.id,"workshop");
    const sess=await tutor.client.rpc("create_session",{payload:{offeringId,...FUTURE,maxParticipants:5}});
    const off=(await sql`select id, version from public.offerings where id=${offeringId}`)[0];
    const unpub=await tutor.client.rpc("update_offering_status",{p_offering_id:offeringId,p_expected_version:off.version,p_status:"unpublished"});
    expect(unpub.error).toBeNull();
    const book=await learner.client.rpc("create_booking",{session_id:sess.data.id,participant_count:1});
    expect(book.error?.message).toMatch(/OFFERING_NOT_BOOKABLE|SESSION_UNAVAILABLE|INSUFFICIENT_CAPACITY|NOT_FOUND/);
  });

  it("3. only the booking's learner can submit a tutor review; duplicate by another learner is forbidden",async()=>{
    const tutor=await signup("tutor");const l1=await signup("student");const l2=await signup("student");
    const offeringId=await makeOffering(tutor.client,tutor.user.id,"workshop");
    const sess=await tutor.client.rpc("create_session",{payload:{offeringId,...FUTURE,maxParticipants:2}});
    const b1=await l1.client.rpc("create_booking",{session_id:sess.data.id,participant_count:1});
    await tutor.client.rpc("approve_booking_for_payment",{p_booking_id:b1.data.id});
    await sql`update public.bookings set status='confirmed', version=version+1 where id=${b1.data.id}`;
    await sql`update public.payments set status='succeeded' where booking_id=${b1.data.id}`;
    const v1=(await sql`select version from public.bookings where id=${b1.data.id}`)[0].version;
    await tutor.client.rpc("complete_booking",{booking_id:b1.data.id,expected_version:v1});
    const r1=await l1.client.rpc("create_tutor_review",{p_booking_id:b1.data.id,p_rating:5,p_body:"Excellent tutor, very patient and clear."});
    const r2=await l2.client.rpc("create_tutor_review",{p_booking_id:b1.data.id,p_rating:3,p_body:"Should be blocked because not the booking learner."});
    expect(r1.error).toBeNull();
    expect(r2.error?.message).toMatch(/FORBIDDEN|42501/);
    const count=(await sql`select count(*)::int as n from public.tutor_reviews where booking_id=${b1.data.id}`)[0].n;
    expect(count).toBe(1);
  });

  it("4. tutor adds unavailable exception — get_tutor_available_slots reflects it",async()=>{
    const tutor=await signup("tutor");
    const offeringId=await makeOffering(tutor.client,tutor.user.id,"workshop");
    const tp=(await sql`select id from public.tutor_profiles where user_id=${tutor.user.id}`)[0];
    await sql`insert into public.tutor_availability_slots(tutor_profile_id, day_of_week, start_time, end_time, timezone) values (${tp.id}, 1, '09:00', '10:00', 'UTC')`;
    const nextMonday=(await sql`select (current_date + ((8 - extract(isodow from current_date)::int) % 7))::date as d`)[0].d;
    const before=(await tutor.client.rpc("get_tutor_available_slots",{p_tutor_profile_id:tp.id,p_from_date:nextMonday,p_days:1})).data as Array<{startsAt:string}>;
    expect(before.length).toBeGreaterThan(0);
    await sql`insert into public.tutor_availability_exceptions(tutor_profile_id, exception_date, exception_type, reason) values (${tp.id}, ${nextMonday}, 'unavailable', 'Out of office')`;
    const after=(await tutor.client.rpc("get_tutor_available_slots",{p_tutor_profile_id:tp.id,p_from_date:nextMonday,p_days:1})).data as Array<{startsAt:string}>;
    expect(after.length).toBe(0);
  });
});
afterAll(async () => { await sql.end(); });
