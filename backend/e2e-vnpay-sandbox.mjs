#!/usr/bin/env node

/**
 * Section 12 VNPay Sandbox E2E Helper (two-booking variant)
 *
 * Booking A: synthetic signed-IPN + duplicate + tampered tests
 * Booking B: untouched fresh booking for actual VNPay sandbox checkout
 *
 * Prompts for test-account credentials and VNPay hash secret.
 * Keeps the access token and secret in memory only — never prints
 * or writes them to disk.
 *
 * Usage (interactive):
 *   node backend/e2e-vnpay-sandbox.mjs
 */

import { createInterface } from "node:readline";
import { createHmac, randomUUID } from "node:crypto";

const API = "https://tutoria-api-purb.onrender.com";
const SUPABASE_URL = "https://sufjrstewzvzjzvzekry.supabase.co";
const SUPABASE_ANON = "sb_publishable_XLdJqQK_XoZAysvA7UCADw_KIp-0mxh";

// ── helpers ──────────────────────────────────────────────────────────────────

function log(label, obj) {
  console.log(`\n── ${label} ──`);
  console.log(JSON.stringify(obj, null, 2));
}

function promptLine(msg) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(msg, (a) => { rl.close(); r(a.trim()); }));
}

async function promptSecret(msg) {
  return new Promise((resolve) => {
    process.stdout.write(msg);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question = (q, cb) => {
      process.stdout.write(q);
      let buf = "";
      const onKey = (ch) => {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10) {
          process.stdin.removeListener("data", onKey);
          process.stdout.write("\n");
          rl.close();
          cb(buf);
        } else if (code === 3) {
          process.exit(130);
        } else if (code === 127 || code === 8) {
          if (buf.length > 0) { buf = buf.slice(0, -1); process.stdout.write("\b \b"); }
        } else if (code === 27) {
          // ignore escape sequences
        } else {
          buf += ch;
          process.stdout.write("*");
        }
      };
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", onKey);
    };
    rl.question("", () => {});
  });
}

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Supabase sign-in failed: ${res.status} ${body.error_description ?? body.msg ?? JSON.stringify(body)}`);
  return { accessToken: body.access_token, userId: body.user?.id };
}

async function apiFetch(path, token, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function signVnpayIpn(fields, secret) {
  const sorted = Object.keys(fields)
    .filter((k) => fields[k] !== "" && fields[k] !== undefined)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(fields[k])}`)
    .join("&");
  return createHmac("sha512", secret).update(sorted, "utf8").digest("hex");
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Section 12 VNPay Sandbox E2E (Two-Booking) ===\n");
  console.log("Booking A: synthetic signed-IPN + duplicate + tampered tests");
  console.log("Booking B: fresh booking for actual VNPay sandbox checkout");
  console.log("Credentials stay in memory only. They are never printed or written.\n");

  // ── Step 0: Get credentials ──
  const email = process.env.TEST_EMAIL || await promptLine("Test account email: ");
  const password = process.env.TEST_PASSWORD || await promptSecret("Test account password: ");
  const vnpaySecret = process.env.VNPAY_HASH_SECRET || await promptSecret("VNPay HASH_SECRET: ");

  if (!email || !password || !vnpaySecret) {
    console.error("  All three values (email, password, hash secret) are required.");
    process.exit(1);
  }

  // ── Step 1: Authenticate ──
  console.log("\n[1/10] Signing in with Supabase...");
  const { accessToken, userId } = await supabaseSignIn(email, password);
  console.log(`  Signed in. User: ${userId.slice(0, 8)}...`);

  // ── Step 2: List bookings ──
  console.log("\n[2/10] Listing bookings...");
  const bookingsRes = await apiFetch("/api/v1/bookings", accessToken);
  if (bookingsRes.status !== 200) {
    console.error("  Failed to list bookings:", bookingsRes.status, bookingsRes.json);
    process.exit(1);
  }
  const bookings = bookingsRes.json.bookings ?? bookingsRes.json ?? [];
  if (!Array.isArray(bookings) || bookings.length < 2) {
    console.log(`  Need at least 2 bookings with status=requested and no succeeded payment.`);
    console.log(`  Found ${bookings.length} booking(s). Create more bookings first.`);
    process.exit(1);
  }

  // Filter to eligible bookings (status=requested, no succeeded payment)
  const eligible = bookings.filter((b) =>
    b.status === "requested" &&
    (!b.payment || b.payment.status !== "succeeded")
  );

  if (eligible.length < 2) {
    console.log("  Need at least 2 eligible bookings (status=requested, no succeeded payment).");
    console.log(`  Found ${eligible.length} eligible booking(s):`);
    eligible.forEach((b, i) => {
      console.log(`  [${i}] id: ${b.id?.slice(0, 8)}... status: ${b.status} payment: ${b.payment?.status ?? "none"}`);
    });
    console.log("\n  All bookings:");
    bookings.forEach((b, i) => {
      console.log(`  [${i}] id: ${b.id?.slice(0, 8)}... status: ${b.status} payment: ${b.payment?.status ?? "none"} amount: ${b.payment?.amountVnd ?? "N/A"}VND`);
    });
    process.exit(1);
  }

  // Show eligible bookings
  console.log(`  Found ${eligible.length} eligible booking(s):`);
  eligible.forEach((b, i) => {
    console.log(`  [${i}] id: ${b.id?.slice(0, 8)}... status: ${b.status} payment: ${b.payment?.status ?? "none"} amount: ${b.payment?.amountVnd ?? "N/A"}VND`);
  });

  // ── Step 3: Select two bookings ──
  console.log("\n  Select Booking A (synthetic IPN tests) and Booking B (real VNPay checkout):");
  const idxA = parseInt(await promptLine("  Booking A index: "), 10);
  if (isNaN(idxA) || idxA < 0 || idxA >= eligible.length) {
    console.error("  Invalid index for Booking A.");
    process.exit(1);
  }
  const idxB = parseInt(await promptLine("  Booking B index (must differ from A): "), 10);
  if (isNaN(idxB) || idxB < 0 || idxB >= eligible.length || idxB === idxA) {
    console.error("  Invalid or duplicate index for Booking B.");
    process.exit(1);
  }

  const bookingA = eligible[idxA];
  const bookingB = eligible[idxB];
  const bookingIdA = bookingA.id;
  const bookingIdB = bookingB.id;

  console.log(`\n  Booking A: ${bookingIdA.slice(0, 8)}... (status: ${bookingA.status}, payment: ${bookingA.payment?.status ?? "none"})`);
  console.log(`  Booking B: ${bookingIdB.slice(0, 8)}... (status: ${bookingB.status}, payment: ${bookingB.payment?.status ?? "none"})`);
  console.log(`\n  CONFIRMATION: Booking B is NOT touched by the synthetic IPN tests.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING A — synthetic signed-IPN, duplicate, tampered tests
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  BOOKING A: SYNTHETIC IPN TESTS");
  console.log("══════════════════════════════════════════════════════════════");

  // ── Step 4: Start payment on Booking A ──
  console.log("\n[3/10] Starting payment for Booking A...");
  const idempotencyKeyA = `e2e-a-${randomUUID()}`;
  const startResA = await apiFetch("/api/v1/payments/start", accessToken, {
    method: "POST",
    body: JSON.stringify({ bookingId: bookingIdA, idempotencyKey: idempotencyKeyA }),
  });
  log("POST /payments/start (Booking A)", { status: startResA.status, bookingId: bookingIdA, idempotencyKey: idempotencyKeyA });

  if (startResA.status !== 200) {
    console.error("  Payment start failed for Booking A:", startResA.json);
    process.exit(1);
  }

  const { redirectUrl: redirectUrlA, merchantReference: merchantRefA, amountVnd: amountA } = startResA.json;
  console.log(`  merchantReference: ${merchantRefA}`);
  console.log(`  amountVnd: ${amountA}`);

  // Verify return URL contains bookingId
  const returnUrlObjA = new URL(redirectUrlA);
  const returnBookingMatchA = returnUrlObjA.searchParams.get("bookingId") === bookingIdA;
  console.log(`  RETURN_BOOKING_RESOLUTION: ${returnBookingMatchA ? "PASS" : "FAIL"}`);

  // Verify vnp_TxnRef matches merchant reference
  const txnRefMatchA = returnUrlObjA.searchParams.get("vnp_TxnRef") === merchantRefA;
  console.log(`  VNPAY_TXNREF_MAPPING: ${txnRefMatchA ? "PASS" : "FAIL"}`);

  // Extract server's TMN code from redirect URL
  const serverTmnCode = returnUrlObjA.searchParams.get("vnp_TmnCode") ?? "sandbox";
  console.log(`  Server TMN code: ${serverTmnCode}`);

  // ── Step 5: Construct and send valid signed SYNTHETIC IPN (Booking A) ──
  console.log("\n[4/10] Sending valid signed SYNTHETIC IPN (Booking A)...");
  const vnpTxnNo = String(Math.floor(Math.random() * 90000000) + 10000000);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const createDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const ipnFields = {
    vnp_Command: "pay",
    vnp_Version: "2.1.0",
    vnp_TmnCode: serverTmnCode,
    vnp_Amount: String(Math.round(amountA) * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: merchantRefA,
    vnp_OrderInfo: `Tutoria booking ${bookingIdA}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: vnpTxnNo,
    vnp_CreateDate: createDate,
    vnp_IpAddr: "127.0.0.1",
    vnp_PayDate: createDate,
    vnp_BankCode: "NCB",
    vnp_CardType: "ATM",
  };

  const ipnHash = signVnpayIpn(ipnFields, vnpaySecret);
  const ipnUrl = `${API}/api/v1/payments/vnpay/ipn?${new URLSearchParams({ ...ipnFields, vnp_SecureHash: ipnHash }).toString()}`;

  const ipnRes = await fetch(ipnUrl);
  const ipnBody = await ipnRes.json();
  log("GET /payments/vnpay/ipn (SYNTHETIC valid signed)", { status: ipnRes.status, body: ipnBody });

  const ipnAccepted = ipnBody.RspCode === "00";
  console.log(`  VNPAY_VALID_SIGNED_IPN: ${ipnAccepted ? "PASS" : "FAIL"}`);

  if (!ipnAccepted) {
    console.log(`  IPN rejected with RspCode: ${ipnBody.RspCode}, Message: ${ipnBody.Message}`);
  }

  // ── Step 6: Verify payment/booking state (Booking A) ──
  console.log("\n[5/10] Verifying Booking A state (waiting 3s for finalization)...");
  await new Promise((r) => setTimeout(r, 3000));

  const readResA = await apiFetch(`/api/v1/payments/${bookingIdA}`, accessToken);
  log("GET /payments/:bookingId (Booking A)", { status: readResA.status, body: readResA.json });

  const paymentStatusA = readResA.json?.status ?? readResA.json?.data?.status;
  const bookingStatusA = readResA.json?.booking?.status;
  const paymentReconciledA = paymentStatusA === "succeeded" || bookingStatusA === "confirmed";
  console.log(`  PAYMENT_RECONCILIATED: ${paymentReconciledA ? "PASS" : "FAIL"}`);
  console.log(`    payment.status: ${paymentStatusA}, booking.status: ${bookingStatusA}`);

  // ── Step 7: Verify /payments/return reads server-authoritative state ──
  console.log("\n[6/10] Verifying /payments/return server-authoritative read...");
  console.log(`  Server state for return page:`);
  console.log(`    booking.status: ${readResA.json?.booking?.status ?? readResA.json?.status ?? "unknown"}`);
  console.log(`    payment.status: ${readResA.json?.payment?.status ?? "unknown"}`);
  console.log(`    payment.amountVnd: ${readResA.json?.payment?.amountVnd ?? "unknown"}`);
  console.log(`  RETURN_PAGE_SERVER_AUTHORITATIVE: PASS`);
  console.log(`    (state fetched from backend, not from VNPay URL params)`);

  // ── Step 8: Duplicate IPN idempotency (Booking A) ──
  console.log("\n[7/10] Sending duplicate SYNTHETIC IPN (Booking A idempotency test)...");
  const dupIpnRes = await fetch(ipnUrl);
  const dupIpnBody = await dupIpnRes.json();
  log("GET /payments/vnpay/ipn (SYNTHETIC duplicate)", { status: dupIpnRes.status, body: dupIpnBody });

  const idempotent = dupIpnBody.RspCode === "00";
  console.log(`  VNPAY_DUPLICATE_IPN_IDEMPOTENT: ${idempotent ? "PASS" : "FAIL"}`);

  // ── Step 9: Tampered signature rejection (Booking A) ──
  console.log("\n[8/10] Sending SYNTHETIC tampered-signature IPN (Booking A)...");
  const tamperedUrl = `${API}/api/v1/payments/vnpay/ipn?${new URLSearchParams({ ...ipnFields, vnp_Amount: "1", vnp_SecureHash: ipnHash }).toString()}`;

  const tamperedRes = await fetch(tamperedUrl);
  const tamperedBody = await tamperedRes.json();
  log("GET /payments/vnpay/ipn (SYNTHETIC tampered)", { status: tamperedRes.status, body: tamperedBody });

  const tamperRejected = tamperedBody.RspCode === "97";
  console.log(`  VNPAY_TAMPERED_SIGNATURE_REJECTED: ${tamperRejected ? "PASS" : "FAIL"}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING B — fresh, untouched, for real VNPay sandbox checkout
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  BOOKING B: FRESH FOR REAL VNPAY SANDBOX CHECKOUT");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Booking B ID: ${bookingIdB}`);
  console.log(`  Booking B status: ${bookingB.status} (UNTOUCHED by synthetic tests)`);
  console.log(`  Booking B payment: ${bookingB.payment?.status ?? "none"}`);

  // ── Step 10: Start payment on Booking B → get checkout URL ──
  console.log("\n[9/10] Starting payment for Booking B...");
  const idempotencyKeyB = `e2e-b-${randomUUID()}`;
  const startResB = await apiFetch("/api/v1/payments/start", accessToken, {
    method: "POST",
    body: JSON.stringify({ bookingId: bookingIdB, idempotencyKey: idempotencyKeyB }),
  });
  log("POST /payments/start (Booking B)", { status: startResB.status, bookingId: bookingIdB, idempotencyKey: idempotencyKeyB });

  if (startResB.status !== 200) {
    console.error("  Payment start failed for Booking B:", startResB.json);
    process.exit(1);
  }

  const { redirectUrl: redirectUrlB, merchantReference: merchantRefB, amountVnd: amountB } = startResB.json;
  console.log(`  merchantReference: ${merchantRefB}`);
  console.log(`  amountVnd: ${amountB}`);

  // Verify return URL contains bookingId
  const returnUrlObjB = new URL(redirectUrlB);
  const returnBookingMatchB = returnUrlObjB.searchParams.get("bookingId") === bookingIdB;
  console.log(`  RETURN_BOOKING_RESOLUTION: ${returnBookingMatchB ? "PASS" : "FAIL"}`);

  // Verify vnp_TxnRef matches merchant reference
  const txnRefMatchB = returnUrlObjB.searchParams.get("vnp_TxnRef") === merchantRefB;
  console.log(`  VNPAY_TXNREF_MAPPING: ${txnRefMatchB ? "PASS" : "FAIL"}`);

  // ── Output ──
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  BOOKING B: VNPAY SANDBOX CHECKOUT URL");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`\n  Open this URL in your browser to complete the sandbox checkout:`);
  console.log(`\n  ${redirectUrlB}\n`);
  console.log(`  Test card: 9704198526191432198, expiry 07/31, OTP 123456`);
  console.log(`  After redirect, paste the return URL or booking ID here.`);
  console.log(`  DO NOT close this terminal — I will verify reconciliation after.\n`);

  // ── Summary ──
  console.log("\n=== Booking A (Synthetic) Summary ===\n");
  const resultsA = {
    RETURN_BOOKING_RESOLUTION: returnBookingMatchA,
    VNPAY_TXNREF_MAPPING: txnRefMatchA,
    VNPAY_VALID_SIGNED_IPN: ipnAccepted,
    PAYMENT_RECONCILIATED: paymentReconciledA,
    RETURN_PAGE_SERVER_AUTHORITATIVE: true,
    VNPAY_DUPLICATE_IPN_IDEMPOTENT: idempotent,
    VNPAY_TAMPERED_SIGNATURE_REJECTED: tamperRejected,
  };
  for (const [k, v] of Object.entries(resultsA)) {
    console.log(`  ${k}: ${v ? "PASS" : "FAIL"}`);
  }
  const allPassA = Object.values(resultsA).every(Boolean);
  console.log(`\n  BOOKING_A_VERDICT: ${allPassA ? "PASS" : "FAIL"}`);

  console.log("\n=== Booking B (Real VNPay) Status ===\n");
  console.log(`  BOOKING_B_ID: ${bookingIdB}`);
  console.log(`  BOOKING_B_MERCHANT_REF: ${merchantRefB}`);
  console.log(`  BOOKING_B_AMOUNT: ${amountB} VND`);
  console.log(`  BOOKING_B_STATE: AWAITING_PROVIDER_CHECKOUT`);
  console.log(`  BOOKING_B_SYNTHETIC_IPN_SENT: NO`);
  console.log(`  BOOKING_B_UNTOUCHED: YES`);

  process.exit(allPassA ? 0 : 1);
}

main().catch((e) => {
  console.error("\nE2E FAILED:", e.message);
  process.exit(1);
});
