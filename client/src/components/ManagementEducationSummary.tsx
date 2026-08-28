import { BookMarked, UsersRound } from "lucide-react";

type EducationSummary = {
  activeStudents: number;
  studentsWithMemorization: number;
  studentsWithRevision: number;
  studentsWithRecordedProgress: number;
  studentsWithoutRecordedProgress: number;
};

type CircleCoverage = {
  circleId: number;
  circleName: string;
  activeStudents: number;
  studentsWithRecordedProgress: number;
  progressCoverageRate: number;
};

export function ManagementEducationSummary({ summary }: { summary?: EducationSummary }) {
  if (!summary) return null;
  return <section className="glass-card rounded-2xl p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookMarked className="h-5 w-5" /></span><div><h3 className="font-display text-lg font-bold text-foreground">توثيق التقدم التعليمي</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">يعرض السجلات المعتمدة للحفظ أو المراجعة في النطاق الحالي، ولا يقدّر مستوى الطالب أو يضع هدفاً تلقائياً.</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="الطلاب ضمن النطاق" value={summary.activeStudents} /><Metric label="سجل تقدم موثق" value={summary.studentsWithRecordedProgress} tone="text-primary" /><Metric label="سجل حفظ موثق" value={summary.studentsWithMemorization} tone="text-emerald-700" /><Metric label="بلا سجل تقدم" value={summary.studentsWithoutRecordedProgress} tone="text-amber-700" /></div>{summary.activeStudents > 0 && <p className="mt-3 text-xs text-muted-foreground">توجد سجلات مراجعة موثقة لـ {summary.studentsWithRevision} من الطلاب ضمن النطاق المحدد.</p>}</section>;
}

export function CircleProgressCoverage({ comparisons }: { comparisons: CircleCoverage[] }) {
  if (!comparisons.length) return null;
  return <section className="glass-card rounded-2xl p-5"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" /><div><h3 className="font-display text-lg font-bold text-foreground">تغطية توثيق التقدم بالحلقات</h3><p className="mt-1 text-xs text-muted-foreground">عدد الطلاب ذوي سجل حفظ أو مراجعة معتمد ضمن النطاق الحالي.</p></div></div><div className="mt-4 space-y-3">{comparisons.map((circle) => <div key={circle.circleId} className="rounded-xl border border-border bg-background/55 p-3"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-sm font-bold text-foreground">{circle.circleName}</p><p className="shrink-0 text-sm font-bold text-primary">{circle.studentsWithRecordedProgress}/{circle.activeStudents} · {circle.progressCoverageRate}%</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${circle.progressCoverageRate}%` }} /></div></div>)}</div></section>;
}

function Metric({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) { return <div className="rounded-xl border border-border bg-background/55 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p></div>; }
