import http from "k6/http";
import { check, sleep } from "k6";
import { getBaseUrl, getAnonHeaders } from "../lib/auth.js";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${getBaseUrl()}/functions/v1/api/v1/tutors?limit=24`, {
    headers: getAnonHeaders(),
  });
  check(res, {
    "status 200": (r) => r.status === 200,
    "has items": (r) => {
      try { return JSON.parse(r.body).items?.length > 0; } catch { return false; }
    },
  });
  sleep(Math.random() * 2 + 1);
}
