import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ArabicReshaper = require("arabic-reshaper") as { convertArabic: (value: string) => string };
const bidiFactory = require("bidi-js") as () => {
  getEmbeddingLevels: (value: string, direction: "rtl" | "ltr") => unknown;
  getReorderedString: (value: string, levels: unknown) => string;
};
const bidi = bidiFactory();

export const ARABIC_PDF_PAGE = { left: 42, right: 42, top: 42, bottom: 48 };
export const ARABIC_PDF_WIDTH = 595.28 - ARABIC_PDF_PAGE.left - ARABIC_PDF_PAGE.right;

export function normalizePdfValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? "—").replace(/\s+/g, " ").trim();
  return normalized && normalized !== "—" ? normalized : "غير متاح";
}

export function truncatePdfValue(value: string | number | null | undefined, limit = 42): string {
  const normalized = normalizePdfValue(value);
  return normalized.length > limit ? `${normalized.slice(0, Math.max(1, limit - 3)).trimEnd()}...` : normalized;
}

/**
 * يعيد تسلسل العرض الذي يحتاجه PDFKit: حروف عربية مشكلة وترتيب بصري RTL
 * مع الحفاظ على الأرقام والرموز في مواضعها الصحيحة داخل النص المختلط.
 */
export function toArabicPdfText(value: string | number | null | undefined, limit?: number): string {
  const source = limit ? truncatePdfValue(value, limit) : normalizePdfValue(value);
  const logicalText = source
    .replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit)
    .replace(/[—–]/g, " ")
    .replace(/[•·]/g, "؛")
    .replace(/%/g, "٪")
    .replace(/[\\/]/g, " ");
  const shaped = ArabicReshaper.convertArabic(logicalText);
  return bidi.getReorderedString(shaped, bidi.getEmbeddingLevels(shaped, "rtl"));
}

export function isArabicPdfVisualText(value: string): boolean {
  return /[\uFE70-\uFEFF]/.test(value);
}
