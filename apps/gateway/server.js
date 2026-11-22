import http from "node:http";
import { pathToFileURL } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
const post = new Set([
  "/auth/v1/token",
  "/auth/v1/signup",
  "/auth/v1/logout",
  "/rest/v1/rpc/save_analysis",
  "/rest/v1/rpc/save_archived_analysis",
]);
const get = new Set([
  "/auth/v1/user",
  "/rest/v1/sequence_analyses",
  "/rest/v1/profiles",
  "/rest/v1/genescan_activity",
  "/rest/v1/dna_sequences",
  "/rest/v1/uploaded_files",
  "/rest/v1/analysis_history",
]);
export function createGateway({ upstream, key, origin }) {
  if (!upstream || !key || !origin)
    throw Error(
      "Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and WEB_ORIGIN on the server.",
    );
  const allowedOrigins = new Set(
    origin
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!allowedOrigins.size) throw Error("Set at least one WEB_ORIGIN.");
  const configuredOrigins = [...allowedOrigins];
  const defaultOrigin = configuredOrigins[0];
  if (key.startsWith("sb_secret_"))
    throw Error("Use a publishable or anon key.");
  if (
    key.split(".").length === 3 &&
    JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role !== "anon"
  )
    throw Error("Expected anon role.");
  const base = new URL(upstream);
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw Error("Supabase requires HTTPS.");
  const userCache = new Map();
  const userInFlight = new Map();
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Vary", "Origin");
      const requestOrigin = req.headers.origin;
      if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
        res.writeHead(403).end();
        return;
      }
      const responseOrigin =
        configuredOrigins.find((configured) => configured === requestOrigin) ||
        defaultOrigin;
      res.setHeader(
        "Access-Control-Allow-Origin",
        responseOrigin,
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, HEAD, POST, PUT, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "authorization, content-type, accept, prefer, range, x-client-info, x-supabase-api-version, accept-profile, content-profile, x-upsert, cache-control",
      );
      res.setHeader("Access-Control-Expose-Headers", "content-range");
      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }
      const u = new URL(req.url, "http://local");
      const path = u.pathname;
      const storageObject = /^\/storage\/v1\/object\/genescan-private\/[a-f0-9-]{36}\/[0-9a-z-]{8,80}\/(source\.(txt|fasta|fa|fna)|analysis\.json)$/.test(path);
      if (!(
        (storageObject && req.method === "POST") ||
        (["GET", "HEAD"].includes(req.method) && get.has(path)) ||
        (req.method === "POST" && post.has(path)) ||
        (req.method === "PUT" && path === "/auth/v1/user")
      )) {
        res.writeHead(404).end();
        return;
      }
      const dest = new URL(base);
      dest.pathname = path;
      dest.search = u.search;
      const headers = { apikey: key };
      for (const h of [
        "authorization",
        "content-type",
        "accept",
        "prefer",
        "x-upsert",
        "cache-control",
        "range",
        "x-supabase-api-version",
      ])
        if (req.headers[h]) headers[h] = req.headers[h];
      const parts = [];
      let bytes = 0;
      for await (const part of req) {
        bytes += part.length;
        if (bytes > (storageObject ? 1048576 : 250000)) {
          res.writeHead(413).end();
          return;
        }
        parts.push(part);
      }
      const authKey = req.headers.authorization;
      if (
        authKey &&
        ((req.method === "POST" && path === "/auth/v1/logout") ||
          (req.method === "PUT" && path === "/auth/v1/user"))
      ) {
        userCache.delete(authKey);
        userInFlight.delete(authKey);
      }
      if (req.method === "GET" && path === "/auth/v1/user" && authKey) {
        const cached = userCache.get(authKey);
        if (cached && cached.expires > Date.now()) {
          if (cached.contentType)
            res.setHeader("content-type", cached.contentType);
          res.writeHead(200).end(cached.body);
          return;
        }
        let pending = userInFlight.get(authKey);
        if (!pending) {
          pending = fetch(dest, {
            method: req.method,
            headers,
            redirect: "error",
            signal: AbortSignal.timeout(20000),
          })
            .then(async (r) => {
              const body = Buffer.from(await r.arrayBuffer());
              const contentType = r.headers.get("content-type");
              if (r.status === 200) {
                userCache.set(authKey, {
                  body,
                  contentType,
                  expires: Date.now() + 5000,
                });
              }
              return { status: r.status, body, contentType };
            })
            .finally(() => {
              userInFlight.delete(authKey);
            });
          userInFlight.set(authKey, pending);
        }
        const result = await pending;
        if (result.contentType)
          res.setHeader("content-type", result.contentType);
        res.writeHead(result.status).end(result.body);
        return;
      }
      const r = await fetch(dest, {
        method: req.method,
        headers,
        body: parts.length ? Buffer.concat(parts) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      for (const h of ["content-type", "content-range", "retry-after"])
        if (r.headers.has(h)) res.setHeader(h, r.headers.get(h));
      res.writeHead(r.status).end(Buffer.from(await r.arrayBuffer()));
    } catch {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(502);
      }
      res.end(JSON.stringify({ error: "Supabase gateway request failed" }));
    }
  });
  const websocketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    let requestUrl;
    try {
      requestUrl = new URL(req.url, "http://local");
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    if (
      req.method !== "GET" ||
      requestUrl.pathname !== "/realtime/v1/websocket"
    ) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const destination = new URL(base);
    destination.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    destination.pathname = "/realtime/v1/websocket";
    destination.search = requestUrl.search;
    destination.searchParams.set("apikey", key);
    destination.hash = "";
    const protocols = req.headers["sec-websocket-protocol"]
      ?.split(",")
      .map((protocol) => protocol.trim())
      .filter(Boolean);
    const headers = {};
    if (req.headers.authorization)
      headers.authorization = req.headers.authorization;
    const upstreamSocket = new WebSocket(destination, protocols, {
      headers,
      handshakeTimeout: 10000,
    });
    let upgraded = false;
    socket.once("close", () => {
      if (!upgraded) upstreamSocket.terminate();
    });
    upstreamSocket.once("open", () => {
      upgraded = true;
      websocketServer.handleUpgrade(req, socket, head, (clientSocket) => {
        websocketServer.emit("connection", clientSocket, req);
        clientSocket.on("message", (data, isBinary) => {
          if (upstreamSocket.readyState === WebSocket.OPEN)
            upstreamSocket.send(data, { binary: isBinary });
        });
        upstreamSocket.on("message", (data, isBinary) => {
          if (clientSocket.readyState === WebSocket.OPEN)
            clientSocket.send(data, { binary: isBinary });
        });
        clientSocket.once("close", () => upstreamSocket.close());
        upstreamSocket.once("close", () => clientSocket.close());
        clientSocket.on("error", () => upstreamSocket.terminate());
        upstreamSocket.on("error", () => clientSocket.terminate());
      });
    });
    upstreamSocket.once("error", () => {
      if (!upgraded) {
        socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    });
  });
  return server;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href)
  createGateway({
    upstream: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    origin: process.env.WEB_ORIGIN,
  }).listen(Number(process.env.PORT || 8787), "0.0.0.0");
