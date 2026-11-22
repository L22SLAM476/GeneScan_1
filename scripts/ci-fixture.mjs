// Runs only with a local Supabase CLI stack. Never print CLI status or tokens.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const base = status.API_URL;
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Expected a disposable local Supabase stack.");
const admin = status.SERVICE_ROLE_KEY,
  email = "genescan-fixture@example.test",
  password = randomBytes(30).toString("base64url");
const response = await fetch(base + "/auth/v1/admin/users", {
  method: "POST",
  headers: {
    apikey: admin,
    Authorization: "Bearer " + admin,
    "content-type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
});
if (!response.ok)
  throw Error("Could not create dedicated account: " + response.status);
const vars = {
  SUPABASE_URL: base,
  SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  WEB_ORIGIN: "http://localhost:5173",
  TEST_GATEWAY_URL: "http://127.0.0.1:8787",
  EXPO_PUBLIC_GATEWAY_URL: "http://localhost:8787",
  TEST_LOCAL_MAIL: "1",
  TEST_EMAIL: email,
  TEST_PASSWORD: password,
};
for (const [name, value] of Object.entries(vars)) {
  if (/KEY|PASSWORD/.test(name)) console.log("::add-mask::" + value);
  appendFileSync(process.env.GITHUB_ENV, name + "=" + value + "\n");
}
