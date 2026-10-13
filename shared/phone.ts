/**
 * أرقام الهاتف كمعرّف دخول: تُحفظ دائماً بصيغة دولية موحّدة (E.164) مثل ‎+967771234567،
 * حتى يدخل المستخدم بالرقم نفسه مهما كتبه: بمسافات أو شرطات، بالأرقام العربية، بـ 00 أو +،
 * أو محلياً دون رمز الدولة (يُضاف رمز الدولة الافتراضي، واليمن 967 افتراضياً).
 */

/** رمز الدولة الافتراضي للأرقام المحلية (اليمن). يغيّره الخادم بـ PHONE_DEFAULT_COUNTRY_CODE. */
export const DEFAULT_PHONE_COUNTRY_CODE = "967";

const ARABIC_INDIC = /[\u0660-\u0669]/g; // ٠-٩
const EXTENDED_ARABIC_INDIC = /[\u06F0-\u06F9]/g; // ۰-۹ (فارسي/أردو)

/** يحوّل الأرقام العربية والفارسية إلى لاتينية. */
export function toLatinDigits(value: string) {
  return value
    .replace(ARABIC_INDIC, d => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, d => String(d.charCodeAt(0) - 0x06f0));
}

/** هل يبدو النص رقم هاتف (لا بريداً)؟ يُستخدم لتمييز حقل «البريد أو رقم الهاتف». */
export function looksLikePhone(raw: string) {
  const value = toLatinDigits(raw).trim();
  return !value.includes("@") && /^\(?\s*[+\d][\d\s().-]*$/.test(value);
}

/**
 * يعيد الرقم بصيغة ‎+<رمز الدولة><الرقم> أو null إن لم يكن رقماً صالحاً.
 * القواعد: ‎+ أو 00 في البداية ⇐ رقم دولي كامل. غير ذلك ⇐ رقم محلي: يُحذف صفر الخط الأول
 * (مثل 05… في السعودية) ويُضاف رمز الدولة الافتراضي. الطول الكلي 8–15 رقماً كما في E.164.
 */
export function normalizePhone(
  raw: string,
  defaultCountryCode: string = DEFAULT_PHONE_COUNTRY_CODE
): string | null {
  if (!looksLikePhone(raw)) return null;
  const value = toLatinDigits(raw).trim();
  const digitsOnly = value.replace(/\D/g, "");
  let international: string;
  if (/^\(?\s*\+/.test(value)) international = digitsOnly;
  else if (digitsOnly.startsWith("00")) international = digitsOnly.slice(2);
  else {
    const country = defaultCountryCode.replace(/\D/g, "");
    if (!country) return null;
    const local = digitsOnly.replace(/^0+/, "");
    // رقم كُتب برمز الدولة دون + أو 00 (مثل 967771234567).
    international =
      local.startsWith(country) && local.length > 9
        ? local
        : `${country}${local}`;
  }
  if (!/^[1-9]\d{7,14}$/.test(international)) return null;
  return `+${international}`;
}
