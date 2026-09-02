import http from "k6/http";
import { check, sleep } from "k6";
import { getBaseUrl, getAnonHeaders } from "../lib/auth.js";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<800", "p(99)<2000"],
    http_req_failed: ["rate<0.005"],
  },
};

const SESSION_ID = __ENV.SESSION_ID || "";
const LEARNER_TOKEN = __ENV.LEARNER_TOKEN || "";

export default function () {
  if (!SESSION_ID || !LEARNER_TOKEN) {
    console.log("Set SESSION_ID and LEARNER_TOKEN env vars");
    return;
  }
  const res = http.post(
    `${getBaseUrl()}/functions/v1/api/v1/bookings`,
    JSON.stringify({
      session_id: SESSION_ID,
      participant_count: 1,
      p_idempotency_key: `k6-${__VU}-${__ITER}-${Date.now()}`,
    }),
    {
      headers: {
        ...getAnonHeaders(),
        Authorization: `Bearer ${LEARNER_TOKEN}`,
      },
    }
  );
  check(res, {
    "status 2xx or conflict (session full)": (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 409,
  });
  sleep(Math.random() * 5 + 3);
}
