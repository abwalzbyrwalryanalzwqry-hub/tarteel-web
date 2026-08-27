import { trpc } from "@/lib/trpc";
import { AlertCircle, Bell, BellOff, CalendarDays, Check, CheckCheck, CheckCircle2, ClipboardCheck, Filter, Info, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { filterNotifications } from "../../../shared/activityFilters";
import { getNotificationAction } from "../../../shared/notificationActions";
import { useLocation } from "wouter";

const typeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  attendance: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  session: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  memorization: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const typeIcons: Record<string, LucideIcon> = {
  info: Info, warning: TriangleAlert, success: CheckCircle2, error: AlertCircle, attendance: ClipboardCheck, session: CalendarDays, memorization: Bell,
};

export default function Notifications() {
  const [, navigate] = useLocation();
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => { toast.success("تم تعليم جميع الإشعارات كمقروءة"); refetch(); },
  });

  const unread = notifications?.filter(n => !n.isRead) ?? [];
  const filteredNotifications = filterNotifications(notifications ?? [], { search, readFilter, dateRange });

  return (
    <div dir="rtl" className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center"><Bell className="w-5 h-5 text-white"/></div>
          <div>
            <h1 className="page-title">الإشعارات</h1>
            <p className="page-subtitle">{unread.length > 0 ? `${unread.length} إشعار غير مقروء` : "جميع الإشعارات مقروءة"}</p>
          </div>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} className="flex w-fit shrink-0 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm transition-colors hover:bg-muted">
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
        <>
          <div className="glass-card rounded-2xl p-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في العنوان أو التفاصيل..." className="tarteel-input pr-10" /></div>
            <label className="relative"><Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" /><select value={readFilter} onChange={(event) => setReadFilter(event.target.value as typeof readFilter)} className="tarteel-input pr-10"><option value="all">كل الحالات</option><option value="unread">غير مقروءة</option><option value="read">مقروءة</option></select></label>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as typeof dateRange)} className="tarteel-input"><option value="all">كل الفترات</option><option value="today">آخر 24 ساعة</option><option value="week">آخر 7 أيام</option><option value="month">آخر 30 يوماً</option></select>
          </div>
          {filteredNotifications.length === 0 ? <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">لا توجد إشعارات مطابقة للفلاتر المحددة.</div> : <div className="space-y-2">
          {filteredNotifications.map((notif, i) => {
            const action = getNotificationAction(notif);
            const NotificationIcon = typeIcons[notif.type] ?? Bell;
            return <div
              key={notif.id}
              className={`glass-card flex min-w-0 max-w-full flex-col gap-3 rounded-2xl p-4 transition-all animate-fade-in-up stagger-${(i%5)+1} sm:flex-row sm:items-start sm:gap-4 ${!notif.isRead ? "border-r-4 border-primary" : "opacity-70"}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[notif.type] ?? typeColors.info}`}>
                <NotificationIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-semibold ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>{notif.title}</h3>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(notif.createdAt).toLocaleDateString("ar-SA", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                {action && <button type="button" onClick={() => { if (!notif.isRead) markReadMutation.mutate({ id: notif.id }); navigate(action.href); }} className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10">{action.label}</button>}
              </div>
              {!notif.isRead && (
                <button
                  onClick={() => markReadMutation.mutate({ id: notif.id })}
                  className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-lg transition-colors hover:bg-muted sm:self-auto"
                  title="تعليم كمقروء"
                >
                  <Check className="w-4 h-4 text-primary"/>
                </button>
              )}
            </div>;
          })}
        </div>
          }
        </>
      )}
    </div>
  );
}
