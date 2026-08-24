import { getReportExportHistory, type ReportExportHistoryItem } from "../../../shared/reportHistory";
import { Clock3, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useState } from "react";

const REPORT_LABELS: Record<ReportExportHistoryItem["reportType"], string> = {
  memorization: "تقرير الحفظ",
  attendance: "تقرير الحضور",
  students: "تقرير الطلاب",
  unified: "التقرير الموحد",
};

export function ReportExportHistory() {
  const [items, setItems] = useState<ReportExportHistoryItem[]>(() => getReportExportHistory());
  useEffect(() => {
    const refresh = () => setItems(getReportExportHistory());
    window.addEventListener("tarteel:report-exported", refresh);
    return () => window.removeEventListener("tarteel:report-exported", refresh);
  }, []);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-foreground">سجل عمليات التصدير</h2><p className="mt-1 text-sm text-muted-foreground">آخر الملفات التي تم تجهيزها على هذا المتصفح.</p></div><Clock3 className="h-5 w-5 text-primary" /></div>
      {!items.length ? <p className="py-6 text-center text-sm text-muted-foreground">لا توجد عمليات تصدير مسجلة محلياً بعد.</p> : <div className="mt-4 space-y-2">{items.map((item) => { const Icon = item.format === "pdf" ? FileText : FileSpreadsheet; return <div key={item.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{REPORT_LABELS[item.reportType]} — {item.format.toUpperCase()}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("ar-SA")}</p></div></div>; })}</div>}
    </div>
  );
}
