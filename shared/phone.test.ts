import { describe, expect, it } from "vitest";
import { looksLikePhone, normalizePhone, toLatinDigits } from "./phone";

describe("توحيد رقم الهاتف", () => {
  it("الرقم اليمني المحلي يُكمَّل برمز 967", () => {
    expect(normalizePhone("771234567")).toBe("+967771234567");
    expect(normalizePhone("77 123 4567")).toBe("+967771234567");
    expect(normalizePhone("0771234567")).toBe("+967771234567");
  });

  it("الصيغ الدولية بـ + أو 00 أو برمز الدولة دون علامة تعطي الرقم نفسه", () => {
    expect(normalizePhone("+967 77-123-4567")).toBe("+967771234567");
    expect(normalizePhone("00967771234567")).toBe("+967771234567");
    expect(normalizePhone("967771234567")).toBe("+967771234567");
    expect(normalizePhone("(+967) 771 234 567")).toBe("+967771234567");
  });

  it("يقبل الأرقام العربية والفارسية", () => {
    expect(toLatinDigits("٧٧١٢٣٤٥٦٧")).toBe("771234567");
    expect(normalizePhone("٧٧١٢٣٤٥٦٧")).toBe("+967771234567");
    expect(normalizePhone("+۹۶۶۵۵۱۲۳۴۵۶۷")).toBe("+966551234567");
  });

  it("رمز الدولة الافتراضي قابل للتغيير (السعودية مثلاً) ويُحذف صفر الخط", () => {
    expect(normalizePhone("0551234567", "966")).toBe("+966551234567");
    expect(normalizePhone("+967771234567", "966")).toBe("+967771234567");
  });

  it("يرفض النصوص والبريد والأرقام القصيرة أو الطويلة", () => {
    expect(normalizePhone("user@example.com")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+12345")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
    expect(normalizePhone("+0771234567")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("يميّز الهاتف عن البريد في حقل واحد", () => {
    expect(looksLikePhone("+967 771 234 567")).toBe(true);
    expect(looksLikePhone("٧٧١٢٣٤٥٦٧")).toBe(true);
    expect(looksLikePhone("771234567@x.co")).toBe(false);
    expect(looksLikePhone("ahmad@example.com")).toBe(false);
  });
});
