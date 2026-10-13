import express from "express";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "./securityHeaders";

async function headersFor(options: Parameters<typeof securityHeaders>[0]) {
  const app = express();
  app.use(securityHeaders(options));
  app.get("/", (_req, res) => res.send("ok"));
  const server = app.listen(0);
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
  server.close();
  return response.headers;
}

describe("ترويسات الأمان (M2)", () => {
  it("سياسة ضيقة: لا سكربت مضمن ولا خارجي، ولا object، ولا تضمين من مواقع أخرى", () => {
    const policy = buildContentSecurityPolicy();
    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("frame-src 'self' blob:");
  });

  it("المصادر الإضافية تُقبل بصيغة https فقط", () => {
    const policy = buildContentSecurityPolicy(["https://stats.example.com", "javascript:alert(1)", "*", "http://plain.test"]);
    expect(policy).toContain("script-src 'self' https://stats.example.com;");
    expect(policy).not.toContain("javascript:");
    expect(policy).not.toContain(" * ");
    expect(policy).not.toContain("http://plain.test");
  });

  it("في الإنتاج: CSP وnosniff وبقية الترويسات", async () => {
    const headers = await headersFor({ isProduction: true, mode: "enforce" });
    expect(headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(headers.get("permissions-policy")).toContain("camera=()");
  });

  it("report-only يغير اسم الترويسة، وoff والتطوير بلا CSP (مع بقاء nosniff)", async () => {
    expect((await headersFor({ isProduction: true, mode: "report-only" })).get("content-security-policy-report-only")).toBeTruthy();
    const off = await headersFor({ isProduction: true, mode: "off" });
    expect(off.get("content-security-policy")).toBeNull();
    const dev = await headersFor({ isProduction: false });
    expect(dev.get("content-security-policy")).toBeNull();
    expect(dev.get("x-content-type-options")).toBe("nosniff");
  });
});
