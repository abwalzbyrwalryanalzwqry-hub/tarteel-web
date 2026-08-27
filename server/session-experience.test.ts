import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QURAN_SURAHS } from "../shared/types";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("تزامن البيانات وتجربة جلسة المعلم", () => {
  it("يعزل إحصاءات لوحة التحكم وجلساتها بحلقات الحساب عند غياب صلاحية المركز", () => {
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    expect(database).toContain("getDashboardStatsForCircles");
    expect(database).toContain("getRecentSessionsForCircles");
    expect(router).toContain("getAccessibleDashboardCircleIds");
    expect(router).toContain("return getDashboardStatsForCircles(await getAccessibleDashboardCircleIds(ctx.user))");
  });

  it("يبطل الكاش المشترك بعد عمليات التعديل لتحديث العدادات والقوائم", () => {
    const main = source("client/src/main.tsx");
    const students = source("client/src/pages/Students.tsx");
    const sessions = source("client/src/pages/Sessions.tsx");
    expect(main).toContain("scheduleSharedDataRefresh");
    expect(main).toContain('event.action.type === "success"');
    expect(students).toContain("utils.dashboard.stats.invalidate()");
    expect(sessions).toContain("utils.dashboard.recentSessions.invalidate()");
  });

  it("يوفر رأس الجلسة نوعاً وتاريخاً مزدوجاً وواجهة اختيار آيات ضمن حدود السورة", () => {
    const header = source("client/src/components/SessionHeaderControls.tsx");
    const ayahPicker = source("client/src/components/AyahPicker.tsx");
    const detail = source("client/src/pages/SessionDetail.tsx");
    expect(header).toContain("يومية");
    expect(header).toContain("تخصيص");
    expect(header).toContain("formatDualCalendarDate");
    expect(ayahPicker).toContain("Array.from({ length: max }");
    expect(ayahPicker).toContain("إدخال يدوي");
    expect(detail).toContain("<AyahPicker");
    expect(QURAN_SURAHS).toHaveLength(114);
    expect(QURAN_SURAHS.find((surah) => surah.number === 2)?.ayahs).toBe(286);
  });

  it("يعرض زر رجوع موحداً مع مسار احتياطي للوحة التحكم", () => {
    const layout = source("client/src/components/TarteelLayout.tsx");
    expect(layout).toContain("const goBack");
    expect(layout).toContain('window.history.back()');
    expect(layout).toContain('navigate("/dashboard")');
    expect(layout).toContain("العودة للشاشة السابقة");
  });

  it("يدمج إنشاء الجلسة في واجهة موحدة ويعيد المعلّم إلى سجل الطلاب", () => {
    const composer = source("client/src/components/NewSessionComposer.tsx");
    const sessions = source("client/src/pages/Sessions.tsx");
    expect(composer).toContain("إنشاء الفترة وفتح سجل الطلاب");
    expect(composer).toContain("إدخال هجري يدوي");
    expect(composer).toContain("الحلقة");
    expect(sessions).toContain("<NewSessionComposer");
    expect(sessions).toContain("let periodId = Number(result?.periodId ?? result?.sessionId)");
    expect(sessions).toContain("navigate(`/periods/${periodId}`");
  });

  it("يحفظ أزرار الحضور كعناصر مستقلة قابلة للتفاعل مع حراسة تعديل خادمية", () => {
    const detail = source("client/src/pages/SessionDetail.tsx");
    const router = source("server/routers.ts");
    expect(detail).toContain('role="button"');
    expect(detail).toContain("attendanceOverrides");
    expect(detail).toContain("aria-pressed={status === s}");
    expect(router).toContain('assertCirclePermission(ctx.user, session.circleId, "attendance.edit")');
  });

  it("يسجل الحضور الجماعي للطلاب غير المسجلين فقط ويحافظ على الاستثناءات الفردية", () => {
    const detail = source("client/src/pages/SessionDetail.tsx");
    const router = source("server/routers.ts");
    const database = source("server/db.ts");
    expect(detail).toContain("تسجيل الجميع حضوراً");
    expect(detail).toContain("ستبقى حالات الغياب والاستئذان المسجلة يدوياً كما هي");
    expect(router).toContain("markUnrecordedPresent");
    expect(database).toContain("markUnrecordedAttendancePresent");
    expect(database).toContain("getUnrecordedStudentIds");
  });

  it("يجعل الفترات واجهة تشغيل السجل الموحد ويحوّل المسار القديم بأمان", () => {
    const app = source("client/src/App.tsx");
    const layout = source("client/src/components/TarteelLayout.tsx");
    const circle = source("client/src/pages/CircleDetail.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    expect(app).toContain('path="/periods"');
    expect(app).toContain("LegacySessionRedirect");
    expect(layout).toContain('path: "/periods", label: "الفترات"');
    expect(circle).toContain("كل فترة هي سجل عمل مستقل");
    expect(circle).toContain("<NewSessionComposer");
    expect(circle).not.toContain("trpc.circlePeriods");
    expect(dashboard).toContain('href="/periods"');
    expect(dashboard).not.toContain('href="/sessions"');
  });

  it("يفرض فترة واحدة للتاريخ الذي يختاره المعلم، ويمنع تكرار الحضور ويستعيد آخر إنجاز", () => {
    const dates = source("shared/dates.ts");
    const schema = source("drizzle/schema.ts");
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    const composer = source("client/src/components/NewSessionComposer.tsx");
    const detail = source("client/src/pages/SessionDetail.tsx");
    expect(dates).toContain("getRiyadhDayKey");
    expect(schema).toContain('dayKey: varchar("dayKey", { length: 10 }).notNull()');
    expect(schema).toContain("attendance_session_student_unique");
    expect(database).toContain("keepLatestAttendanceRows");
    expect(database).toContain("getLatestStudentPeriodProgress");
    expect(router).toContain("createDailyPeriod");
    expect(router).toContain('code: "CONFLICT"');
    expect(composer).toContain("conflictMessage");
    expect(composer).toContain("تغيير التاريخ");
    expect(detail).toContain("latestStudentProgress");
    expect(detail).toContain("setToSurah(value)");
  });

  it("يحفظ الفترة كمسودة تلقائية ثم يعرضها للتقارير بعد الاعتماد النهائي فقط", () => {
    const schema = source("drizzle/schema.ts");
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    const composer = source("client/src/components/NewSessionComposer.tsx");
    const header = source("client/src/components/SessionHeaderControls.tsx");
    const detail = source("client/src/pages/SessionDetail.tsx");
    expect(schema).toContain('["draft", "scheduled", "open", "closed", "cancelled"]');
    expect(database).toContain('ne(sessions.status, "draft")');
    expect(router).toContain("finalize: protectedProcedure");
    expect(composer).toContain("onClearConflict");
    expect(header).toContain("dateConflict");
    expect(detail).toContain("trpc.sessions.finalize.useMutation");
    expect(detail).toContain("حفظ الفترة");
    expect(detail).toContain("مسودة محفوظة تلقائياً");
    expect(detail).toContain("مراجعة اعتماد الفترة");
    expect(detail).toContain("مراجعة وحفظ الفترة");
    expect(detail).toContain("لم تسجل حالة حضور");
    expect(detail).toContain("اعتماد الفترة");
    expect(detail).toContain("سُجل حضور");
    expect(detail).toContain("تنبيه متابعة:");
    expect(detail).toContain("هذا لا يمنع الاعتماد");
  });

  it("يعيد المعلم إلى المسودة ويقبل نطاق السور الصاعد أو النازل مع زر اعتماد واضح", () => {
    const mizan = source("shared/mizan.ts");
    const router = source("server/routers.ts");
    const periods = source("client/src/pages/Sessions.tsx");
    const detail = source("client/src/pages/SessionDetail.tsx");
    expect(mizan).toContain("endSurah === input.surahNumber");
    expect(router).toContain("includeDrafts");
    expect(periods).toContain("مسودات محفوظة تلقائياً");
    expect(periods).toContain("استئناف");
    expect(detail).toContain("مراجعة وحفظ الفترة");
  });

  it("يفتح سجل طلاب الفترة الجديدة فور إنشائها من القائمة أو من الحلقة", () => {
    const router = source("server/routers.ts");
    const periods = source("client/src/pages/Sessions.tsx");
    const circle = source("client/src/pages/CircleDetail.tsx");
    expect(router).toContain("function getInsertedSessionId");
    expect(router).toContain("const insertedId = getInsertedSessionId(insertion)");
    expect(router).toContain("if (insertedId) return { sessionId: insertedId, periodId: insertedId }");
    expect(router).toContain("const created = await getSessionByCircleDay");
    expect(router).toContain("periodId: created.id");
    expect(periods).toContain("navigate(`/periods/${periodId}`");
    expect(circle).toContain("navigate(`/periods/${periodId}`");
  });

  it("يعرض لوحة جلسة اليوم ويعطي أولوية للمسودة أو إجراء إنشاء واضح عند غيابها", () => {
    const periods = source("client/src/pages/Sessions.tsx");
    expect(periods).toContain("جلسة اليوم");
    expect(periods).toContain("getRiyadhDayKey");
    expect(periods).toContain("مسودة محفوظة وجاهزة للاستئناف");
    expect(periods).toContain("إنشاء جلسة اليوم");
    expect(periods).toContain("استئناف");
  });

  it("يستعيد المسودة بحسب الحلقة والتاريخ إذا غاب معرّف الإنشاء من الاستجابة الحية", () => {
    const router = source("server/routers.ts");
    const periods = source("client/src/pages/Sessions.tsx");
    const circle = source("client/src/pages/CircleDetail.tsx");
    expect(router).toContain("byDay: protectedProcedure");
    expect(router).toContain("getSessionByCircleDay(input.circleId, getRiyadhDayKey(input.scheduledAt))");
    expect(periods).toContain("utils.sessions.byDay.fetch");
    expect(circle).toContain("utils.sessions.byDay.fetch");
  });

  it("يوحّد اسم الفترة مع الخيارات الجاهزة والكتابة اليدوية", () => {
    const composer = source("client/src/components/NewSessionComposer.tsx");
    const header = source("client/src/components/SessionHeaderControls.tsx");
    expect(composer).toContain("حفظ ومراجعة");
    expect(composer).toContain("محاضرة");
    expect(composer).toContain("اسم الفترة");
    expect(header).toContain("اسم الفترة");
    expect(header).toContain("تخصيص");
  });

  it("يفتح الفترة بالنقر ويعرض إدارة آمنة بالضغط المطوّل مع نقل مؤكد إلى السلة", () => {
    const periods = source("client/src/pages/Sessions.tsx");
    const trash = source("client/src/pages/Trash.tsx");
    const router = source("server/routers.ts");
    const database = source("server/db.ts");
    expect(periods).toContain("onPointerDown={() => startHold(period)}");
    expect(periods).toContain("تأكيد النقل إلى السلة");
    expect(periods).toContain("نقل إلى سلة المهملات");
    expect(trash).toContain("تأكيد الحذف النهائي");
    expect(router).toContain("permanentlyDeleteSession");
    expect(database).toContain("permanentlyDeleteTrashedSession");
  });

  it("ينشئ تقريراً تنفيذياً للحلقة بفلاتر أسبوعية وشهرية وطباعة", () => {
    const builder = source("server/reports/reportBuilder.ts");
    const reportingRouter = source("server/routers/reporting.ts");
    const executive = source("client/src/components/ExecutiveCircleReport.tsx");
    const reports = source("client/src/pages/Reports.tsx");
    expect(builder).toContain("buildExecutiveCircleReport");
    expect(reportingRouter).toContain("executive: protectedProcedure");
    expect(executive).toContain("أسبوعي");
    expect(executive).toContain("شهري");
    expect(executive).toContain("window.print()");
    expect(reports).toContain("<ExecutiveCircleReport");
  });
});
