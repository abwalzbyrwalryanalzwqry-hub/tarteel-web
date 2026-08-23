import { trpc } from "@/lib/trpc";
import { ClipboardList, Download, Filter, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { filterAuditLogs, toCsv } from "../../../shared/activityFilters";

export default function AuditLog() {
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "week" | "month">("all");

  const filteredLogs = filterAuditLogs(logs ?? [], { search, actionFilter, dateRange });

  const exportCsv = () => {
    if (!filteredLogs.length) { toast.error("لا توجد سجلات لتصديرها"); return; }
    const rows = [["العملية", "الكيان", "المعرف", "التاريخ"], ...filteredLogs.map((log) => [log.action, log.entity, String(log.entityId ?? ""), new Date(log.createdAt).toLocaleString("ar-SA")])];
    const csv = toCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tarteel-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تجهيز ملف سجل التدقيق");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white"/></div>
        <div><h1 className="page-title">سجل التدقيق</h1><p className="page-subtitle">سجل جميع العمليات والتغييرات في المنصة</p></div>
      </div>

      <div className="glass-card rounded-2xl p-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالعملية أو الكيان أو المعرف..." className="tarteel-input pr-10" /></div>
        <label className="relative"><Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" /><select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="tarteel-input pr-10"><option value="all">كل العمليات</option><option value="create">إنشاء</option><option value="update">تعديل</option><option value="delete">حذف</option></select></label>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value as typeof dateRange)} className="tarteel-input"><option value="all">كل الفترات</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يوماً</option></select>
        <button onClick={exportCsv} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"><Download className="h-4 w-4 text-primary" />CSV</button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="glass-card rounded-xl p-3"><div className="skeleton h-4 w-full"/></div>)}</div>
      ) : !logs || logs.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/>
          <p className="text-muted-foreground">لا توجد سجلات بعد</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">العملية</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">الجدول</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">المعرف</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.action === "create" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        log.action === "update" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        log.action === "delete" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {log.action === "create" ? "إنشاء" : log.action === "update" ? "تعديل" : log.action === "delete" ? "حذف" : log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{log.entity}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{log.entityId}</td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("ar-SA", {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLogs.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">لا توجد سجلات مطابقة للفلاتر المحددة.</div>}
        </div>
      )}
    </div>
  );
}
