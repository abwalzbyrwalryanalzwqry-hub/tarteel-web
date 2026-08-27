import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, CalendarRange, CheckCircle2, Download, Eye, FileSpreadsheet, FileText, Printer, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CircleOption = { id: number; name: string };
type PdfPreview = { url: string; filename: string; blob: Blob };
type FilePreview = { filename: string; blob: Blob };

const formatNumber = (value: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 1 }).format(value);

export function ExecutiveCircleReport({ circles }: { circles: CircleOption[] }) {
  const [circleId, setCircleId] = useState<number | null>(null);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [previewRequested, setPreviewRequested] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [excelPreview, setExcelPreview] = useState<FilePreview | null>(null);
  const input = useMemo(() => ({ circleId: circleId ?? 0, period, startDate: start ? new Date(`${start}T00:00:00`) : undefined, endDate: end ? new Date(`${end}T23:59:59`) : undefined }), [circleId, period, start, end]);
  const report = trpc.reporting.executive.useQuery(input, { enabled: Boolean(circleId) && previewRequested });
  const resetPreview = () => { setPreviewRequested(false); setPdfPreview(null); setExcelPreview(null); };
  const requestPreview = () => {
    if (!circleId) { toast.error("اختر الحلقة أولاً ثم اطلب المعاينة."); return; }
    setPreviewRequested(true);
    window.setTimeout(() => { void report.refetch(); }, 0);
  };
  const refresh = () => {
    if (!circleId) { toast.error("اختر الحلقة أولاً ثم اطلب المعاينة."); return; }
    if (!previewRequested) { requestPreview(); return; }
    void report.refetch();
  };
  useEffect(() => () => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); }, [pdfPreview?.url]);
  const fileFromResult = (result: { data: string; filename: string; contentType: string }): FilePreview => {
    const bytes = Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0));
    return { blob: new Blob([bytes], { type: result.contentType }), filename: result.filename };
  };
  const download = (file: FilePreview) => { const url = URL.createObjectURL(file.blob); const link = document.createElement("a"); link.href = url; link.download = file.filename; link.click(); URL.revokeObjectURL(url); };
  const share = async (file: FilePreview) => {
    const shareFile = new File([file.blob], file.filename, { type: file.blob.type });
    const shareData = { title: "تقرير ترتيل التنفيذي", text: report.data ? `التقرير التنفيذي — ${report.data.meta.circleName}` : "تقرير ترتيل التنفيذي", files: [shareFile] };
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) { try { await navigator.share(shareData); } catch { /* ألغى المستخدم المشاركة. */ } }
    else { download(file); toast.info("لا يدعم المتصفح مشاركة الملف مباشرة؛ تم تنزيله لمشاركته بالتطبيق المناسب."); }
  };
  const exportPdf = trpc.reporting.exportExecutivePdf.useMutation({
    onSuccess: (result) => {
      const file = fileFromResult(result); setPdfPreview((current) => { if (current?.url) URL.revokeObjectURL(current.url); return { ...file, url: URL.createObjectURL(file.blob) }; }); toast.success("تطابق ملف PDF مع معاينة التقرير الحية.");
    }, onError: (error) => toast.error(error.message),
  });
  const exportExcel = trpc.reporting.exportExecutiveExcel.useMutation({ onSuccess: (result) => { setExcelPreview(fileFromResult(result)); toast.success("تطابق ملف Excel مع معاينة التقرير الحية."); }, onError: (error) => toast.error(error.message) });
  const metrics = report.data ? [
    { label: "الفترات المعتمدة", value: report.data.summary.sessions, tone: "text-foreground" },
    { label: "نسبة الحضور", value: `${report.data.summary.attendanceRate}%`, tone: "text-emerald-700" },
    { label: "سجلات الحفظ", value: report.data.summary.memorizationEntries, tone: "text-primary" },
    { label: "سجلات المراجعة", value: report.data.summary.revisionEntries, tone: "text-amber-700" },
  ] : [];

  return <section className="space-y-4" dir="rtl">
    <div className="glass-card rounded-3xl p-5 sm:p-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BarChart3 className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-bold text-foreground">لوحة التقرير التنفيذي للحلقة</h2><p className="mt-1 text-sm text-muted-foreground">حدد النطاق، ثم عاين البيانات الحية قبل إنشاء أي ملف.</p></div></div>{report.data && <button onClick={() => window.print()} className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"><Printer className="ml-1 inline h-4 w-4 text-primary" />طباعة المعاينة</button>}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="block text-sm font-medium text-foreground"><span className="mb-1.5 block">الحلقة</span><select value={circleId ?? ""} onChange={(event) => { setCircleId(event.target.value ? Number(event.target.value) : null); resetPreview(); }} className="tarteel-input"><option value="">اختر الحلقة</option>{circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-foreground"><span className="mb-1.5 block">دورية الملخص</span><select value={period} onChange={(event) => { setPeriod(event.target.value as "weekly" | "monthly"); resetPreview(); }} className="tarteel-input"><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select></label>
        <label className="block text-sm font-medium text-foreground"><span className="mb-1.5 block">من تاريخ <span className="text-muted-foreground">(اختياري)</span></span><input type="date" value={start} onChange={(event) => { setStart(event.target.value); resetPreview(); }} className="tarteel-input" /></label>
        <label className="block text-sm font-medium text-foreground"><span className="mb-1.5 block">إلى تاريخ <span className="text-muted-foreground">(اختياري)</span></span><input type="date" value={end} onChange={(event) => { setEnd(event.target.value); resetPreview(); }} className="tarteel-input" /></label>
        <div className="flex items-end"><button onClick={requestPreview} disabled={report.isFetching} className="btn-gold w-full py-2.5 text-sm"><Eye className="ml-1 inline h-4 w-4" />{report.isFetching ? "جارٍ تجهيز المعاينة…" : "معاينة قبل التصدير"}</button></div>
      </div>
      {circleId && !previewRequested && <p className="mt-4 rounded-xl border border-dashed border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-6 text-muted-foreground">لن ينشأ ملف قبل طلب المعاينة. عند تغيير الحلقة أو الدورية أو التاريخ، تُطلب معاينة جديدة لضمان أن البيانات والملف متطابقان.</p>}
    </div>
    {!circleId && <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-6 text-center text-sm text-muted-foreground"><CalendarRange className="mx-auto mb-2 h-6 w-6 text-primary" />اختر حلقة لعرض تقريرها التنفيذي.</div>}
    {previewRequested && report.isLoading && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-28 rounded-2xl" />)}</div>}
    {previewRequested && report.error && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{report.error.message}</div>}
    {report.data && <article className="space-y-4 print:space-y-5" aria-live="polite">
      <header className="hidden print:block"><h1 className="font-display text-2xl font-bold">التقرير التنفيذي — {report.data.meta.circleName}</h1><p className="mt-1 text-sm">{report.data.meta.period === "weekly" ? "ملخص أسبوعي" : "ملخص شهري"} · {report.data.meta.startDate.toLocaleDateString("ar-SA")} — {report.data.meta.endDate.toLocaleDateString("ar-SA")}</p></header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 print:hidden"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-display text-base font-bold text-foreground">معاينة حية جاهزة للتصدير</h3><p className="mt-0.5 text-xs text-muted-foreground">راجع الملخص والجدول أدناه؛ سيستخدم التصدير النطاق والبيانات نفسيهما.</p></div></div><button onClick={refresh} disabled={report.isFetching} className="rounded-xl border border-primary/25 bg-background px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"><RefreshCw className={`ml-1 inline h-4 w-4 ${report.isFetching ? "animate-spin" : ""}`} />تحديث المعاينة</button></div>
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 print:hidden"><div><h3 className="font-display text-lg font-bold text-foreground">تصدير ومشاركة الملف</h3><p className="mt-1 text-sm text-muted-foreground">بعد مراجعة المعاينة، جهّز نسخة PDF أو Excel المطابقة لها.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => exportPdf.mutate(input)} disabled={exportPdf.isPending} className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"><FileText className="ml-1 inline h-4 w-4" />{exportPdf.isPending ? "جارٍ التجهيز…" : "تجهيز PDF"}</button><button onClick={() => exportExcel.mutate(input)} disabled={exportExcel.isPending} className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-600/10"><FileSpreadsheet className="ml-1 inline h-4 w-4" />{exportExcel.isPending ? "جارٍ التجهيز…" : "تجهيز Excel"}</button></div></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="glass-card rounded-2xl p-4"><p className="text-xs text-muted-foreground">{metric.label}</p><p className={`mt-2 font-display text-3xl font-bold ${metric.tone}`}>{metric.value}</p></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><div className="glass-card rounded-2xl p-5"><div className="flex items-center justify-between"><div><h3 className="font-display text-lg font-bold text-foreground">الحضور والغياب</h3><p className="mt-1 text-xs text-muted-foreground">يُحسب من آخر حالة محفوظة لكل طالب داخل الفترة.</p></div><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-700">{report.data.summary.attendanceRate}% حضور</span></div><div className="mt-5 grid grid-cols-4 gap-2 text-center">{[{ label: "حاضر", value: report.data.summary.present, tone: "text-emerald-700" }, { label: "غائب", value: report.data.summary.absent, tone: "text-destructive" }, { label: "مستأذن", value: report.data.summary.excused, tone: "text-primary" }, { label: "متأخر", value: report.data.summary.late, tone: "text-amber-700" }].map((item) => <div key={item.label} className="rounded-xl bg-muted/45 px-2 py-3"><p className={`font-display text-xl font-bold ${item.tone}`}>{item.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p></div>)}</div></div><div className="glass-card rounded-2xl p-5"><h3 className="font-display text-lg font-bold text-foreground">الحفظ والمراجعة</h3><div className="mt-5 space-y-3"><SummaryLine label="صفحات الحفظ" value={formatNumber(report.data.summary.memorizedPages)} tone="bg-primary" /><SummaryLine label="صفحات المراجعة" value={formatNumber(report.data.summary.reviewedPages)} tone="bg-amber-500" /><SummaryLine label="الفترات المعتمدة" value={String(report.data.summary.sessions)} tone="bg-emerald-600" /></div></div></div>
      <section className="glass-card overflow-hidden rounded-2xl"><div className="border-b border-border p-5"><h3 className="font-display text-lg font-bold text-foreground">تفصيل {report.data.meta.period === "weekly" ? "الأسابيع" : "الأشهر"}</h3></div>{report.data.buckets.length ? <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-right text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-3">الفترة الزمنية</th><th className="p-3">فترات</th><th className="p-3">حضور</th><th className="p-3">غياب</th><th className="p-3">حفظ</th><th className="p-3">مراجعة</th><th className="p-3">صفحات حفظ</th><th className="p-3">صفحات مراجعة</th></tr></thead><tbody>{report.data.buckets.map((bucket) => <tr key={bucket.key} className="border-t border-border/60"><td className="p-3 font-medium text-foreground">{bucket.label}</td><td className="p-3">{bucket.sessions}</td><td className="p-3 text-emerald-700">{bucket.present}</td><td className="p-3 text-destructive">{bucket.absent}</td><td className="p-3 text-primary">{bucket.memorizationEntries}</td><td className="p-3 text-amber-700">{bucket.revisionEntries}</td><td className="p-3">{formatNumber(bucket.memorizedPages)}</td><td className="p-3">{formatNumber(bucket.reviewedPages)}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-muted-foreground">لا توجد فترات معتمدة ضمن النطاق المحدد بعد.</div>}</section>
    </article>}
    <Dialog open={Boolean(pdfPreview)} onOpenChange={(open) => !open && setPdfPreview(null)}><DialogContent className="flex h-[88vh] max-w-5xl flex-col overflow-hidden p-0" dir="rtl"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle className="font-display">معاينة ملف PDF</DialogTitle><DialogDescription>{pdfPreview?.filename}</DialogDescription></DialogHeader>{pdfPreview && <><iframe title="معاينة التقرير التنفيذي PDF" src={pdfPreview.url} className="min-h-0 w-full flex-1" /><div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3"><button onClick={() => download(pdfPreview)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="ml-1 inline h-4 w-4" />تنزيل PDF</button><button onClick={() => share(pdfPreview)} className="btn-gold px-3 py-2 text-sm"><Send className="ml-1 inline h-4 w-4" />مشاركة</button></div></>}</DialogContent></Dialog>
    <Dialog open={Boolean(excelPreview)} onOpenChange={(open) => !open && setExcelPreview(null)}><DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto" dir="rtl"><DialogHeader><DialogTitle className="font-display">معاينة ملف Excel</DialogTitle><DialogDescription>{excelPreview?.filename} — تعرض المعاينة محتوى ورقتي الملخص والتفصيل كما سيظهر في الملف.</DialogDescription></DialogHeader>{report.data && <div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{metric.label}</p><p className={`mt-1 font-bold ${metric.tone}`}>{metric.value}</p></div>)}</div><div className="overflow-x-auto rounded-2xl border border-border"><table className="min-w-[760px] w-full text-right text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-3">الفترة الزمنية</th><th className="p-3">الفترات</th><th className="p-3">حضور</th><th className="p-3">غياب</th><th className="p-3">حفظ</th><th className="p-3">مراجعة</th><th className="p-3">صفحات حفظ</th><th className="p-3">صفحات مراجعة</th></tr></thead><tbody>{report.data.buckets.map((bucket) => <tr key={bucket.key} className="border-t border-border/60"><td className="p-3">{bucket.label}</td><td className="p-3">{bucket.sessions}</td><td className="p-3">{bucket.present}</td><td className="p-3">{bucket.absent}</td><td className="p-3">{bucket.memorizationEntries}</td><td className="p-3">{bucket.revisionEntries}</td><td className="p-3">{formatNumber(bucket.memorizedPages)}</td><td className="p-3">{formatNumber(bucket.reviewedPages)}</td></tr>)}</tbody></table></div></div>}<div className="flex flex-wrap justify-end gap-2"><button onClick={() => excelPreview && download(excelPreview)} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"><Download className="ml-1 inline h-4 w-4" />تنزيل Excel</button><button onClick={() => excelPreview && share(excelPreview)} className="btn-gold px-3 py-2 text-sm"><Send className="ml-1 inline h-4 w-4" />مشاركة</button></div></DialogContent></Dialog>
  </section>;
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone: string }) { return <div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><strong className="text-foreground">{value}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full w-3/4 rounded-full ${tone}`} /></div></div>; }
