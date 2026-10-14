/**
 * ربط مزامنة حالة القراءة (reading-sync.ts من زِن كما هو) بحساب ترتيل:
 *  - الطرف البعيد هو quranReadingState.sync على خادم ترتيل بدل sync_quran_state في Supabase.
 *  - العلامات المنقولة من قسم المصحف السابق (legacy) تُكمَّل هنا: نص الآية وصفحتها وجزؤها، وعلامة
 *    الصفحة تصير علامة على أول آية فيها، وتُدمج المكرّرة مع الإبقاء على الملاحظات.
 *  - البيانات الشخصية على الجهاز تخصّ حساباً واحداً: إن دخل حساب آخر على الجهاز نفسه تُمسح أولاً.
 */
import { mushafApi } from "@/mushaf/compat/api";
import { PAGE_STARTS } from "@/mushaf/lib/quran/structure-data";
import { pageOf } from "@/mushaf/lib/quran/page-math";
import { quranTextService } from "@/mushaf/lib/quran/text-service";
import type { Bookmark } from "@/mushaf/lib/quran/bookmarks";
import {
  SYNC_FIELDS,
  SYNC_META_KEY,
  startReadingSync,
  type SyncRpc,
} from "@/mushaf/lib/quran/reading-sync";

const OWNER_KEY = "tarteel.quran.owner";
const PERSONAL_KEYS = [
  SYNC_FIELDS.bookmarks.key,
  SYNC_FIELDS.khatmah.key,
  SYNC_FIELDS.history.key,
  SYNC_META_KEY,
  "zen.review.outbox.v1",
  "zen.quran.activity.v1",
  "zen.quran.reader.v1",
];

/** يمسح بيانات حساب سابق على هذا الجهاز قبل بدء مزامنة الحساب الحالي. */
export function claimDevice(
  userId: string,
  store: Storage = localStorage
): void {
  try {
    const owner = store.getItem(OWNER_KEY);
    if (owner !== userId) {
      if (owner !== null)
        for (const key of PERSONAL_KEYS) store.removeItem(key);
      store.setItem(OWNER_KEY, userId);
    }
  } catch {
    /* التخزين غير متاح: لا شيء يُمسح */
  }
}

const rpc: SyncRpc = async args => {
  const input: Record<string, unknown> = {};
  for (const field of Object.keys(SYNC_FIELDS)) {
    if (`_${field}` in args) input[field] = args[`_${field}`];
    if (`_${field}_at` in args) input[`${field}At`] = args[`_${field}_at`];
  }
  return mushafApi().quranReadingState.sync.mutate(input);
};

type LegacyBookmark = Partial<Bookmark> & {
  legacy?: boolean;
  note?: string | null;
};

/** يكمّل علامة منقولة: الآية والصفحة والجزء والنص. يعيد null إن تعذّر تحديد آيتها. */
async function repairOne(item: LegacyBookmark): Promise<Bookmark | null> {
  let surah = Number(item.surah) || 0;
  let ayah = Number(item.ayah) || 0;
  if (!surah || !ayah) {
    const start = PAGE_STARTS[(Number(item.page) || 0) - 1];
    if (!start) return null;
    [surah, ayah] = start;
  }
  const text = await quranTextService.loadSurah(surah).catch(() => null);
  const verse = text?.ayahs.find(a => a.n === ayah);
  if (text && !verse) return null;
  const note =
    typeof item.note === "string" && item.note.trim()
      ? item.note.trim()
      : undefined;
  return {
    id: `${surah}:${ayah}`,
    surah,
    ayah,
    page: verse?.p ?? pageOf(surah, ayah),
    juz: verse?.j ?? 0,
    text: verse?.t ?? "",
    ...(note ? { note } : {}),
    tag: item.tag ?? "tadabbur",
    createdAt: Number(item.createdAt) || Date.now(),
  };
}

/** يكمّل العلامات المنقولة على الجهاز ثم يعلن التغيير فترفعها المزامنة مكتملةً. */
export async function repairLegacyBookmarks(
  store: Storage = localStorage
): Promise<boolean> {
  const key = SYNC_FIELDS.bookmarks.key;
  let list: LegacyBookmark[];
  try {
    const parsed: unknown = JSON.parse(store.getItem(key) ?? "[]");
    list = Array.isArray(parsed) ? (parsed as LegacyBookmark[]) : [];
  } catch {
    return false;
  }
  if (!list.some(b => b?.legacy)) return false;
  const byId = new Map<string, Bookmark>();
  for (const item of list) {
    const fixed = item?.legacy ? await repairOne(item) : (item as Bookmark);
    if (!fixed?.id) continue;
    const prev = byId.get(fixed.id);
    if (!prev) {
      byId.set(fixed.id, fixed);
      continue;
    }
    const notes = [prev.note, fixed.note].filter((n): n is string => !!n);
    byId.set(fixed.id, {
      ...prev,
      ...(notes.length ? { note: [...new Set(notes)].join("\n") } : {}),
      createdAt: Math.max(prev.createdAt, fixed.createdAt),
    });
  }
  const next = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  store.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new Event(SYNC_FIELDS.bookmarks.event));
  return true;
}

/** يبدأ مزامنة حالة القراءة لحساب ترتيل الحالي، ويعيد دالة الإيقاف. */
export function startAccountSync(userId: string): () => void {
  claimDevice(userId);
  const stop = startReadingSync(rpc);
  const onBookmarks = () => void repairLegacyBookmarks();
  window.addEventListener(SYNC_FIELDS.bookmarks.event, onBookmarks);
  void repairLegacyBookmarks();
  return () => {
    stop();
    window.removeEventListener(SYNC_FIELDS.bookmarks.event, onBookmarks);
  };
}
