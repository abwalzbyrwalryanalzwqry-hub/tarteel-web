import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

/** السمة المعروضة فعلاً. */
type Theme = "light" | "dark";
/** اختيار المستخدم: فاتح أو داكن أو حسب إعداد الجهاز. */
export type ThemePreference = Theme | "system";
export type FontScale = "small" | "standard" | "large";

/** المفتاح نفسه في public/theme-init.js الذي يطبّق السمة قبل أول رسم. */
const THEME_STORAGE_KEY = "theme";
/** لون شريط الحالة/المتصفح لكل سمة (يطابق خلفية الواجهة). */
const THEME_COLORS: Record<Theme, string> = { light: "#f8f5ee", dark: "#000710" };

interface ThemeContextType {
  /** السمة المعروضة الآن (بعد حلّ «حسب الجهاز»). */
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme?: () => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemePreference;
  switchable?: boolean;
}

const darkQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function readPreference(fallback: ThemePreference): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* تخزين معطّل */
  }
  return fallback;
}

const resolve = (preference: ThemePreference): Theme =>
  preference === "system" ? (darkQuery()?.matches ? "dark" : "light") : preference;

/**
 * يطبّق السمة على الصفحة: صنف .dark، وcolor-scheme لعناصر النظام (التقويم والقوائم وأشرطة التمرير)،
 * ولون الشريط. تطبيق أندرويد يراقب صنف .dark عبر الجسر فيلوّن شريطه السفلي وشريط الحالة بالسمة نفسها.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    switchable ? readPreference(defaultTheme) : defaultTheme
  );
  const [theme, setTheme] = useState<Theme>(() => resolve(preference));
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    const stored = localStorage.getItem("fontScale") as FontScale | null;
    return stored === "small" || stored === "large" || stored === "standard" ? stored : "standard";
  });

  // «حسب الجهاز»: تتبع تغيّر وضع الجهاز أثناء فتح التطبيق.
  useEffect(() => {
    setTheme(resolve(preference));
    if (preference !== "system") return;
    const query = darkQuery();
    if (!query) return;
    const onChange = () => setTheme(query.matches ? "dark" : "light");
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [preference]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // تبويبا المنصة والمصحف في التطبيق يتشاركان التخزين نفسه: تغيير السمة في أحدهما يسري في الآخر.
  useEffect(() => {
    if (!switchable) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setPreferenceState(readPreference(defaultTheme));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [switchable, defaultTheme]);

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
    localStorage.setItem("fontScale", fontScale);
  }, [fontScale]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      if (!switchable) return;
      setPreferenceState(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* تخزين معطّل */
      }
    },
    [switchable]
  );

  // زر التبديل السريع يختار عكس المعروض الآن صراحةً.
  const toggleTheme = switchable
    ? () => setPreference(theme === "dark" ? "light" : "dark")
    : undefined;

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setPreference, toggleTheme, switchable, fontScale, setFontScale }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
