import { describe, expect, it } from "vitest";
import { generateCsv, generateWordDocument } from "./text";

describe("تصدير Word وCSV", () => {
  it("ينشئ CSV بترميز عربي ويهربي علامات الاقتباس", () => {
    const csv = generateCsv(["الاسم", "الملاحظة"], [["خالد", "قال: \"ممتاز\""]]).toString("utf8");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"قال: ""ممتاز"""');
  });

  it("ينشئ وثيقة Word عربية باتجاه RTL مع تهريب نص المستخدم", () => {
    const word = generateWordDocument("تقرير الطلاب", ["المركز: ترتيل"], ["الاسم"], [["<نص>"]]).toString("utf8");
    expect(word).toContain('dir="rtl"');
    expect(word).toContain("تقرير الطلاب");
    expect(word).toContain("&lt;نص&gt;");
  });
});
