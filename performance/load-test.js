import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
const success = new Counter("successful_requests"),
  failed = new Counter("failed_requests");
export const options = {
  vus: 100,
  duration: "1m",
  summaryTrendStats: ["avg", "min", "max", "med", "p(90)", "p(95)", "p(99)"],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_failed{name:account}": ["rate<0.01"],
    "http_req_failed{name:save}": ["rate<0.01"],
    "http_req_failed{name:history}": ["rate<0.01"],
    http_req_duration: ["avg<500"],
  },
};
const base = __ENV.TEST_GATEWAY_URL;
export function setup() {
  if (!base || !__ENV.TEST_EMAIL || !__ENV.TEST_PASSWORD)
    throw Error(
      "Configure an isolated test gateway and dedicated test account.",
    );
  const r = http.post(
    base + "/auth/v1/token?grant_type=password",
    JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (r.status !== 200) throw Error("Test account sign-in failed: " + r.status);
  return r.json("access_token");
}
function record(r, operation) {
  const ok = check(r, {
    "successful response": (x) => x.status >= 200 && x.status < 300,
  });
  (ok ? success : failed).add(1, { operation, status: String(r.status) });
}
export default function (token) {
  const params = {
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  };
  record(
    http.get(base + "/auth/v1/user", { ...params, tags: { name: "account" } }),
    "account",
  );
  record(
    http.post(
      base + "/rest/v1/rpc/save_analysis",
      JSON.stringify({
        label: "k6 fixture",
        bases: "ACGTNN".repeat(16),
        filename: null,
      }),
      { ...params, tags: { name: "save" } },
    ),
    "save",
  );
  record(
    http.get(
      base +
        "/rest/v1/sequence_analyses?select=id,gc,created_at&order=created_at.desc&limit=5",
      { ...params, tags: { name: "history" } },
    ),
    "history",
  );
  sleep(1);
}
export function handleSummary(data) {
  return {
    "performance/reports/load-test-results.json": JSON.stringify(
      { status: "EXECUTED", metrics: data.metrics, state: data.state },
      null,
      2,
    ),
  };
}
