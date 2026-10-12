import { describe, expect, it, vi } from "vitest";

vi.mock("expo-asset", () => ({ Asset: { fromModule: vi.fn() } }));
vi.mock("expo-file-system/legacy", () => ({ EncodingType: { UTF8: "utf8" } }));

import { parseLocalQuran, searchLocalQuran } from "./localQuran";

describe("local Quran asset", () => {
  const verses = parseLocalQuran("# license\n1|1|بِسْمِ ٱللَّهِ\n1|2|الْحَمْدُ لِلَّهِ\n");

  it("parses only structured verses", () => {
    expect(verses).toHaveLength(2);
    expect(verses[0]).toEqual({ surah: 1, ayah: 1, text: "بِسْمِ ٱللَّهِ" });
  });

  it("searches locally after Arabic normalization", () => {
    expect(searchLocalQuran(verses, "الحمد")).toEqual([{ surah: 1, ayah: 2, text: "الْحَمْدُ لِلَّهِ" }]);
  });
});
