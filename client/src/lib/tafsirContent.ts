export const TAFSIR_MANIFEST_URL = "/storage/tafsir-manifest_86958e1c.json";

import { QURAN_STUDY_PAGE_COUNT, validateQuranStudyPage, type QuranStudyPage, type QuranStudyVerse, type QuranWordMeaning } from "../../../shared/quranStudy";

export type { QuranStudyPage, QuranStudyVerse, QuranWordMeaning };
type TafsirManifest = { source: string; license: string; pageCount: number; urls: Record<string, string> };

let manifestPromise: Promise<TafsirManifest> | null = null;
const pagePromises = new Map<number, Promise<QuranStudyPage>>();

async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(TAFSIR_MANIFEST_URL)
      .then((response) => { if (!response.ok) throw new Error("تعذر تحميل بيان التفسير."); return response.json() as Promise<TafsirManifest>; })
      .then((manifest) => {
        if (manifest.pageCount !== QURAN_STUDY_PAGE_COUNT || Object.keys(manifest.urls).length !== QURAN_STUDY_PAGE_COUNT) throw new Error("بيان التفسير غير مكتمل.");
        return manifest;
      });
  }
  return manifestPromise;
}

export async function loadQuranStudyPage(pageNumber: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > QURAN_STUDY_PAGE_COUNT) throw new Error("رقم صفحة المصحف غير صحيح.");
  if (!pagePromises.has(pageNumber)) {
    pagePromises.set(pageNumber, loadManifest().then(async (manifest) => {
      const url = manifest.urls[String(pageNumber)];
      if (!url) throw new Error("لا توجد بيانات تفسير لهذه الصفحة.");
      const response = await fetch(url);
      if (!response.ok) throw new Error("تعذر تحميل بيانات التفسير لهذه الصفحة.");
      const data = await response.json() as QuranStudyPage;
      if (!validateQuranStudyPage(data, pageNumber)) throw new Error("بيانات تفسير الصفحة غير صالحة.");
      return data;
    }));
  }
  return pagePromises.get(pageNumber)!;
}
