import { readFileSync } from "node:fs";

const file = new URL("../assets/quran/tanzil-uthmani.txt", import.meta.url);
const raw = readFileSync(file, "utf8");
const rows = raw.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#")).map((line, index) => {
  const [surahText, ayahText, ...textParts] = line.split("|");
  const surah = Number(surahText);
  const ayah = Number(ayahText);
  const text = textParts.join("|").trim();
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text) {
    throw new Error(`Invalid Quran row at line ${index + 1}`);
  }
  return { surah, ayah, text };
});

if (rows.length !== 6236) throw new Error(`Expected 6236 verses, found ${rows.length}`);
const surahs = new Set(rows.map((row) => row.surah));
if (surahs.size !== 114 || ![...surahs].every((surah) => surah >= 1 && surah <= 114)) {
  throw new Error(`Expected exactly 114 surahs, found ${surahs.size}`);
}
for (let surah = 1; surah <= 114; surah += 1) {
  const verses = rows.filter((row) => row.surah === surah);
  verses.forEach((row, index) => {
    if (row.ayah !== index + 1) throw new Error(`Non-sequential ayah ${surah}:${row.ayah}`);
  });
}
console.log(JSON.stringify({ verses: rows.length, surahs: surahs.size, first: rows[0], last: rows.at(-1) }, null, 2));
