import { validateQuranStudyPage } from "../shared/quranStudy";
import { describe, expect, it } from "vitest";

const validStudyPage = {
  page: 1,
  attribution: "مصدر موثق",
  license: "CC BY 4.0",
  verses: { "1:1": { tafsir: "شرح موثق", translation: "Verified translation", words: [{ number: 1, word: "كلمة", meaning: "معنى موثق" }] } },
};

describe("بيانات فهم الآية", () => {
  it("يقبل صفحة تفسير مرخصة تحمل تفسيراً وترجمةً ومعاني كلمات قابلة للعرض", () => {
    expect(validateQuranStudyPage(validStudyPage, 1)).toBe(true);
  });

  it("يرفض بيانات الصفحة الناقصة أو رقم الصفحة أو مرجع الآية غير الصالح", () => {
    expect(validateQuranStudyPage({ ...validStudyPage, page: 605 })).toBe(false);
    expect(validateQuranStudyPage({ ...validStudyPage, attribution: "" })).toBe(false);
    expect(validateQuranStudyPage({ ...validStudyPage, verses: { "115:1": validStudyPage.verses["1:1"] } })).toBe(false);
    expect(validateQuranStudyPage({ ...validStudyPage, verses: { "1:1": { ...validStudyPage.verses["1:1"], words: [{ number: 0, word: "كلمة", meaning: "معنى" }] } } })).toBe(false);
  });
});
