import { describe, expect, it } from "vitest";
import { parseTanzilUthmaniText, searchQuranVerses } from "../shared/quran";
import { createSmsUrl, createWhatsAppUrl, renderParentMessage } from "../shared/messageTemplates";

describe("مركز القرآن", () => {
  it("يحلل نص تنـزيل بصيغة السورة والآية والنص", () => {
    const verses = parseTanzilUthmaniText("1|1|بِسْمِ ٱللَّهِ\n1|2|ٱلْحَمْدُ لِلَّهِ");
    expect(verses).toEqual([{ surah: 1, ayah: 1, text: "بِسْمِ ٱللَّهِ" }, { surah: 1, ayah: 2, text: "ٱلْحَمْدُ لِلَّهِ" }]);
    expect(searchQuranVerses(verses, "الحمد")).toHaveLength(1);
  });
});

describe("رسائل أولياء الأمور", () => {
  it("يستبدل المتغيرات ويجهز روابط تواصل يدوية فقط", () => {
    expect(renderParentMessage("الطالب {{studentName}} في {{circleName}}", { studentName: "أحمد", circleName: "حلقة الفجر" })).toBe("الطالب أحمد في حلقة الفجر");
    expect(createWhatsAppUrl("967 776343551", "السلام عليكم")).toContain("https://wa.me/967776343551?text=");
    expect(createSmsUrl("776343551", "السلام عليكم")).toBe("sms:776343551?body=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85");
  });
});
