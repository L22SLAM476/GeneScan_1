import test from "node:test";
import assert from "node:assert/strict";
import { resolveMobileGatewayUrl } from "./index.js";

test("mobile gateway uses the Metro host for physical devices", () => {
  assert.equal(
    resolveMobileGatewayUrl(
      "http://localhost:8787",
      "http://192.168.1.25:8081/index.bundle",
      "android",
    ),
    "http://192.168.1.25:8787/",
  );
});

test("Android emulator gateway falls back to 10.0.2.2", () => {
  assert.equal(
    resolveMobileGatewayUrl("http://127.0.0.1:8787", null, "android"),
    "http://10.0.2.2:8787/",
  );
});

test("explicit gateway URLs are preserved", () => {
  assert.equal(
    resolveMobileGatewayUrl(
      "https://gateway.example.test",
      "http://192.168.1.25:8081/index.bundle",
      "android",
    ),
    "https://gateway.example.test",
  );
});
