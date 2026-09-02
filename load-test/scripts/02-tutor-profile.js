import http from "k6/http";
import { check, sleep } from "k6";
import { getBaseUrl, getAnonHeaders } from "../lib/auth.js";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "2m", target: 200 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

const TUTOR_IDS = __ENV.TUTOR_IDS ? __ENV.TUTOR_IDS.split(",") : [];

export default function () {
  if (TUTOR_IDS.length === 0) {
    console.log("Set TUTOR_IDS env to a comma-separated list of tutor IDs");
    return;
  }
  const id = TUTOR_IDS[Math.floor(Math.random() * TUTOR_IDS.length)];
  const res = http.get(`${getBaseUrl()}/functions/v1/api/v1/tutors/${id}`, {
    headers: getAnonHeaders(),
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has profile": (r) => {
      try { return !!JSON.parse(r.body).id; } catch { return false; }
    },
  });
  sleep(Math.random() * 3 + 2);
}
