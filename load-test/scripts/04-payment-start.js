import http from "k6/http";
import { check, sleep } from "k6";
import { getBaseUrl, getAnonHeaders } from "../lib/auth.js";

export const options = {
  stages: [
    { duration: "20s", target: 5 },
    { duration: "40s", target: 15 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    http_req_failed: ["rate<0.005"],
  },
};

const BOOKING_ID = __ENV.BOOKING_ID || "";
const LEARNER_TOKEN = __ENV.LEARNER_TOKEN || "";

export default function () {
  if (!BOOKING_ID || !LEARNER_TOKEN) {
    console.log("Set BOOKING_ID and LEARNER_TOKEN env vars");
    return;
  }
  const res = http.post(
    `${getBaseUrl()}/functions/v1/api/v1/payments/start`,
    JSON.stringify({
      booking_id: BOOKING_ID,
      idempotency_key: `k6-pay-${__VU}-${__ITER}-${Date.now()}`,
    }),
    {
      headers: {
        ...getAnonHeaders(),
        Authorization: `Bearer ${LEARNER_TOKEN}`,
      },
    }
  );
  check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  sleep(Math.random() * 3 + 2);
}
