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

const ROOT = import.meta.dirname;
const r = (...parts: string[]) => path.resolve(ROOT, ...parts);

/**
 * نسخة الجهاز المحلية (`vite build --mode device`): تطبيق أندرويد يعمل دون خادم.
 * منطق الخادم (server/) يُضمَّن في الواجهة ويعمل على SQLite داخل WebView؛ نستبدل هنا الملفات
 * المرتبطة بـ Node/MySQL ببدائل للمتصفح حسب مسارها الفعلي بعد الحل (أياً كانت صيغة الاستيراد).
 */
function localModeOverrides(): Plugin {
  const files = new Map<string, string>([
    [r("drizzle/schema.ts"), r("drizzle/schema.sqlite.ts")],
    [r("server/data/connection.ts"), r("client/src/local/connection.ts")],
    [r("server/_core/logger.ts"), r("client/src/local/shims/logger.ts")],
    [r("server/storage.ts"), r("client/src/local/shims/storage.ts")],
    [r("client/src/lib/apiLink.ts"), r("client/src/local/apiLink.ts")],
  ]);
  const builtins = new Map<string, string>([
    ["node:crypto", r("client/src/local/shims/crypto.ts")],
    ["crypto", r("client/src/local/shims/crypto.ts")],
    ["node:util", r("client/src/local/shims/util.ts")],
    ["util", r("client/src/local/shims/util.ts")],
  ]);
  return {
    name: "tarteel-local-mode-overrides",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const builtin = builtins.get(source);
      if (builtin) return builtin;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      const replacement = files.get(resolved.id.split("?")[0]);
      return replacement ? { ...resolved, id: replacement } : resolved;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isLocal = mode === "device";
  const plugins = isLocal ? [localModeOverrides(), react(), tailwindcss()] : [react(), tailwindcss(), optionalAnalytics()];
  return {
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
  // إعدادات منطق الخادم (process.env) تأتي في نسخة الجهاز من client/src/local/env.ts.
  // __TARTEEL_DEVICE__ ثابت منطقي يُستبدل وقت البناء فتُحذف شيفرة نسخة الجهاز من نسخة الخادم كلياً.
  define: isLocal
    ? { __TARTEEL_DEVICE__: "true", "import.meta.env.VITE_TARTEEL_LOCAL": JSON.stringify("1"), "process.env": "globalThis.__TARTEEL_ENV__" }
    : { __TARTEEL_DEVICE__: "false" },
  build: {
    outDir: path.resolve(import.meta.dirname, isLocal ? "dist/local" : "dist/public"),
    emptyOutDir: true,
    // WebView في أندرويد يُحدَّث من Google Play؛ Chrome 80+ يغطي الأجهزة العاملة اليوم.
    target: isLocal ? ["es2020", "chrome80"] : undefined,
    chunkSizeWarningLimit: isLocal ? 4000 : undefined,
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
  };
});
