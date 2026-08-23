import { describe, expect, it } from "vitest";
import { generateStudentsReportPDF } from "./pdf";

describe("تصدير تقرير الطلاب PDF", () => {
  it("ينشئ ملف PDF صالحاً بتقرير طلاب مخصص", async () => {
    const pdf = await generateStudentsReportPDF(
      [{
        name: "عبدالله محمد",
        phone: "0500000000",
        guardianName: "محمد أحمد",
        enrollmentDate: "١٤٤٨/٠٣/٠١",
        status: "نشط",
      }],
      "مركز ترتيل",
      "حلقة الفجر"
    );

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(100);
  });
});
