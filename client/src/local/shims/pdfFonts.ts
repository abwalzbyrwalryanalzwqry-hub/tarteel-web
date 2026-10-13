/** نسخة الجهاز: خطوط Amiri (العربية واللاتينية مدمجتان) مضمّنة في التطبيق وتُحمَّل كبيانات عند أول تصدير PDF. */
import regularUrl from "../../../../server/export/fonts/TarteelAmiri-Regular.woff?url";
import boldUrl from "../../../../server/export/fonts/TarteelAmiri-Bold.woff?url";
import type { ArabicPdfFonts } from "../../../../server/export/pdfFonts";

export type { ArabicPdfFonts };

let cached: Promise<ArabicPdfFonts> | null = null;

async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("تعذر تحميل خط PDF");
  return Buffer.from(await response.arrayBuffer());
}

export function loadArabicPdfFonts(): Promise<ArabicPdfFonts> {
  cached ??= Promise.all([bytes(regularUrl), bytes(boldUrl)]).then(
    ([regular, bold]) => ({ regular, bold })
  );
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
