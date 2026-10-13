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

/** خصائص OpenType تُمرَّر لـ PDFKit: وجودها يجعله يشكّل السطر كاملاً دفعة واحدة (لا كلمة كلمة). */
export const ARABIC_PDF_FEATURES = ["rlig", "calt", "kern"] as const;

const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN_CHAR = /[A-Za-z\u00C0-\u024F]/;
// مقطع يُقرأ من اليسار لليمين داخل سطر عربي: أرقام وكلمات لاتينية وما بينها (تاريخ، بريد، نسبة).
const LTR_RUN = /[0-9\u0660-\u0669A-Za-z\u00C0-\u024F](?:[0-9\u0660-\u0669A-Za-z\u00C0-\u024F.,:/@_+%\u066A-]*[0-9\u0660-\u0669A-Za-z\u00C0-\u024F%\u066A])?/g;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<", "«": "»", "»": "«" };

/**
 * محرك الخطوط (fontkit داخل PDFKit) يشكّل العربية بخط Amiri ويعكس السطر كله إن كان أول حرف
 * قوي فيه عربياً، لكنه لا يطبق خوارزمية الاتجاه الثنائي. لذلك يبقى النص بترتيبه المنطقي،
 * وتُعكس مسبقاً المقاطع اللاتينية والأرقام (فتعود صحيحة بعد عكس السطر) وتُقلب الأقواس.
 * يُرسم الناتج مع ARABIC_PDF_FEATURES.
 */
export function toArabicPdfText(value: string | number | null | undefined, limit?: number): string {
  const source = limit ? truncatePdfValue(value, limit) : normalizePdfValue(value);
  const logical = source
    .replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)] ?? digit)
    .replace(/%/g, "٪")
    .replace(/[•·]/g, "،")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "");
  const firstStrong = logical.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/)?.[0];
  if (!firstStrong || LATIN_CHAR.test(firstStrong) || !ARABIC_CHAR.test(firstStrong)) return logical;
  return logical
    .replace(LTR_RUN, (run) => Array.from(run).reverse().join(""))
    .replace(/[()[\]{}<>«»]/g, (bracket) => MIRROR[bracket] ?? bracket);
}

export function isArabicPdfVisualText(value: string): boolean {
  return /[\uFE70-\uFEFF]/.test(value);
}
