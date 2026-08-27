export interface QuranNavigationPoint {
  number: number;
  page: number;
  surah: number;
  ayah: number;
}

export interface QuranNavigationData {
  source: string;
  juz: QuranNavigationPoint[];
  hizbs: QuranNavigationPoint[];
}

export function validateQuranNavigationData(data: QuranNavigationData) {
  const validPoint = (point: QuranNavigationPoint) => Number.isInteger(point.number) && Number.isInteger(point.page) && point.page >= 1 && point.page <= 604 && Number.isInteger(point.surah) && point.surah >= 1 && point.surah <= 114 && Number.isInteger(point.ayah) && point.ayah >= 1;
  return data.juz.length === 30 && data.hizbs.length === 60 && data.juz.every(validPoint) && data.hizbs.every(validPoint) && data.juz.every((point, index) => point.number === index + 1) && data.hizbs.every((point, index) => point.number === index + 1);
}
