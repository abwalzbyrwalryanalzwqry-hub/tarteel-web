import express from "express";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";

describe("سجلات الخادم", () => {
  it("يحجب كلمات المرور والرموز والكوكيز", () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const log = pino(
      {
        redact: {
          paths: [
            "req.headers.cookie",
            "req.headers.authorization",
            "*.password",
            "*.token",
            "*.inviteCode",
          ],
          censor: "[محجوب]",
        },
      },
      sink
    );
    log.info(
      {
        input: {
          password: "Quran1234",
          token: "abc",
          inviteCode: "TRTL-1234ABCD",
        },
        req: {
          headers: {
            cookie: "app_session_id=secret",
            authorization: "Bearer x",
          },
        },
      },
      "x"
    );
    const text = lines.join("");
    for (const secret of [
      "Quran1234",
      'abc"',
      "TRTL-1234ABCD",
      "app_session_id=secret",
      "Bearer x",
    ])
      expect(text).not.toContain(secret);
    expect(text).toContain("[محجوب]");
  });

  it("يسجل طلبات API بالمسار والحالة والمدة دون الاستعلام، ويتخطى فحص الصحة", async () => {
    const { logger, requestLogger } = await import("./logger");
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const app = express();
    app.use(requestLogger);
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    // مسار مركّب كما في tRPC: Express يغيّر req.path داخله.
    const trpc = express.Router();
    trpc.get("/students.list", (_req, res) => res.json({ ok: true }));
    app.use("/api/trpc", trpc);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    await fetch(`http://127.0.0.1:${port}/api/health`);
    await fetch(
      `http://127.0.0.1:${port}/api/trpc/students.list?input=%7B%22secret%22%3A1%7D`
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    server.close();
    expect(info).toHaveBeenCalledTimes(1);
    const [fields] = info.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(fields).toMatchObject({
      method: "GET",
      path: "/api/trpc/students.list",
      status: 200,
    });
    expect(JSON.stringify(fields)).not.toContain("secret");
    info.mockRestore();
  });
});
