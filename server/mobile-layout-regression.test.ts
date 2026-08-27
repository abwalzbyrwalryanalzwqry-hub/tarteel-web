import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("تخطيط الهاتف للمسارات الداخلية", () => {
  it("لا يجعل الشريط الجانبي المخفي حاوية الهاتف مرنة قبل نقطة سطح المكتب", () => {
    const layout = readFileSync(path.join(root, "client/src/components/TarteelLayout.tsx"), "utf8");
    expect(layout).toContain('className="min-h-screen bg-background lg:flex"');
    expect(layout).toContain('className="flex min-w-0 flex-col lg:flex-1"');
  });

  it("يرتب الإشعارات عمودياً في الهاتف ويقيد عرض الحاوية", () => {
    const notifications = readFileSync(path.join(root, "client/src/pages/Notifications.tsx"), "utf8");
    expect(notifications).toContain('className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden"');
    expect(notifications).toContain('className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"');
    expect(notifications).toContain("flex-col gap-3 rounded-2xl");
  });
});
