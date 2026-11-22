import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
  envDir: path.resolve(import.meta.dirname, "../.."),
  envPrefix: "EXPO_PUBLIC_",
  server: {
    host: "0.0.0.0",
    fs: { allow: [path.resolve(import.meta.dirname, "../..")] },
  },
});
