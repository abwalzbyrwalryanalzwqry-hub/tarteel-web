import { describe, expect, it } from "vitest";
import { setStaticCacheHeaders } from "./vite";

const headerFor = (file: string) => {
  const headers: Record<string, string> = {};
  setStaticCacheHeaders({ setHeader: (name, value) => { headers[name] = value; } }, file);
  return headers["Cache-Control"];
};

describe("رؤوس التخزين للملفات الثابتة", () => {
  it("ملفات /assets/ المُجزّأة تُحفظ سنة", () => {
    expect(headerFor("/app/dist/public/assets/index-CiwT8vLI.js")).toBe("public, max-age=31536000, immutable");
    expect(headerFor("C:\\app\\dist\\public\\assets\\x.css")).toContain("immutable");
  });
  it("index.html وعامل الخدمة والبيان يُتحقق منها كل مرة", () => {
    for (const file of ["/app/dist/public/index.html", "/app/dist/public/sw.js", "/app/dist/public/manifest.webmanifest"]) expect(headerFor(file)).toBe("no-cache");
  });
  it("الأيقونات وغيرها يوم واحد", () => {
    expect(headerFor("/app/dist/public/icons/icon-192.png")).toBe("public, max-age=86400");
  });
});
