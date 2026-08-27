export const MUSHAF_VIEWBOX = { width: 382.68, height: 547.09 } as const;
export const MUSHAF_PAGE_COUNT = 604;
export const MUSHAF_SURAH_COUNT = 114;
export const MUSHAF_VERSE_COUNT = 6236;

export type MushafVerseRef = readonly [surah: number, ayah: number];
export type MushafHitZone = readonly [
  surah: number,
  ayah: number,
  line: number,
  left: number,
  top: number,
  width: number,
  height: number,
];

export interface MushafVisualPage {
  page: number;
  url: string;
  verses: MushafVerseRef[];
  zones: MushafHitZone[];
}

export interface MushafVisualRegistry {
  source: string;
  version: string;
  pageCount: number;
  surahCount: number;
  verseCount: number;
  pages: MushafVisualPage[];
}

export interface MushafVisualManifestPage {
  page: number;
  url: string;
  zonesUrl: string;
  verses: MushafVerseRef[];
}

export interface MushafVisualManifest {
  source: string;
  version: string;
  pageCount: number;
  surahCount: number;
  verseCount: number;
  pages: MushafVisualManifestPage[];
}

export interface MushafVisualPageData {
  page: number;
  zones: MushafHitZone[];
}

export interface MushafTapState {
  surah: number;
  ayah: number;
  count: number;
  at: number;
}

export interface MushafTapResolution {
  state: MushafTapState;
  selected: boolean;
}

export function findMushafPage<T extends { pages: Array<{ page: number; verses: MushafVerseRef[] }> }>(registry: T, surah: number, ayah: number) {
  return registry.pages.find((page) => page.verses.some(([candidateSurah, candidateAyah]) => candidateSurah === surah && candidateAyah === ayah));
}

export function validateMushafRegistry(registry: MushafVisualRegistry) {
  if (registry.pageCount !== MUSHAF_PAGE_COUNT || registry.pages.length !== MUSHAF_PAGE_COUNT) return false;
  if (registry.surahCount !== MUSHAF_SURAH_COUNT || registry.verseCount !== MUSHAF_VERSE_COUNT) return false;
  const pages = new Set(registry.pages.map((page) => page.page));
  if (pages.size !== MUSHAF_PAGE_COUNT) return false;
  for (let page = 1; page <= MUSHAF_PAGE_COUNT; page += 1) if (!pages.has(page)) return false;
  const surahs = new Set<number>();
  const verses = new Set<string>();
  for (const page of registry.pages) {
    if (!page.url.startsWith("/manus-storage/") || page.verses.length === 0 || page.zones.length === 0) return false;
    const pageVerses = new Set<string>();
    for (const [surah, ayah] of page.verses) {
      if (!Number.isInteger(surah) || surah < 1 || surah > MUSHAF_SURAH_COUNT || !Number.isInteger(ayah) || ayah < 1) return false;
      const key = `${surah}:${ayah}`;
      pageVerses.add(key);
      verses.add(key);
      surahs.add(surah);
    }
    if (!page.zones.every(([surah, ayah]) => pageVerses.has(`${surah}:${ayah}`))) return false;
  }
  return surahs.size === MUSHAF_SURAH_COUNT && verses.size === MUSHAF_VERSE_COUNT;
}

export function validateMushafVisualManifest(manifest: MushafVisualManifest) {
  if (manifest.pageCount !== MUSHAF_PAGE_COUNT || manifest.pages.length !== MUSHAF_PAGE_COUNT) return false;
  if (manifest.surahCount !== MUSHAF_SURAH_COUNT || manifest.verseCount !== MUSHAF_VERSE_COUNT) return false;
  const pages = new Set(manifest.pages.map((page) => page.page));
  const surahs = new Set<number>();
  const verses = new Set<string>();
  for (let pageNumber = 1; pageNumber <= MUSHAF_PAGE_COUNT; pageNumber += 1) if (!pages.has(pageNumber)) return false;
  for (const page of manifest.pages) {
    if (!page.url.startsWith("/manus-storage/") || !page.zonesUrl.startsWith("/manus-storage/") || page.verses.length === 0) return false;
    for (const [surah, ayah] of page.verses) {
      if (!Number.isInteger(surah) || surah < 1 || surah > MUSHAF_SURAH_COUNT || !Number.isInteger(ayah) || ayah < 1) return false;
      surahs.add(surah);
      verses.add(`${surah}:${ayah}`);
    }
  }
  return surahs.size === MUSHAF_SURAH_COUNT && verses.size === MUSHAF_VERSE_COUNT;
}

export function validateMushafPageData(page: MushafVisualManifestPage, data: MushafVisualPageData) {
  if (page.page !== data.page || data.zones.length === 0) return false;
  const pageVerses = new Set(page.verses.map(([surah, ayah]) => `${surah}:${ayah}`));
  return data.zones.every(([surah, ayah, line, left, top, width, height]) => pageVerses.has(`${surah}:${ayah}`) && Number.isInteger(line) && line > 0 && [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0);
}

export function resolveMushafTripleTap(
  previous: MushafTapState | null,
  target: { surah: number; ayah: number },
  at: number,
  intervalMs = 850,
): MushafTapResolution {
  const continued = previous && previous.surah === target.surah && previous.ayah === target.ayah && at - previous.at <= intervalMs;
  const count = continued ? previous.count + 1 : 1;
  const state = { ...target, count, at };
  return { state, selected: count >= 3 };
}

export function resolveMushafSwipeDirection(deltaX: number, deltaY: number, threshold = 36) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function resolveMushafPageFit(availableWidth: number, availableHeight: number) {
  if (![availableWidth, availableHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(availableWidth / MUSHAF_VIEWBOX.width, availableHeight / MUSHAF_VIEWBOX.height);
  return {
    scale,
    width: MUSHAF_VIEWBOX.width * scale,
    height: MUSHAF_VIEWBOX.height * scale,
  };
}

export function clampMushafPage(page: number) {
  return Math.max(1, Math.min(MUSHAF_PAGE_COUNT, Math.round(page)));
}
