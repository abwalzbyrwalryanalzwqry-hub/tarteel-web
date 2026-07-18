import { trpc } from "@/lib/trpc";
import { ClipboardList } from "lucide-react";

export default function AuditLog() {
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white"/></div>
        <div><h1 className="page-title">سجل التدقيق</h1><p className="page-subtitle">سجل جميع العمليات والتغييرات في المنصة</p></div>
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
                {logs.map((log) => (
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
        </div>
      )}
    </div>
  );
}
