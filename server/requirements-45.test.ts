import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("مواءمة الملفين الرابع والخامس", () => {
  it("يستخدم تقويم التصميم الحالي ويعلّم أيام الفترات دون شاشة مكررة", () => {
    const sessions = readFileSync(path.join(root, "client/src/pages/Sessions.tsx"), "utf8");
    expect(sessions).toContain('import { Calendar }');
    expect(sessions).toContain("hasSession");
    expect(sessions).toContain("selectedDate");
    expect(sessions).toContain("الفترات");
  });

  it("يوفر حضوراً سريعاً متفائلاً ومصحفاً يحافظ على نموذج الإدخال", () => {
    const circle = readFileSync(path.join(root, "client/src/pages/CircleDetail.tsx"), "utf8");
    const detail = readFileSync(path.join(root, "client/src/pages/SessionDetail.tsx"), "utf8");
    expect(circle).toContain("onMutate");
    expect(circle).toContain("حضور الفترة المفتوحة");
    expect(detail).toContain("فتح موضع البداية في المصحف المرئي");
    expect(detail).toContain("saveMushafSelectionContext(context)");
    expect(detail).toContain('window.location.assign(`/quran/picker?surah=${fromSurah}&ayah=${fromAyah}&mushafToken=');
    expect(detail).toContain("DialogDescription");
  });
});
