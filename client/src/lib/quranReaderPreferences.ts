export type ReaderPageScale = "compact" | "comfortable" | "large";
export type ReaderTextScale = "small" | "comfortable" | "large";
export type ReaderStudyFont = "sans" | "serif";

export interface QuranReaderPreferences {
  darkMode: boolean;
  keepScreenAwake: boolean;
  pageScale: ReaderPageScale;
  textScale: ReaderTextScale;
  studyFont: ReaderStudyFont;
}

export const DEFAULT_QURAN_READER_PREFERENCES: QuranReaderPreferences = {
  darkMode: false,
  keepScreenAwake: false,
  pageScale: "comfortable",
  textScale: "comfortable",
  studyFont: "sans",
};

const STORAGE_KEY = "tarteel.quran-reader-preferences.v1";

export function loadQuranReaderPreferences(): QuranReaderPreferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Partial<QuranReaderPreferences>;
    return {
      darkMode: typeof saved.darkMode === "boolean" ? saved.darkMode : DEFAULT_QURAN_READER_PREFERENCES.darkMode,
      keepScreenAwake: typeof saved.keepScreenAwake === "boolean" ? saved.keepScreenAwake : DEFAULT_QURAN_READER_PREFERENCES.keepScreenAwake,
      pageScale: ["compact", "comfortable", "large"].includes(saved.pageScale || "") ? saved.pageScale as ReaderPageScale : DEFAULT_QURAN_READER_PREFERENCES.pageScale,
      textScale: ["small", "comfortable", "large"].includes(saved.textScale || "") ? saved.textScale as ReaderTextScale : DEFAULT_QURAN_READER_PREFERENCES.textScale,
      studyFont: ["sans", "serif"].includes(saved.studyFont || "") ? saved.studyFont as ReaderStudyFont : DEFAULT_QURAN_READER_PREFERENCES.studyFont,
    };
  } catch {
    return DEFAULT_QURAN_READER_PREFERENCES;
  }
}

export function saveQuranReaderPreferences(preferences: QuranReaderPreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
