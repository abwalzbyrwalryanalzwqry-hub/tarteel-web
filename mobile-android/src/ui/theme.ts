import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

export type AppPalette = {
  background: string;
  surface: string;
  primary: string;
  gold: string;
  /** برتقالي ترتيل لنص وأيقونات المصحف (تباين ≥ ٤٫٥:١ على الخلفية). */
  orange: string;
  muted: string;
  subtle: string;
  border: string;
  soft: string;
  danger: string;
  /** خلفية الزر الأساسي ونصه: كان نصاً أبيض على ذهبي فاتح (٢٫٣:١)، والآن ≥ ٤٫٥:١ في الوضعين. */
  buttonBackground: string;
  buttonText: string;
  /** ألوان الشريط السفلي. */
  tabActive: string;
  tabInactive: string;
  dark: boolean;
};

export const lightColors: AppPalette = {
  background: "#F6F3EA",
  surface: "#FFFFFF",
  primary: "#123D2A",
  gold: "#E89B00",
  orange: "#A85700",
  muted: "#5D665E",
  subtle: "#6B746C",
  border: "#D7DDCF",
  soft: "#EEF4E8",
  danger: "#B42318",
  buttonBackground: "#A85700",
  buttonText: "#FFFFFF",
  tabActive: "#123D2A",
  tabInactive: "#6B746C",
  dark: false,
};

/** كحلي ترتيل الداكن نفسه في المنصة (index.css ← .dark)، حتى لا يظهر شريط فاتح تحت واجهة داكنة. */
export const darkColors: AppPalette = {
  background: "#000710",
  surface: "#06121D",
  primary: "#5FCB8E",
  gold: "#F2B23E",
  orange: "#F29A1E",
  muted: "#A3B2BF",
  subtle: "#8696A3",
  border: "#1E2D3A",
  soft: "#0B1D17",
  danger: "#FF7A70",
  buttonBackground: "#F2B23E",
  buttonText: "#000710",
  tabActive: "#F2B23E",
  tabInactive: "#8696A3",
  dark: true,
};

/** للتوافق مع الشيفرة القديمة والاختبارات: لوحة الوضع الفاتح. */
export const colors = lightColors;

const STORAGE_KEY = "tarteel.appearance.dark";

/**
 * وضع التطبيق (فاتح/داكن) تابع لاختيار المستخدم داخل المنصة: الصفحة ترسل {type:"theme"} عبر الجسر
 * عند كل تحميل وتغيير، فيتلون شريط التبويبات وشريط الحالة وشاشات التحميل بالسمة نفسها.
 * قبل أول رسالة: آخر قيمة محفوظة، وإلا إعداد الجهاز.
 */
let isDark = Appearance.getColorScheme() === "dark";
const listeners = new Set<() => void>();

void SecureStore.getItemAsync(STORAGE_KEY)
  .then((saved) => {
    if (saved === "1" || saved === "0") setAppDark(saved === "1", false);
  })
  .catch(() => undefined);

export function setAppDark(dark: boolean, persist = true) {
  if (persist) void SecureStore.setItemAsync(STORAGE_KEY, dark ? "1" : "0").catch(() => undefined);
  if (dark === isDark) return;
  isDark = dark;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** لوحة الألوان الحالية، وتُعيد الرسم عند تغيّر السمة. */
export function useAppColors(): AppPalette {
  const dark = useSyncExternalStore(subscribe, () => isDark, () => isDark);
  return dark ? darkColors : lightColors;
}
