import { useAuth } from "@/_core/hooks/useAuth";
import { useRoleSimulation } from "@/contexts/RoleSimulationContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { ROLE_LABELS, type TarteelRole } from "../../../shared/permissions";

const options: TarteelRole[] = ["supervisor", "guide", "teacher", "assistant_teacher", "student", "guardian"];

export function RoleSimulationControl() {
  const { user } = useAuth();
  const { simulation, startSimulation, stopSimulation } = useRoleSimulation();
  const [open, setOpen] = useState(false);
  const allowed = ["admin", "super_admin", "org_admin", "center_manager"].includes(user?.role ?? "");
  if (!allowed) return null;

  if (simulation) return <Button variant="outline" className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300" onClick={stopSimulation}><X className="ml-2 h-4 w-4" />إنهاء محاكاة {ROLE_LABELS[simulation.role]}</Button>;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="border-primary/25 bg-card/70"><Eye className="ml-2 h-4 w-4 text-primary" />محاكاة الدور</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-w-lg">
      <DialogHeader><DialogTitle className="font-display text-2xl">محاكاة الدور</DialogTitle><DialogDescription className="leading-7">عاين التنقل والواجهات كما يراها الدور المختار. لا تُعدّل المحاكاة عضويتك أو صلاحياتك، وتُرفض جميع إجراءات الحفظ والتعديل من الخادم أثناء تفعيلها.</DialogDescription></DialogHeader>
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-6 text-amber-800 dark:text-amber-200"><ShieldAlert className="ml-2 inline h-4 w-4" />هذه أداة معاينة للواجهة وليست انتحالاً لحساب مستخدم أو تجاوزاً للصلاحيات.</div>
      <div className="grid gap-2 sm:grid-cols-2">{options.map((role) => <button key={role} onClick={() => { startSimulation(role); setOpen(false); }} className="rounded-xl border border-border p-3 text-right text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5">{ROLE_LABELS[role]}<span className="mt-1 block text-xs font-normal text-muted-foreground">عرض الواجهة المقيدة لهذا الدور</span></button>)}</div>
    </DialogContent>
  </Dialog>;
}
