import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

/** The desktop edition makes no network calls, so the analytics beacon stays out of its page. */
const withoutBeacon: Plugin = {
  name: "without-beacon",
  transformIndexHtml(html) {
    const out = html
      .replace(/\s*<!-- Cloudflare Web Analytics[^>]*-->/, "")
      .replace(/\s*<script[^>]*cloudflareinsights[\s\S]*?<\/script>/, "");
    if (out.includes("cloudflareinsights")) throw Error("beacon still in index.html");
    return out;
  },
};

export default defineConfig(({ mode }) => {
  const offline = mode === "offline";
  return {
    plugins: offline ? [react(), withoutBeacon] : [react()],
    base: "./",
    define: { __OFFLINE__: offline, __APP_VERSION__: JSON.stringify(pkg.version) },
    build: offline ? { outDir: "desktop/dist", emptyOutDir: true } : {},
    // desktop/ holds a toolchain and build output, full of files the dev server should not scan or watch.
    optimizeDeps: { entries: ["index.html"] },
    server: { watch: { ignored: ["**/desktop/**", "**/work/**"] } },
  };
});
