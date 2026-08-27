import { describe, expect, it } from "vitest";
import { DEFAULT_QURAN_READER_PREFERENCES } from "../client/src/lib/quranReaderPreferences";

describe("تفضيلات قارئ المصحف", () => {
  it("تبقي الشاشة مستيقظة خياراً صريحاً ومعطلاً افتراضياً", () => {
    expect(DEFAULT_QURAN_READER_PREFERENCES).toMatchObject({ darkMode: false, keepScreenAwake: false, textScale: "comfortable", studyFont: "sans" });
  });
});
