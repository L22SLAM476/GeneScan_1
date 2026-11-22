import { createGateway } from "../../apps/gateway/server.js";
import http from "node:http";
import assert from "node:assert/strict";
const start = async (s) => {
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return "http://127.0.0.1:" + s.address().port;
};
let seen;
const upstream = http.createServer((q, r) => {
  seen = q.headers;
  r.writeHead(200, { "content-type": "application/json" }).end("{}");
});
const gateway = createGateway({
  upstream: await start(upstream),
  key: "unit-fixture",
  origin: "https://client.example,http://localhost:8081",
});
try {
  const u = await start(gateway);
  assert.equal(
    (
      await fetch(u + "/rest/v1/profiles", {
        headers: {
          Origin: "https://client.example",
          Authorization: "Bearer test-session",
        },
      })
    ).status,
    200,
  );
  assert.equal(seen.apikey, "unit-fixture");
  assert.equal(seen.authorization, "Bearer test-session");
  assert.equal(
    (
      await fetch(u + "/rest/v1/profiles", {
        headers: { Origin: "https://unlisted.example" },
      })
    ).status,
    403,
  );
  const localOrigin = await fetch(u + "/rest/v1/profiles", {
    headers: { Origin: "http://localhost:8081" },
  });
  assert.equal(localOrigin.status, 200);
  assert.equal(
    localOrigin.headers.get("access-control-allow-origin"),
    "http://localhost:8081",
  );
  assert.equal((await fetch(u + "/unknown")).status, 404);
  console.log(
    "PASS gateway path and origin allowlists, upstream key injection and user session forwarding.",
  );
} finally {
  gateway.close();
  upstream.close();
}
