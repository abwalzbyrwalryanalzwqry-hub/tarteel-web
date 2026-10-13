import { describe, expect, it } from "vitest";
import { toArabicPdfText, truncatePdfValue } from "./arabicPdf";

/**
 * toArabicPdfText يُبقي العربية بترتيبها المنطقي (يشكّلها Amiri ويعكس fontkit السطر)،
 * ويعكس مسبقاً المقاطع اللاتينية والأرقام لتعود صحيحة بعد عكس السطر.
 */
const visual = (text: string) => Array.from(text).reverse().join("");

describe("معالجة العربية في تصدير PDF", () => {
  it("يُبقي الكلمات العربية ومسافاتها بترتيبها المنطقي دون أشكال العرض", () => {
    expect(toArabicPdfText("التقرير التنفيذي")).toBe("التقرير التنفيذي");
    expect(toArabicPdfText("ترتيل")).not.toMatch(/[\uFE70-\uFEFF]/);
  });

  it("الأرقام والتواريخ تُقرأ صحيحة بعد عكس السطر العربي", () => {
    expect(visual(toArabicPdfText("من 14/9/2026"))).toBe("١٤/٩/٢٠٢٦ نم");
    expect(visual(toArabicPdfText("نسبة الحضور 67%"))).toContain("٦٧٪");
  });

  it("الأسماء اللاتينية داخل سطر عربي تبقى من اليسار لليمين", () => {
    expect(visual(toArabicPdfText("المعلم Ahmed Ali"))).toContain("Ahmed");
    expect(visual(toArabicPdfText("البريد center@example.org"))).toContain("center@example.org");
  });

  it("سطر يبدأ بحرف لاتيني لا يُعكس (يرسمه fontkit من اليسار لليمين)", () => {
    expect(toArabicPdfText("Ahmed Ali 2026")).toBe("Ahmed Ali ٢٠٢٦");
  });

  it("تُقلب الأقواس في السطر العربي لتظهر في مكانها الصحيح", () => {
    expect(toArabicPdfText("حلقة (المستوى الأول)")).toBe("حلقة )المستوى الأول(");
  });

  it("يحد النص الطويل داخل الخلية", () => {
    expect(truncatePdfValue("ملاحظات طويلة جداً لا تناسب عرض خلية واحدة في التقرير", 18)).toContain("...");
  });
});
