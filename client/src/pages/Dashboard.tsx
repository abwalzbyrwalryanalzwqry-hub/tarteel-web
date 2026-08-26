import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { CenterManagerDashboard } from "@/components/CenterManagerDashboard";
import { RoleSimulationControl } from "@/components/RoleSimulationControl";
import { SESSION_STATUS_LABELS, SESSION_TYPE_LABELS } from "../../../shared/types";

function LayoutDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  delay = 1,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
  delay?: number;
}) {
  const content = (
    <div className={`glass-card rounded-2xl p-5 hover:shadow-lg transition-all duration-300 cursor-pointer group animate-fade-in-up stagger-${delay}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground font-display">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentSessions } = trpc.dashboard.recentSessions.useQuery();
  const { data: notifications } = trpc.notifications.list.useQuery();
  const { data: accessibleCenters } = trpc.centers.list.useQuery({ orgId: undefined });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء النور";
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 rounded-2xl gold-gradient" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-muted-foreground text-sm mb-1">{greeting()}،</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {user?.name ?? "مرحباً بك"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {new Date().toLocaleDateString("ar-SA", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RoleSimulationControl />
            {unreadCount > 0 && (
              <Link href="/notifications">
                <div className="relative cursor-pointer">
                  <div className="w-11 h-11 rounded-xl glass-card flex items-center justify-center hover:bg-muted/50 transition-colors">
                    <Bell className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              </Link>
            )}
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-display">﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</p>
            </div>
          </div>
        </div>
      </div>

      <AIGuidanceCard context="dashboard" />
      <CenterManagerDashboard centers={accessibleCenters ?? []} />

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5">
              <div className="skeleton h-11 w-11 rounded-xl mb-3" />
              <div className="skeleton h-8 w-16 mb-2" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="إجمالي الطلاب" value={stats?.totalStudents ?? 0} icon={Users} color="bg-emerald-600" href="/students" delay={1} />
            <StatCard label="المعلمون" value={stats?.totalTeachers ?? 0} icon={GraduationCap} color="bg-amber-500" href="/teachers" delay={2} />
            <StatCard label="المراكز النشطة" value={stats?.totalCenters ?? 0} icon={Building2} color="bg-blue-600" href="/centers" delay={3} />
            <StatCard label="الحلقات" value={stats?.totalCircles ?? 0} icon={BookOpen} color="bg-purple-600" href="/circles" delay={4} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="إجمالي الفترات" value={stats?.totalSessions ?? 0} icon={ClipboardList} color="bg-teal-600" href="/periods" delay={1} />
            <StatCard label="فترات مفتوحة" value={stats?.openSessions ?? 0} icon={Calendar} color="bg-indigo-600" href="/periods" delay={2} />
            <StatCard label="حضور اليوم" value={stats?.todayAttendance ?? 0} icon={CheckCircle} color="bg-green-600" delay={3} />
            <StatCard label="غياب اليوم" value={stats?.todayAbsence ?? 0} icon={XCircle} color="bg-red-500" delay={4} />
          </div>
        </>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent periods */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-foreground text-lg">آخر الفترات</h2>
            <Link href="/periods">
              <span className="text-sm text-primary hover:underline cursor-pointer">عرض الكل</span>
            </Link>
          </div>
          {recentSessions && recentSessions.length > 0 ? (
            <div className="space-y-2">
              {recentSessions.map((session, i) => (
                <Link key={session.id} href={`/periods/${session.id}`}>
                  <div className={`flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer animate-fade-in-up stagger-${(i % 5) + 1}`}>
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{session.title ?? `فترة #${session.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.scheduledAt).toLocaleDateString("ar-SA", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        session.status === "open" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        session.status === "closed" ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                        session.status === "scheduled" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {SESSION_STATUS_LABELS[session.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{SESSION_TYPE_LABELS[session.type]}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد فترات بعد</p>
              <Link href="/periods">
                <button className="mt-3 btn-gold text-sm px-4 py-2">إنشاء فترة</button>
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="glass-card rounded-2xl p-5 animate-fade-in-up">
            <h2 className="font-display font-bold text-foreground text-base mb-3">إجراءات سريعة</h2>
            <div className="space-y-1.5">
              {[
                { label: "فترة جديدة", href: "/periods", icon: ClipboardList, color: "bg-blue-600" },
                { label: "إضافة طالب", href: "/students", icon: Users, color: "bg-emerald-600" },
                { label: "إضافة معلم", href: "/teachers", icon: GraduationCap, color: "bg-amber-500" },
                { label: "مركز جديد", href: "/centers", icon: Building2, color: "bg-purple-600" },
                { label: "التقارير", href: "/reports", icon: BarChart3, color: "bg-teal-600" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer group">
                      <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors">{action.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Notifications */}
          {unreadCount > 0 && (
            <div className="glass-card rounded-2xl p-5 animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-foreground text-base">إشعارات جديدة</h2>
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
              </div>
              <div className="space-y-2">
                {notifications
                  ?.filter((n) => !n.isRead)
                  .slice(0, 3)
                  .map((notif) => (
                    <div key={notif.id} className="p-2.5 rounded-xl bg-muted/30 border-r-2 border-primary">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.message}</p>
                    </div>
                  ))}
                <Link href="/notifications">
                  <button className="w-full text-xs text-primary hover:underline mt-1 text-center">عرض كل الإشعارات</button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 animate-fade-in-up"
        style={{ background: "linear-gradient(135deg, oklch(0.28 0.11 155) 0%, oklch(0.20 0.08 155) 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 60%), radial-gradient(circle at 80% 20%, oklch(0.72 0.18 72) 0%, transparent 50%)" }}
        />
        <div className="relative z-10 flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-lg flex-shrink-0">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">مرحباً بك في ترتيل</h2>
            <p className="text-white/70 text-sm mt-1">منصة متكاملة لإدارة مراكز تحفيظ القرآن الكريم</p>
          </div>
          <div className="mr-auto hidden md:flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: "oklch(0.84 0.13 78)" }} />
            <span className="text-white/80 text-sm">إجمالي الفترات: {stats?.totalSessions ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
