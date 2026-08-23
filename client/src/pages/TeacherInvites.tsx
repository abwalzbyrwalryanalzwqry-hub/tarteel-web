import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardCopy, Clock3, KeyRound, Plus, ShieldAlert, Trash2, UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function inviteState(invite: { isRevoked: boolean; usedAt: Date | null; expiresAt: Date | null }) {
  if (invite.isRevoked) return { label: "ملغى", className: "bg-red-500/10 text-red-700 dark:text-red-300" };
  if (invite.usedAt) return { label: "مستخدم", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300" };
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return { label: "منتهي", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: "نشط", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
}

export default function TeacherInvites() {
  const utils = trpc.useUtils();
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: invites, isLoading } = trpc.teacherInvites.list.useQuery({ centerId: undefined });
  const [centerId, setCenterId] = useState<number | undefined>();
  const [circleId, setCircleId] = useState<number | undefined>();
  const [role, setRole] = useState<"teacher" | "assistant_teacher">("teacher");
  const [expiresAt, setExpiresAt] = useState("");

  const createInvite = trpc.teacherInvites.create.useMutation({
    onSuccess: async ({ code }) => {
      await utils.teacherInvites.list.invalidate();
      const activationLink = `${window.location.origin}/redeem-teacher-invite?code=${code}`;
      try { await navigator.clipboard.writeText(activationLink); toast.success("تم إنشاء رابط التفعيل ونسخه للمشاركة"); }
      catch { toast.success(`تم إنشاء الكود: ${code}`); }
      setCircleId(undefined);
      setExpiresAt("");
    },
    onError: (error) => toast.error(error.message || "تعذر إنشاء الكود"),
  });
  const revokeInvite = trpc.teacherInvites.revoke.useMutation({
    onSuccess: async () => { await utils.teacherInvites.list.invalidate(); toast.success("تم إلغاء الدعوة"); },
    onError: (error) => toast.error(error.message || "تعذر إلغاء الدعوة"),
  });

  const centerName = useMemo(() => new Map(centers?.map((center) => [center.id, center.name]) ?? []), [centers]);
  const circleName = useMemo(() => new Map(circles?.map((circle) => [circle.id, circle.name]) ?? []), [circles]);
  const create = () => {
    if (!centerId || !circleId) { toast.error("اختر المركز والحلقة قبل إنشاء الدعوة"); return; }
    createInvite.mutate({ centerId, circleId, role, expiresAt: expiresAt ? new Date(expiresAt) : undefined });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <section className="rounded-3xl border border-primary/15 bg-gradient-to-l from-primary/10 via-card to-emerald-500/10 p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl gold-gradient shadow-lg"><UserRoundPlus className="h-7 w-7 text-white" /></div><div><h1 className="font-display text-3xl font-bold text-foreground">دعوات المعلمين</h1><p className="mt-1 text-sm leading-7 text-muted-foreground">أنشئ رمز انضمام مخصصاً للحلقة، وشاركه مع المعلم ثم ألغِه عند عدم الحاجة.</p></div></div><div className="flex items-center gap-2 rounded-2xl bg-background/70 px-4 py-3 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4 text-primary" />رموز مرجعية أحادية الاستخدام</div></div>
      </section>

      <section className="glass-card rounded-2xl p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold text-foreground">إنشاء دعوة جديدة</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><label className="mb-2 block text-sm font-medium text-foreground">المركز</label><select value={centerId ?? ""} onChange={(e) => setCenterId(e.target.value ? Number(e.target.value) : undefined)} className="tarteel-input"><option value="">اختر المركز</option>{centers?.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-foreground">الحلقة</label><select value={circleId ?? ""} onChange={(e) => setCircleId(e.target.value ? Number(e.target.value) : undefined)} className="tarteel-input"><option value="">اختر الحلقة</option>{circles?.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-foreground">الدور</label><select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="tarteel-input"><option value="teacher">معلم</option><option value="assistant_teacher">معلم مساعد</option></select></div><div><label className="mb-2 block text-sm font-medium text-foreground">انتهاء اختياري</label><input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="tarteel-input" /></div></div><div className="mt-5 flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="flex items-center gap-2 text-xs leading-6 text-muted-foreground"><KeyRound className="h-4 w-4 text-primary" />يُنسخ رابط التفعيل تلقائياً بعد إنشائه. يُربط بحساب المعلم مرة واحدة فقط.</p><Button onClick={create} disabled={createInvite.isPending} className="min-h-11 gap-2"><KeyRound className="h-4 w-4" />{createInvite.isPending ? "جارٍ الإنشاء..." : "إنشاء رابط الانضمام"}</Button></div></section>

      <section className="glass-card overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-xl font-bold text-foreground">الدعوات الحالية</h2><p className="mt-1 text-sm text-muted-foreground">تظهر حالة كل رابط ونطاقه بوضوح.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{invites?.length ?? 0} دعوة</span></div>{isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">جارٍ تحميل الدعوات...</div> : !invites?.length ? <div className="p-10 text-center"><KeyRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="font-medium text-foreground">لا توجد دعوات حالياً</p><p className="mt-1 text-sm text-muted-foreground">أنشئ أول دعوة لتعيين معلم أو معلم مساعد للحلقة.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/35 text-muted-foreground"><tr><th className="px-5 py-3 text-right font-medium">رابط التفعيل</th><th className="px-5 py-3 text-right font-medium">المركز / الحلقة</th><th className="px-5 py-3 text-right font-medium">الدور</th><th className="px-5 py-3 text-right font-medium">الانتهاء</th><th className="px-5 py-3 text-right font-medium">الحالة</th><th className="px-5 py-3 text-left font-medium">إجراء</th></tr></thead><tbody>{invites.map((invite) => { const state = inviteState(invite); const canRevoke = !invite.isRevoked && !invite.usedAt; return <tr key={invite.id} className="border-t border-border/70"><td className="px-5 py-4"><button onClick={async () => { const link = `${window.location.origin}/redeem-teacher-invite?code=${invite.code}`; try { await navigator.clipboard.writeText(link); toast.success("تم نسخ رابط التفعيل"); } catch { toast.message(invite.code); } }} className="inline-flex items-center gap-2 font-mono font-bold text-primary hover:underline"><ClipboardCopy className="h-4 w-4" />{invite.code}</button></td><td className="px-5 py-4 text-foreground"><div>{centerName.get(invite.centerId) ?? `مركز #${invite.centerId}`}</div><div className="mt-1 text-xs text-muted-foreground">{circleName.get(invite.circleId) ?? `حلقة #${invite.circleId}`}</div></td><td className="px-5 py-4 text-foreground">{invite.role === "teacher" ? "معلم" : "معلم مساعد"}</td><td className="px-5 py-4 text-muted-foreground">{invite.expiresAt ? new Date(invite.expiresAt).toLocaleString("ar-SA") : "دون انتهاء"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${state.className}`}>{state.label}</span></td><td className="px-5 py-4 text-left">{canRevoke ? <Button onClick={() => revokeInvite.mutate({ id: invite.id })} disabled={revokeInvite.isPending} variant="ghost" size="sm" className="gap-2 text-red-600 hover:bg-red-500/10 hover:text-red-700"><Trash2 className="h-4 w-4" />إلغاء</Button> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4" />مغلق</span>}</td></tr>; })}</tbody></table></div>}</section>
    </div>
  );
}
