import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredUrl =
  process.env.EXPO_PUBLIC_GATEWAY_URL ||
  `http://127.0.0.1:${process.env.PORT || 8787}`;
const gatewayUrl = new URL(configuredUrl);
const local = ["localhost", "127.0.0.1"].includes(gatewayUrl.hostname);
const probeUrl = new URL("/auth/v1/user", gatewayUrl);
const logPath = path.join(root, "build", "gateway-background.log");

async function probe() {
  try {
    const response = await fetch(probeUrl, {
      signal: AbortSignal.timeout(1500),
    });
    await response.arrayBuffer();
    if (response.status === 401 || response.ok) return true;
    throw new Error(
      `Gateway at ${gatewayUrl.origin} returned HTTP ${response.status}.`,
    );
  } catch (error) {
    if (local && error instanceof TypeError) return false;
    throw error;
  }
}

async function main() {
  if (await probe()) {
    console.log(
      `GeneScan gateway is already reachable at ${gatewayUrl.origin}.`,
    );
    return;
  }
  if (!local)
    throw new Error(
      `The configured remote gateway is not reachable: ${gatewayUrl.origin}.`,
    );

  mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, "a");
  const child = spawn(
    process.execPath,
    ["--env-file=.env", "apps/gateway/server.js"],
    {
      cwd: root,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
    },
  );
  closeSync(logFd);

  let childExit = null;
  child.on("exit", (code, signal) => {
    childExit = `Gateway process exited (${signal || code}).`;
  });
  await once(child, "spawn");
  child.unref();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await probe()) {
      console.log(`Started GeneScan gateway at ${gatewayUrl.origin}.`);
      return;
    }
    if (childExit) break;
    await delay(250);
  }

  const log = existsSync(logPath)
    ? readFileSync(logPath, "utf8").slice(-2000)
    : "";
  throw new Error(
    `${childExit || `Gateway did not become ready at ${gatewayUrl.origin}.`}` +
      ` Check ${logPath}.${log ? ` Recent gateway output:\n${log}` : ""}`,
  );
}

await main();
