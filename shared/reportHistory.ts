export type ReportExportHistoryItem = {
  id: string;
  filename: string;
  reportType: "memorization" | "attendance" | "students" | "unified";
  format: "pdf" | "excel" | "csv" | "word";
  createdAt: string;
};

const HISTORY_KEY = "tarteel:report-export-history:v1";

export function getReportExportHistory(): ReportExportHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const history = raw ? (JSON.parse(raw) as ReportExportHistoryItem[]) : [];
    return Array.isArray(history) ? history.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function recordReportExport(item: Omit<ReportExportHistoryItem, "id" | "createdAt">): void {
  try {
    const nextItem: ReportExportHistoryItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const next = [nextItem, ...getReportExportHistory()].slice(0, 12);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("tarteel:report-exported"));
  } catch {
    // يظل تحميل الملف متاحاً حتى عند منع التخزين المحلي في المتصفح.
  }
}
