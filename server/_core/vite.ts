import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { logger } from "./logger";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // تحميل vite وإعداداته عند الطلب فقط: صورة الإنتاج تثبّت اعتماديات الإنتاج وحدها، وvite منها خارج.
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.resolve(import.meta.dirname, "../..", "vite.config.ts"),
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    logger.error(
      { distPath },
      "could not find the build directory; build the client first"
    );
  }

  app.use(express.static(distPath, { setHeaders: setStaticCacheHeaders }));

  // fall through to index.html if the file doesn't exist
  // Express 5 لا يقبل "*" مساراً؛ app.use بلا مسار يطابق كل الطلبات.
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

/**
 * ملفات /assets/ تحمل بصمة محتواها في اسمها فلا تتغير: تُحفظ سنة. أما index.html وsw.js
 * والبيان فيجب أن يتحقق منها المتصفح كل مرة، وإلا بقي المستخدم على نسخة قديمة بعد النشر.
 */
export function setStaticCacheHeaders(res: { setHeader(name: string, value: string): unknown }, filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  else if (/\/(index\.html|sw\.js|manifest\.webmanifest)$/.test(normalized)) res.setHeader("Cache-Control", "no-cache");
  else res.setHeader("Cache-Control", "public, max-age=86400");
}
