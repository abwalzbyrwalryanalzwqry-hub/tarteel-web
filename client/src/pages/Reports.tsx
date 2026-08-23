import { trpc } from "@/lib/trpc";
import { BarChart3, Building2, ClipboardList, GraduationCap, Users } from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { ReportExportHistory } from "@/components/ReportExportHistory";
import { useState } from "react";

export default function Reports() {
  const [selectedCircleId, setSelectedCircleId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: students } = trpc.students.list.useQuery({});
  const { data: sessions } = trpc.sessions.list.useQuery({ circleId: undefined, seasonId: undefined });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });

  const totalPresent = 0;
  const totalAbsent = 0;

  const sessionsByStatus = {
    scheduled: sessions?.filter(s => s.status === "scheduled").length ?? 0,
    open: sessions?.filter(s => s.status === "open").length ?? 0,
    closed: sessions?.filter(s => s.status === "closed").length ?? 0,
    cancelled: sessions?.filter(s => s.status === "cancelled").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">التقارير والإحصائيات</h1><p className="page-subtitle">نظرة شاملة على أداء المنصة</p></div>
        </div>
      </div>

      <AIGuidanceCard context="reports" />

      {/* Export Section */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-display font-bold text-foreground text-lg mb-4">تصدير التقارير</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">اختر الحلقة</label>
              <select
                value={selectedCircleId || ''}
                onChange={(e) => setSelectedCircleId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground"
              >
                <option value="">-- اختر حلقة --</option>
                {circles?.map((circle) => (
                  <option key={circle.id} value={circle.id}>
                    {circle.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">من تاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">إلى تاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedCircleId && (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">تقرير الحفظ</p>
                  <ExportButtons
                    circleId={selectedCircleId}
                    reportType="memorization"
                    startDate={startDate}
                    endDate={endDate}
                    className="w-full justify-center"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">تقرير الحضور</p>
                  <ExportButtons
                    circleId={selectedCircleId}
                    reportType="attendance"
                    startDate={startDate}
                    endDate={endDate}
                    className="w-full justify-center"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">تقرير الطلاب</p>
                  <ExportButtons
                    circleId={selectedCircleId}
                    reportType="students"
                    className="w-full justify-center"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ReportExportHistory />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الطلاب", value: stats?.totalStudents ?? 0, icon: Users, color: "bg-emerald-600" },
          { label: "المعلمون", value: stats?.totalTeachers ?? 0, icon: GraduationCap, color: "bg-amber-500" },
          { label: "المراكز", value: stats?.totalCenters ?? 0, icon: Building2, color: "bg-blue-600" },
          { label: "إجمالي الجلسات", value: stats?.totalSessions ?? 0, icon: ClipboardList, color: "bg-purple-600" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1 font-display">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center`}><Icon className="w-5 h-5 text-white"/></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sessions Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4">حالة الجلسات</h2>
          <div className="space-y-3">
            {[
              { label: "مجدولة", value: sessionsByStatus.scheduled, color: "bg-blue-500", total: stats?.totalSessions ?? 1 },
              { label: "مفتوحة", value: sessionsByStatus.open, color: "bg-emerald-500", total: stats?.totalSessions ?? 1 },
              { label: "مغلقة", value: sessionsByStatus.closed, color: "bg-gray-500", total: stats?.totalSessions ?? 1 },
              { label: "ملغاة", value: sessionsByStatus.cancelled, color: "bg-red-500", total: stats?.totalSessions ?? 1 },
            ].map((item) => {
              const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Centers Overview */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4">المراكز النشطة</h2>
          {!centers || centers.length === 0 ? (
            <div className="text-center py-8"><Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/><p className="text-muted-foreground text-sm">لا توجد مراكز</p></div>
          ) : (
            <div className="space-y-2">
              {centers.filter(c => c.isActive).map((center) => (
                <div key={center.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center"><Building2 className="w-4 h-4 text-blue-600"/></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{center.name}</p>
                    {center.city && <p className="text-xs text-muted-foreground">{center.city}</p>}
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">نشط</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Teachers List */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-display font-bold text-foreground text-lg mb-4">المعلمون النشطون ({teachers?.filter(t=>t.isActive).length ?? 0})</h2>
        {!teachers || teachers.length === 0 ? (
          <div className="text-center py-8"><GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3"/><p className="text-muted-foreground text-sm">لا يوجد معلمون</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teachers.filter(t=>t.isActive).map((teacher) => (
              <div key={teacher.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-amber-600 text-sm">{teacher.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{teacher.name}</p>
                  {teacher.specialization && <p className="text-xs text-muted-foreground truncate">{teacher.specialization}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Students Stats */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-display font-bold text-foreground text-lg mb-4">إحصائيات الطلاب</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الطلاب", value: students?.length ?? 0 },
            { label: "الطلاب النشطون", value: students?.filter(s=>s.isActive).length ?? 0 },
            { label: "غير النشطين", value: students?.filter(s=>!s.isActive).length ?? 0 },
            { label: "متوسط الأجزاء المحفوظة", value: students && students.length > 0 ? Math.round((students.reduce((sum,s)=>sum+(Number(s.totalMemorizedJuz)??0),0)/students.length)*10)/10 : 0 },
          ].map((item) => (
            <div key={item.label} className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-2xl font-bold text-foreground font-display">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
