import { clampMushafPage, findMushafPage, MUSHAF_PAGE_COUNT, MUSHAF_SURAH_COUNT, MUSHAF_VERSE_COUNT, MUSHAF_VIEWBOX, resolveMushafPageFit, resolveMushafSwipeDirection, resolveMushafTripleTap, validateMushafPageData, validateMushafRegistry, validateMushafVisualManifest, type MushafVisualRegistry } from "../shared/mushafVisual";
import { validateQuranNavigationData } from "../shared/quranNavigation";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const allVerseRefs = Array.from({ length: MUSHAF_VERSE_COUNT }, (_, index) => [index % MUSHAF_SURAH_COUNT + 1, Math.floor(index / MUSHAF_SURAH_COUNT) + 1] as const);

const registry: MushafVisualRegistry = {
  source: "اختبار",
  version: "1.01",
  pageCount: MUSHAF_PAGE_COUNT,
  surahCount: MUSHAF_SURAH_COUNT,
  verseCount: MUSHAF_VERSE_COUNT,
  pages: Array.from({ length: MUSHAF_PAGE_COUNT }, (_, index) => ({
    page: index + 1,
    url: `/manus-storage/${String(index + 1).padStart(3, "0")}.svg`,
    verses: allVerseRefs.filter((_, verseIndex) => verseIndex % MUSHAF_PAGE_COUNT === index),
    zones: [[...(allVerseRefs.find((_, verseIndex) => verseIndex % MUSHAF_PAGE_COUNT === index) ?? [1, 1]), 1, 1, 1, 1, 1] as const],
  })),
};

describe("قارئ المصحف المرئي", () => {
  it("يرفض فهرساً لا يطابق عقد 604 صفحة و114 سورة و6236 آية", () => {
    expect(validateMushafRegistry(registry)).toBe(true);
    expect(validateMushafRegistry({ ...registry, pageCount: 603 })).toBe(false);
    expect(validateMushafRegistry({ ...registry, verseCount: 6235 })).toBe(false);
    expect(validateMushafRegistry({ ...registry, surahCount: 113 })).toBe(false);
    expect(validateMushafRegistry({ ...registry, pages: registry.pages.map((page, index) => index === 0 ? { ...page, zones: [[114, 6236, 1, 1, 1, 1, 1]] } : page) })).toBe(false);
  });

  it("يتحقق من البيان الخفيف وملف مناطق الصفحة قبل إتاحة النقر", () => {
    const manifest = { ...registry, pages: registry.pages.map(({ page, url, verses }) => ({ page, url, verses, zonesUrl: `/manus-storage/${String(page).padStart(3, "0")}-zones.js` })) };
    expect(validateMushafVisualManifest(manifest)).toBe(true);
    expect(validateMushafPageData(manifest.pages[0], { page: 1, zones: registry.pages[0].zones })).toBe(true);
    expect(validateMushafPageData(manifest.pages[0], { page: 1, zones: [[114, 6236, 1, 1, 1, 1, 1]] })).toBe(false);
  });

  it("يجد صفحة البداية ويضبط التنقل داخل نطاق صفحات المصحف", () => {
    expect(findMushafPage(registry, 1, 1)?.page).toBe(1);
    expect(clampMushafPage(-8)).toBe(1);
    expect(clampMushafPage(900)).toBe(604);
    expect(clampMushafPage(17.8)).toBe(18);
  });

  it("لا يختار النهاية إلا بعد ثلاث نقرات متتابعة على الآية ذاتها", () => {
    const first = resolveMushafTripleTap(null, { surah: 2, ayah: 255 }, 1000);
    const second = resolveMushafTripleTap(first.state, { surah: 2, ayah: 255 }, 1500);
    const third = resolveMushafTripleTap(second.state, { surah: 2, ayah: 255 }, 1800);
    const reset = resolveMushafTripleTap(third.state, { surah: 2, ayah: 256 }, 1900);
    const expired = resolveMushafTripleTap(second.state, { surah: 2, ayah: 255 }, 2400);

    expect(first.selected).toBe(false);
    expect(second.state.count).toBe(2);
    expect(third.selected).toBe(true);
    expect(reset.state.count).toBe(1);
    expect(expired.state.count).toBe(1);
  });

  it("يحوّل السحب الأفقي المقصود فقط إلى اتجاه تقليب واضح", () => {
    expect(resolveMushafSwipeDirection(-72, 6)).toBe(1);
    expect(resolveMushafSwipeDirection(72, 6)).toBe(-1);
    expect(resolveMushafSwipeDirection(-24, 2)).toBe(0);
    expect(resolveMushafSwipeDirection(-48, 48)).toBe(0);
  });

  it("يكبر صفحة المصحف إلى أكبر مساحة متاحة من دون قص أو تمديد", () => {
    const fit = resolveMushafPageFit(375, 812);
    expect(fit).toBeTruthy();
    expect(fit?.width).toBeLessThanOrEqual(375);
    expect(fit?.height).toBeLessThanOrEqual(812);
    expect(fit?.width && fit?.height ? fit.width / fit.height : 0).toBeCloseTo(MUSHAF_VIEWBOX.width / MUSHAF_VIEWBOX.height, 8);
    expect(resolveMushafPageFit(0, 812)).toBeNull();
  });

  it("يوحد إطار المصحف وأدواته بين القراءة العامة واختيار آية النهاية", () => {
    const reader = readFileSync("client/src/components/VisualMushafReader.tsx", "utf8");
    const picker = readFileSync("client/src/pages/MushafPickerPage.tsx", "utf8");
    expect(reader).toContain("mushaf-reader-shell");
    expect(reader).toContain("mushaf-page-shell");
    expect(reader).toContain("mushaf-selection-prompt");
    expect(reader).toContain("mushaf-page-counter");
    expect(reader).toContain("shareCurrentPage");
    expect(reader).toContain("/quran/read?page=${pageNumber}");
    expect(reader).toContain("mushaf-reader-controls");
    expect(reader).toContain("mushaf-controls-hidden");
    expect(reader).toContain("revealControls");
    expect(reader).toContain("ArrowRight");
    expect(picker).toContain("<VisualMushafReader");
    expect(picker).toContain("focusMode");
  });

  it("لا يتيح فهرس الأجزاء والأحزاب إلا بالعقد الكامل ونطاق الصفحات الصحيح", () => {
    const entry = (number: number, page: number) => ({ number, page, surah: 1, ayah: 1 });
    const navigation = { source: "مصدر اختبار", juz: Array.from({ length: 30 }, (_, index) => entry(index + 1, index + 1)), hizbs: Array.from({ length: 60 }, (_, index) => entry(index + 1, index + 1)) };
    expect(validateQuranNavigationData(navigation)).toBe(true);
    expect(validateQuranNavigationData({ ...navigation, juz: navigation.juz.slice(1) })).toBe(false);
    expect(validateQuranNavigationData({ ...navigation, hizbs: navigation.hizbs.map((item, index) => index === 59 ? { ...item, page: 605 } : item) })).toBe(false);
  });
});
