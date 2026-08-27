import { describe, expect, it } from "vitest";
import { isArabicPdfVisualText, toArabicPdfText, truncatePdfValue } from "./arabicPdf";

describe("معالجة العربية في تصدير PDF", () => {
  it("يشكل النص العربي لتفادي الحروف المتناثرة داخل PDFKit", () => {
    expect(isArabicPdfVisualText(toArabicPdfText("تقرير الحفظ"))).toBe(true);
  });

  it("يعكس ترتيب الكلمات فقط من دون قلب حروف الكلمة العربية", () => {
    expect(toArabicPdfText("التقرير التنفيذي")).toBe("ﺍﻟﺘﻨﻔﻴﺬﻱ ﺍﻟﺘﻘﺮﻳﺮ");
    expect(toArabicPdfText("ترتيل")).toBe("ﺗﺮﺗﻴﻞ");
  });

  it("يحافظ على محتوى عربي مختلط بالأرقام ويحد النص الطويل داخل الخلية", () => {
    const visual = toArabicPdfText("صفحات الحفظ: 24", 28);
    expect(visual).toContain("٢٤");
    expect(truncatePdfValue("ملاحظات طويلة جداً لا تناسب عرض خلية واحدة في التقرير", 18)).toContain("...");
  });

  it("يتجنب الرموز غير المدعومة في الخط العربي المضمن", () => {
    expect(toArabicPdfText("النسبة: 100% — /", 40)).not.toMatch(/[—%/]/);
  });
});
