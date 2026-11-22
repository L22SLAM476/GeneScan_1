const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

module.exports = function withLocalGateway(config) {
  const url = process.env.EXPO_PUBLIC_GATEWAY_URL;
  if (!url) return config;
  let gateway;
  try {
    gateway = new URL(url);
  } catch {
    return config;
  }
  if (gateway.protocol !== "http:") return config;
  const hostname = gateway.hostname;
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.$["android:networkSecurityConfig"] = "@xml/genescan_network";
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const dir = path.join(
        mod.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      await mkdir(dir, { recursive: true });
      const safeHostname = hostname.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      await writeFile(
        path.join(dir, "genescan_network.xml"),
        `<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">${safeHostname}</domain><domain includeSubdomains="false">10.0.2.2</domain></domain-config></network-security-config>`,
      );
      return mod;
    },
  ]);
};
