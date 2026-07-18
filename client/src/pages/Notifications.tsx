import { trpc } from "@/lib/trpc";
import { Bell, BellOff, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const typeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  attendance: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  session: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  memorization: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const typeIcons: Record<string, string> = {
  info: "ℹ️", warning: "⚠️", success: "✅", error: "❌", attendance: "📋", session: "📅", memorization: "📖",
};

export default function Notifications() {
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { toast.success("تم تعليم جميع الإشعارات كمقروءة"); refetch(); },
  });

  const unread = notifications?.filter(n => !n.isRead) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center"><Bell className="w-5 h-5 text-white"/></div>
          <div>
            <h1 className="page-title">الإشعارات</h1>
            <p className="page-subtitle">{unread.length > 0 ? `${unread.length} إشعار غير مقروء` : "جميع الإشعارات مقروءة"}</p>
          </div>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors">
            <CheckCheck className="w-4 h-4"/>
            تعليم الكل كمقروء
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="glass-card rounded-2xl p-4"><div className="skeleton h-5 w-48 mb-2"/><div className="skeleton h-4 w-64"/></div>)}</div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="text-center py-16">
          <BellOff className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/>
          <p className="text-muted-foreground">لا توجد إشعارات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => (
            <div
              key={notif.id}
              className={`glass-card rounded-2xl p-4 flex items-start gap-4 transition-all animate-fade-in-up stagger-${(i%5)+1} ${!notif.isRead ? "border-r-4 border-primary" : "opacity-70"}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${typeColors[notif.type] ?? typeColors.info}`}>
                {typeIcons[notif.type] ?? "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>{notif.title}</h3>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(notif.createdAt).toLocaleDateString("ar-SA", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
              </div>
              {!notif.isRead && (
                <button
                  onClick={() => markReadMutation.mutate({ id: notif.id })}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors"
                  title="تعليم كمقروء"
                >
                  <Check className="w-4 h-4 text-primary"/>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
