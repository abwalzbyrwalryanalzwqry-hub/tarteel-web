import { fileURLToPath } from "node:url";

/**
 * خطوط PDF: Amiri (رخصة OFL، انظر fonts/OFL-Amiri.txt) بعد دمج مجموعتيه العربية واللاتينية
 * في ملف واحد (scripts/build-pdf-fonts.py)، فتظهر الأرقام والرموز والأسماء اللاتينية مع العربية.
 * في نسخة الجهاز تُستبدل هذه الوحدة (client/src/local/shims/pdfFonts.ts) فتُحمَّل الخطوط كبيانات.
 */
export interface ArabicPdfFonts {
  regular: string | Uint8Array;
  bold: string | Uint8Array;
}

export async function loadArabicPdfFonts(): Promise<ArabicPdfFonts> {
  return {
    regular: fileURLToPath(
      new URL("./fonts/TarteelAmiri-Regular.woff", import.meta.url)
    ),
    bold: fileURLToPath(
      new URL("./fonts/TarteelAmiri-Bold.woff", import.meta.url)
    ),
  };
}
