import { useMemo } from "react";
import { createFileRoute } from "@/mushaf/compat/router";
import { PhoneFrame } from "@/mushaf/components/zen/PhoneFrame";
import { BackButton } from "@/mushaf/components/zen/BackButton";
import MushafRangePicker from "@/mushaf/components/zen/register/MushafRangePicker";
import { readMushafSelectionContext } from "@/mushaf/lib/mushaf-selection";
import type { QuranRange } from "@/mushaf/lib/daily-record";
import { useT } from "@/mushaf/lib/i18n";
import { ensureRegisterDict } from "@/mushaf/lib/register-i18n";

ensureRegisterDict();

/**
 * «اختيار من المصحف» لنموذج الحفظ أو المراجعة في الفترة: /quran/picker?surah&ayah&mushafToken.
 * منتقي المدى نفسه في السجل اليومي لزِن (MushafRangePicker): البداية من النموذج، ولمسة على آية النهاية
 * (أو نقرتان سريعتان) ثم يعود إلى الفترة بـ toSurah وtoAyah كما يقرؤهما نموذج الفترة.
 */
export const Route = createFileRoute("/_authed/mushaf/picker")({
  head: () => ({ meta: [{ title: "اختيار من المصحف — Zen" }] }),
  validateSearch: (
    s: Record<string, unknown>
  ): { surah: number; ayah: number; mushafToken?: string } => {
    const n = (v: unknown, d: number, max: number) => {
      const x = Math.floor(Number(v));
      return Number.isFinite(x) && x >= 1 && x <= max ? x : d;
    };
    return {
      surah: n(s.surah, 1, 114),
      ayah: n(s.ayah, 1, 286),
      mushafToken:
        typeof s.mushafToken === "string" ? s.mushafToken : undefined,
    };
  },
  component: PickerScreen,
});

function PickerScreen() {
  const t = useT();
  const { surah, ayah, mushafToken } = Route.useSearch();
  const context = useMemo(
    () => readMushafSelectionContext(mushafToken ?? null),
    [mushafToken]
  );
  const fromSurah = context?.fromSurah ?? surah;
  const fromAyah = context?.fromAyah ?? ayah;
  const back = context?.returnPath ?? "/quran";

  const onPick = (range: QuranRange) => {
    if (!context) return;
    const url = new URL(context.returnPath, window.location.origin);
    url.searchParams.set("mushafToken", context.token);
    url.searchParams.set("fromSurah", String(range.fromSurah));
    url.searchParams.set("fromAyah", String(range.fromAyah));
    url.searchParams.set("toSurah", String(range.toSurah));
    url.searchParams.set("toAyah", String(range.toAyah));
    window.location.assign(`${url.pathname}${url.search}`);
  };

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col">
        <header className="px-4 pt-12 pb-3 flex items-center gap-3">
          <BackButton fallback={back} />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black truncate">
              {t("dailyRecord.mushaf.title")}
            </h1>
            <p className="text-[0.6875rem] text-muted-foreground">
              {context
                ? context.kind === "memorization"
                  ? "مقطع الحفظ في الفترة"
                  : "مقطع المراجعة في الفترة"
                : "انتهت صلاحية الاختيار؛ ارجع إلى الفترة وافتح المصحف من جديد."}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {context && (
            <MushafRangePicker
              initial={{ fromSurah, fromAyah }}
              direction={
                context.toSurah < context.fromSurah ? "backward" : "forward"
              }
              onPick={onPick}
            />
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
