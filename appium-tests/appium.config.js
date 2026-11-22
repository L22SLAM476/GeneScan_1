import capabilities from "./config/capabilities.js";
export default {
  hostname: "127.0.0.1",
  port: Number(process.env.APPIUM_PORT || 4723),
  path: "/",
  logLevel: "warn",
  capabilities,
};
