import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ArabicReshaper = require("arabic-reshaper") as { convertArabic: (value: string) => string };

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
 * يرسم PDFKit المحارف بالترتيب المادي من اليسار إلى اليمين ولا يطبق خوارزمية
 * الاتجاه الثنائي. لذلك تُشكل كل كلمة عربية أولاً، ثم يعكس ترتيب الكلمات فقط
 * داخل السطر؛ فلا تنقلب حروف الكلمة ولا يتغير ترتيب الأرقام داخلها.
 */
export function toArabicPdfText(value: string | number | null | undefined, limit?: number): string {
  const source = limit ? truncatePdfValue(value, limit) : normalizePdfValue(value);
  const logicalText = source
    .replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit)
    .replace(/[—–]/g, " ")
    .replace(/[•·]/g, "؛")
    .replace(/%/g, "٪")
    .replace(/[\\/]/g, " ");
  return logicalText
    .split(/(\s+)/)
    .reverse()
    .map((token) => ArabicReshaper.convertArabic(token))
    .join("");
}

export function isArabicPdfVisualText(value: string): boolean {
  return /[\uFE70-\uFEFF]/.test(value);
}
