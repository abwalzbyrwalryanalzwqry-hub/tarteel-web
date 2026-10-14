import { describe, expect, it } from "vitest";
import { detectStandaloneMushaf } from "./standalone";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("المصحف المستقل (تبويب المصحف في أندرويد)", () => {
  it("لا يعمل في نسخة الخادم حتى مع المعامل", () => {
    expect(
      detectStandaloneMushaf(
        false,
        { pathname: "/quran", search: "?app=reader" },
        memoryStorage()
      )
    ).toBe(false);
  });

  it("يُفعَّل بالمعامل في نسخة الجهاز ويبقى بعد سقوطه من العنوان", () => {
    const storage = memoryStorage();
    expect(
      detectStandaloneMushaf(
        true,
        { pathname: "/quran", search: "?app=reader" },
        storage
      )
    ).toBe(true);
    expect(
      detectStandaloneMushaf(
        true,
        { pathname: "/quran/read", search: "?surah=2" },
        storage
      )
    ).toBe(true);
  });

  it("نسخة الجهاز دون المعامل هي المنصة الكاملة", () => {
    expect(
      detectStandaloneMushaf(
        true,
        { pathname: "/quran", search: "" },
        memoryStorage()
      )
    ).toBe(false);
  });
});
