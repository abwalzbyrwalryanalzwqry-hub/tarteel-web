import { Asset } from "expo-asset";
// SDK 54: الدوال القديمة في "expo-file-system" ترمي خطأ وقت التشغيل؛ يجب استيرادها من /legacy.
import * as FileSystem from "expo-file-system/legacy";

export type LocalQuranVerse = {
  surah: number;
  ayah: number;
  text: string;
};

let versesPromise: Promise<LocalQuranVerse[]> | undefined;

export function parseLocalQuran(raw: string): LocalQuranVerse[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const [surahText, ayahText, ...content] = line.split("|");
      return { surah: Number(surahText), ayah: Number(ayahText), text: content.join("|").trim() };
    })
    .filter((verse) => Number.isInteger(verse.surah) && Number.isInteger(verse.ayah) && verse.text.length > 0);
}

export async function loadLocalQuran(): Promise<LocalQuranVerse[]> {
  versesPromise ??= (async () => {
    const localQuranAsset = require("../../assets/quran/tanzil-uthmani.txt");
    const asset = Asset.fromModule(localQuranAsset);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error("تعذر فتح أصل المصحف المحلي");
    const raw = await FileSystem.readAsStringAsync(asset.localUri, { encoding: "utf8" });
    return parseLocalQuran(raw);
  })();
  return versesPromise;
}

export function searchLocalQuran(verses: LocalQuranVerse[], query: string, limit = 60): LocalQuranVerse[] {
  const normalized = query.normalize("NFD").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ٱ/g, "ا").trim();
  if (!normalized) return [];
  return verses.filter((verse) => verse.text.normalize("NFD").replace(/[\u064B-\u065F\u0670ـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ٱ/g, "ا").includes(normalized)).slice(0, limit);
}

export function versesOfSurah(verses: LocalQuranVerse[], surah: number): LocalQuranVerse[] {
  return verses.filter((verse) => verse.surah === surah);
}
