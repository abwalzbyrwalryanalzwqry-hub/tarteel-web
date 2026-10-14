import { createFileRoute, Link } from "@/mushaf/compat/router";
import { useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "@/mushaf/components/zen/PhoneFrame";
import { BackButton } from "@/mushaf/components/zen/BackButton";
import {
  BookOpenCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  X,
  Search,
} from "lucide-react";
import {
  MushafPage,
  PageNumberPlate,
} from "@/mushaf/components/zen/MushafPage";
import { useMushafPage } from "@/mushaf/hooks/useMushafPage";
import {
  MUSHAF_TOTAL_PAGES,
  juzOfPage,
  hizbOfPage,
  surahsOnPage,
} from "@/mushaf/lib/mushaf15";
import { SURAHS } from "@/mushaf/lib/quran-meta";
import { PAGE_STARTS } from "@/mushaf/lib/quran/structure-data";
import {
  ayahAtOrdinal,
  ayahOrdinal,
  ayahsOnPage,
} from "@/mushaf/lib/quran/page-math";
import { intlLocale } from "@/mushaf/lib/i18n";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { GRADE_LABELS, type Grade } from "../../../../shared/types";

/** أنواع التسجيل في ترتيل: الحفظ والمراجعة (جدولا memorization وrevision). */
type RecordKind = "memorize" | "review";
const KIND_LABEL: Record<RecordKind, string> = {
  memorize: "حفظ",
  review: "مراجعة",
};
const GRADES = Object.keys(GRADE_LABELS) as Grade[];

/** مدى الصفحة كاملاً: من أول آية فيها إلى آخر آية. */
function pageRange(page: number) {
  const [fromSurah, fromAyah] = PAGE_STARTS[page - 1] ?? [1, 1];
  const end = ayahAtOrdinal(
    ayahOrdinal(fromSurah, fromAyah) + ayahsOnPage(page) - 1
  );
  return { fromSurah, fromAyah, toSurah: end.surah, toAyah: end.ayah };
}

/**
 * سجل الحفظ والمراجعة لكل صفحة من المصحف (من زِن، مربوطاً ببيانات ترتيل):
 * يرى كل حساب تسجيلات الطلاب الذين يحق له رؤيتهم (المعلّم طلاب حلقاته، والمدير طلاب مركزه، وولي الأمر
 * أبناءه، والطالب نفسه) في الفترات التي تشمل الصفحة، ومن يدير الفترات يسجّل حفظ الصفحة أو مراجعتها
 * في فترة من فترات حلقة الطالب بتقديرات ترتيل. القراءة نفسها في قارئ المصحف (/quran/read).
 */
export const Route = createFileRoute("/_authed/mushaf/records")({
  head: () => ({
    meta: [
      { title: "سجل الحفظ — Zen" },
      {
        name: "description",
        content:
          "سجّل الحفظ والمراجعة اليومية لكل طالب على صفحات مصحف المدينة ٦٠٤.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    const n = Number(search.page);
    return {
      page:
        Number.isFinite(n) && n >= 1 && n <= 604 ? Math.floor(n) : undefined,
    };
  },
  component: MushafScreen,
});

const TOTAL_PAGES = MUSHAF_TOTAL_PAGES;
const LAST_PAGE_KEY = "zen-mushaf-page";

function MushafScreen() {
  const search = Route.useSearch();
  // الصفحة من الرابط، وإلا آخر صفحة محفوظة — عند أول عرض لا في أثر (M12).
  const [page, setPage] = useState(() => {
    if (search.page) return search.page;
    const saved = Number(localStorage.getItem(LAST_PAGE_KEY));
    return saved >= 1 && saved <= TOTAL_PAGES ? saved : 1;
  });
  const [reloadKey, setReloadKey] = useState(0);
  const pageState = useMushafPage(page, reloadKey);
  const surahNames =
    pageState.status === "ready"
      ? surahsOnPage(pageState.data)
          .map(n => SURAHS[n - 1]?.name)
          .filter(Boolean)
          .join("، ")
      : "";
  const { can, role } = usePermissions();
  const teacher = can("sessions:manage");
  const self = role === "student";
  const range = useMemo(() => pageRange(page), [page]);
  const recordsQ = trpc.quranRecords.byRange.useQuery(range, {
    placeholderData: prev => prev,
  });
  const records = recordsQ.data ?? [];
  const loading = recordsQ.isLoading;
  const utils = trpc.useUtils();
  const refresh = () => utils.quranRecords.byRange.invalidate();
  const [showSheet, setShowSheet] = useState(false);
  const [jump, setJump] = useState("");

  useEffect(() => {
    localStorage.setItem(LAST_PAGE_KEY, String(page));
  }, [page]);

  const go = (p: number) => setPage(Math.min(TOTAL_PAGES, Math.max(1, p)));

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col">
        <header className="px-5 pt-12 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallback="/mushaf" />
            <div>
              <h1 className="text-2xl font-black text-foreground">سجل الحفظ</h1>
              <p className="text-xs text-muted-foreground mt-1">
                صفحة {page} من {TOTAL_PAGES}، الجزء {juzOfPage(page)}، الحزب{" "}
                {hizbOfPage(page)}
              </p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center glow-primary">
            <BookOpenCheck className="w-5 h-5 text-white" />
          </div>
        </header>

        {/* Jump bar */}
        <div className="px-5">
          <div className="glass rounded-2xl h-11 flex items-center px-3 gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={jump}
              onChange={e => setJump(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => {
                if (e.key === "Enter" && jump) {
                  go(Number(jump));
                  setJump("");
                }
              }}
              inputMode="numeric"
              placeholder="انتقل إلى صفحة (١–٦٠٤)…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button
              onClick={() => {
                if (jump) {
                  go(Number(jump));
                  setJump("");
                }
              }}
              className="text-[0.6875rem] px-3 py-1 rounded-full bg-primary/15 text-primary font-medium"
            >
              انتقال
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 mt-3 pb-4 space-y-3">
          {/* الصفحة: مصحف المدينة ١٥ سطراً، نصّاً بخط مجمع الملك فهد */}
          <div className="mx-2 rounded-3xl bg-mushaf-paper border border-gold/30 shadow-lg px-3 pt-3 pb-2">
            {surahNames && (
              <div className="flex items-center justify-between pb-2 text-[0.6875rem] text-[#6b5a36]">
                <span className="truncate">{surahNames}</span>
                <span className="shrink-0">الجزء {juzOfPage(page)}</span>
              </div>
            )}
            <MushafPage
              page={page}
              state={pageState}
              onRetry={() => setReloadKey(k => k + 1)}
            />
            {pageState.status === "ready" && (
              <div className="pt-2">
                <PageNumberPlate page={page} />
              </div>
            )}
          </div>

          {/* Pager */}
          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => go(page + 1)}
              disabled={page >= TOTAL_PAGES}
              className="flex-1 glass rounded-2xl py-2.5 flex items-center justify-center gap-1 text-xs font-medium disabled:opacity-60"
            >
              <ChevronRight className="w-4 h-4" /> السابقة
            </button>
            <span className="glass rounded-2xl px-4 py-2.5 text-xs font-black text-primary">
              {page}
            </span>
            <button
              onClick={() => go(page - 1)}
              disabled={page <= 1}
              className="flex-1 glass rounded-2xl py-2.5 flex items-center justify-center gap-1 text-xs font-medium disabled:opacity-60"
            >
              التالية <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/mushaf/read"
            search={{ page, mode: "mushaf" }}
            className="mx-2 w-[calc(100%-1rem)] glass rounded-2xl text-sm font-medium py-3 flex items-center justify-center gap-2 text-primary"
          >
            <BookOpenCheck className="w-4 h-4" /> افتح الصفحة في قارئ المصحف
          </Link>

          {teacher && (
            <button
              onClick={() => setShowSheet(true)}
              className="mx-2 w-[calc(100%-1rem)] rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-white text-sm font-medium py-3 flex items-center justify-center gap-2 glow-primary"
            >
              <Plus className="w-4 h-4" /> تسجيل حفظ / مراجعة لهذه الصفحة
            </button>
          )}

          {/* Records */}
          {
            <div className="px-2">
              <p className="text-sm font-medium text-foreground mb-2">
                سجلات الصفحة {page}
              </p>
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : records.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  لا توجد تسجيلات لهذه الصفحة بعد.
                </p>
              ) : (
                <div className="space-y-2">
                  {records.map(r => (
                    <div
                      key={`${r.kind}:${r.id}`}
                      className="glass rounded-2xl p-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {self ? "تسجيلي" : r.studentName}
                          </p>
                          <p className="text-[0.625rem] text-muted-foreground">
                            {KIND_LABEL[r.kind]}،{" "}
                            {SURAHS[r.surahNumber - 1]?.name} {r.fromAyah}
                            {r.toSurahNumber &&
                            r.toSurahNumber !== r.surahNumber
                              ? ` – ${SURAHS[r.toSurahNumber - 1]?.name} ${r.toAyah}`
                              : `–${r.toAyah}`}
                            ،{" "}
                            {new Date(r.scheduledAt).toLocaleDateString(
                              intlLocale()
                            )}
                          </p>
                        </div>
                        {r.grade && (
                          <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.625rem] font-bold text-gold-ink">
                            {GRADE_LABELS[r.grade]}
                          </span>
                        )}
                      </div>
                      {r.notes && (
                        <p className="text-[0.6875rem] text-muted-foreground mt-1">
                          {r.notes}
                        </p>
                      )}
                      {teacher && (
                        <a
                          href={`/periods/${r.sessionId}`}
                          className="mt-1.5 inline-block text-[0.625rem] font-medium text-primary"
                        >
                          فتح الفترة
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        </div>

        {showSheet && teacher && (
          <RecordSheet
            page={page}
            onClose={() => setShowSheet(false)}
            onSaved={() => {
              setShowSheet(false);
              void refresh();
            }}
          />
        )}
      </div>
    </PhoneFrame>
  );
}

function RecordSheet({
  page,
  onClose,
  onSaved,
}: {
  page: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const studentsQ = trpc.students.list.useQuery({});
  const students = studentsQ.data ?? [];
  const [studentId, setStudentId] = useState(0);
  const student = students.find(s => s.id === studentId) ?? students[0];
  const circleId = student?.circleId ?? 0;
  const sessionsQ = trpc.sessions.list.useQuery(
    { circleId, includeDrafts: true },
    { enabled: circleId > 0 }
  );
  const periods = useMemo(
    () =>
      (sessionsQ.data ?? [])
        .filter(p => p.status !== "cancelled")
        .sort(
          (a, b) =>
            new Date(b.scheduledAt).getTime() -
            new Date(a.scheduledAt).getTime()
        )
        .slice(0, 30),
    [sessionsQ.data]
  );
  const [sessionId, setSessionId] = useState(0);
  const period = periods.find(p => p.id === sessionId) ?? periods[0];
  const [kind, setKind] = useState<RecordKind>("memorize");
  const [grade, setGrade] = useState<Grade>("good");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const done = () => {
    void utils.sessions.latestStudentProgress.invalidate();
    onSaved();
  };
  const onError = (e: { message: string }) =>
    setErr(e.message || "تعذّر الحفظ");
  const memorize = trpc.memorization.create.useMutation({
    onSuccess: done,
    onError,
  });
  const review = trpc.revision.create.useMutation({ onSuccess: done, onError });
  const saving = memorize.isPending || review.isPending;

  const save = () => {
    if (saving) return;
    if (!student) {
      setErr("اختر طالباً أولاً");
      return;
    }
    if (!period) {
      setErr("لا توجد فترة لحلقة هذا الطالب؛ أنشئ فترة أولاً من «الفترات».");
      return;
    }
    setErr(null);
    const r = pageRange(page);
    const input = {
      sessionId: period.id,
      studentId: student.id,
      surahNumber: r.fromSurah,
      toSurahNumber: r.toSurah,
      fromAyah: r.fromAyah,
      toAyah: r.toAyah,
      pages: String(page),
      grade,
      notes: notes.trim() || undefined,
    };
    if (kind === "memorize") memorize.mutate(input);
    else review.mutate(input);
  };

  return (
    <div
      className="absolute inset-0 z-30 bg-background/70 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full glass-strong rounded-t-3xl p-5 pb-6 anim-float-in max-h-[85%] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">
            تسجيل الصفحة {page}
          </h2>
          <button onClick={onClose} aria-label="إغلاق">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <label className="block text-[0.6875rem] text-muted-foreground mb-1">
          الطالب
        </label>
        <select
          value={student?.id ?? ""}
          onChange={e => {
            setStudentId(Number(e.target.value));
            setSessionId(0);
          }}
          className="w-full glass rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
        >
          {students.length === 0 && (
            <option value="">
              {studentsQ.isLoading ? "جارٍ التحميل…" : "لا يوجد طلاب في حلقاتك"}
            </option>
          )}
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="block text-[0.6875rem] text-muted-foreground mb-1">
          الفترة
        </label>
        <select
          value={period?.id ?? ""}
          onChange={e => setSessionId(Number(e.target.value))}
          className="w-full glass rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
        >
          {periods.length === 0 && (
            <option value="">
              {sessionsQ.isLoading
                ? "جارٍ التحميل…"
                : "لا توجد فترات لهذه الحلقة"}
            </option>
          )}
          {periods.map(p => (
            <option key={p.id} value={p.id}>
              {new Date(p.scheduledAt).toLocaleDateString(intlLocale())}
              {p.title ? ` — ${p.title}` : ""}
            </option>
          ))}
        </select>

        <label className="block text-[0.6875rem] text-muted-foreground mb-1">
          النوع
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(["memorize", "review"] as const).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`py-2 rounded-xl text-xs font-medium transition-colors ${kind === k ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="block text-[0.6875rem] text-muted-foreground mb-1">
          التقدير
        </label>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {GRADES.map(g => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`py-2 rounded-xl text-[0.6875rem] font-medium transition-colors ${grade === g ? "bg-gold/20 text-gold-ink border border-gold/40" : "glass text-muted-foreground"}`}
            >
              {GRADE_LABELS[g]}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="ملاحظات المعلم…"
          className="w-full glass rounded-xl px-3 py-2 text-xs outline-none resize-none mb-3"
        />

        {err && <p className="text-[0.6875rem] text-destructive mb-2">{err}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ التسجيل"}
        </button>
      </div>
    </div>
  );
}
