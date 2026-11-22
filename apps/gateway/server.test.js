import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import WebSocket, { WebSocketServer } from "ws";
import { createGateway } from "./server.js";

const allowedOrigin = "https://app.example.test";
const publishableKey = "server-publishable-key";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function createTestServers() {
  const upstreamHttp = http.createServer();
  const upstreamWs = new WebSocketServer({ server: upstreamHttp });
  const upstreamPort = await listen(upstreamHttp);
  const gateway = createGateway({
    upstream: `http://127.0.0.1:${upstreamPort}`,
    key: publishableKey,
    origin: allowedOrigin,
  });
  const gatewayPort = await listen(gateway);
  return {
    gateway,
    gatewayPort,
    upstreamHttp,
    upstreamWs,
    async close() {
      for (const client of upstreamWs.clients) client.terminate();
      await close(gateway);
      await close(upstreamHttp);
    },
  };
}

function responseStatus(url, origin) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url, { headers: { Origin: origin } });
    let settled = false;
    client.once("unexpected-response", (_request, response) => {
      settled = true;
      response.resume();
      resolve(response.statusCode);
    });
    client.once("open", () => {
      client.close();
      settled = true;
      reject(new Error("Expected the WebSocket request to be rejected."));
    });
    client.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

test("Realtime proxy accepts an allowed origin and forwards with the server key", async () => {
  const servers = await createTestServers();
  let upstreamQuery;
  servers.upstreamWs.on("connection", (socket, request) => {
    upstreamQuery = new URL(request.url, "http://upstream").searchParams;
    socket.on("message", (message) => socket.send(`echo:${message}`));
  });

  const client = new WebSocket(
    `ws://127.0.0.1:${servers.gatewayPort}/realtime/v1/websocket?apikey=client-key&vsn=1.0.0`,
    { headers: { Origin: allowedOrigin } },
  );
  try {
    await new Promise((resolve, reject) => {
      client.once("open", resolve);
      client.once("error", reject);
    });
    assert.equal(upstreamQuery.get("apikey"), publishableKey);
    assert.equal(upstreamQuery.getAll("apikey").length, 1);
    assert.equal(upstreamQuery.get("vsn"), "1.0.0");

    const echoed = new Promise((resolve, reject) => {
      client.once("message", (message) => resolve(message.toString()));
      client.once("error", reject);
    });
    client.send("hello");
    assert.equal(await echoed, "echo:hello");
  } finally {
    client.terminate();
    await servers.close();
  }
});

test("Realtime proxy rejects origins outside the configured allowlist", async () => {
  const servers = await createTestServers();
  try {
    const status = await responseStatus(
      `ws://127.0.0.1:${servers.gatewayPort}/realtime/v1/websocket`,
      "https://untrusted.example.test",
    );
    assert.equal(status, 403);
  } finally {
    await servers.close();
  }
});

test("Realtime proxy only accepts the exact websocket path", async () => {
  const servers = await createTestServers();
  try {
    const status = await responseStatus(
      `ws://127.0.0.1:${servers.gatewayPort}/realtime/v1/other`,
      allowedOrigin,
    );
    assert.equal(status, 404);
  } finally {
    await servers.close();
  }
});
