import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
    define: { __OFFLINE__: offline },
    build: offline ? { outDir: "dist-offline" } : {},
  };
});
