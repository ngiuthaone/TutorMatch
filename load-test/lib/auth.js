import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY || "";

export function getBaseUrl() {
  return BASE_URL;
}

export function getAnonHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

export function getServiceHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
}

// Sign up a test learner, return { token, userId } or null on failure
export function signUpLearner(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/v1/signup`,
    JSON.stringify({ email, password, email_confirm: true }),
    { headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  if (res.status !== 200) {
    console.log(`signup failed: ${res.status} ${res.body}`);
    return null;
  }
  const data = JSON.parse(res.body);
  return { token: data.access_token, userId: data.user.id };
}

// Sign in an existing test user
export function signIn(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  if (res.status !== 200) {
    console.log(`signin failed: ${res.status} ${res.body}`);
    return null;
  }
  const data = JSON.parse(res.body);
  return { token: data.access_token, userId: data.user.id };
}

export { check };
