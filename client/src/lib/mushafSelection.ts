export interface MushafSelectionContext {
  token: string;
  returnPath: string;
  sessionId: number;
  studentId: number;
  kind: "memorization" | "revision";
  origin: "inline" | "dialog";
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
  pages: string;
  grade: string;
  notes: string;
  createdAt: number;
}

const STORAGE_PREFIX = "tarteel:mushaf-selection:";
const MAX_AGE_MS = 30 * 60 * 1000;

export function createMushafSelectionToken() {
  return `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

export function selectionStorageKey(token: string) {
  return `${STORAGE_PREFIX}${token}`;
}

export function saveMushafSelectionContext(context: MushafSelectionContext) {
  sessionStorage.setItem(selectionStorageKey(context.token), JSON.stringify(context));
}

export function readMushafSelectionContext(token: string | null) {
  if (!token) return null;
  const raw = sessionStorage.getItem(selectionStorageKey(token));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MushafSelectionContext;
    if (!parsed.createdAt || Date.now() - parsed.createdAt > MAX_AGE_MS) {
      sessionStorage.removeItem(selectionStorageKey(token));
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(selectionStorageKey(token));
    return null;
  }
}

export function clearMushafSelectionContext(token: string) {
  sessionStorage.removeItem(selectionStorageKey(token));
}
