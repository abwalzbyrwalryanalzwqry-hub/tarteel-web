import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { initErrorReporting, logger, reportError, requestLogger } from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (ENV.isProduction && !ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required in production");
  }
  if (ENV.cookieSecret && ENV.cookieSecret.length < 32) {
    logger.warn("JWT_SECRET is shorter than 32 characters; use `openssl rand -base64 48`.");
  }
  await initErrorReporting();
  const app = express();
  // خلف Nginx/Caddy/Render: لقراءة https وعنوان IP الحقيقي.
  app.set("trust proxy", ENV.trustProxyHops);
  app.disable("x-powered-by");
  app.use(requestLogger);
  const server = createServer(app);
  // أكبر طلب مشروع هو رفع شعار (2MB كـ base64 ≈ 2.8MB)؛ الحد السابق 50MB كان يسمح بإغراق الخادم.
  app.use("/api/trpc", express.json({ limit: "4mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      // أخطاء الإدخال والصلاحيات متوقعة؛ نسجل فقط ما يدل على عطل حقيقي في الخادم.
      onError({ error, path, ctx, type }) {
        if (error.code !== "INTERNAL_SERVER_ERROR") return;
        reportError(error.cause ?? error, { procedure: path, type, userId: ctx?.user?.id });
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // في الإنتاج يجب أن يعمل الخادم على المنفذ المحدد بالضبط، وإلا يفقده Caddy وفحص الصحة دون أي تنبيه.
  if (ENV.isProduction && !(await isPortAvailable(preferredPort))) {
    throw new Error(`Port ${preferredPort} is already in use`);
  }
  const port = ENV.isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info({ port }, `Server running on http://localhost:${port}/`);
  });
}

startServer().catch((error) => {
  logger.fatal({ err: error }, "server failed to start");
  process.exit(1);
});
