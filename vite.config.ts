import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * إحصاءات Umami اختيارية: تُحقن فقط إن ضُبط VITE_ANALYTICS_ENDPOINT وVITE_ANALYTICS_WEBSITE_ID.
 * كان الوسم ثابتاً في index.html فيطلب المتصفح "%VITE_ANALYTICS_ENDPOINT%/umami" حرفياً في كل فتح.
 */
function optionalAnalytics(): Plugin {
  let endpoint = "";
  let websiteId = "";
  return {
    name: "tarteel-optional-analytics",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || process.cwd(), "VITE_");
      endpoint = (env.VITE_ANALYTICS_ENDPOINT ?? "").replace(/\/+$/, "");
      websiteId = env.VITE_ANALYTICS_WEBSITE_ID ?? "";
    },
    transformIndexHtml() {
      if (!endpoint || !websiteId) return [];
      return [{ tag: "script", attrs: { defer: true, src: `${endpoint}/umami`, "data-website-id": websiteId }, injectTo: "body" }];
    },
  };
}

/** مكتبات كبيرة مستقرة في ملفات مستقلة: تبقى في ذاكرة المتصفح عبر النشرات ما لم تتغير نسختها. */
const VENDOR_CHUNKS: [name: string, pattern: RegExp][] = [
  ["vendor-react", /[\\/]node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/],
  ["vendor-data", /[\\/]node_modules[\\/](@trpc|@tanstack|superjson|copy-anything|is-what)[\\/]/],
  ["vendor-radix", /[\\/]node_modules[\\/](@radix-ui|@floating-ui|cmdk|vaul)[\\/]/],
  ["vendor-motion", /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/],
];

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return undefined;
  for (const [name, pattern] of VENDOR_CHUNKS) if (pattern.test(id)) return name;
  return undefined; // الباقي (مثل recharts) يتبع الصفحة التي تستخدمه.
}

const plugins = [react(), tailwindcss(), optionalAnalytics()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks } },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
