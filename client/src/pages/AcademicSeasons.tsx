import EntityForm, { FormInput } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { BookText, Calendar, Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SEASON_TYPE_LABELS } from "../../../shared/types";

export default function AcademicSeasons() {
  const [showForm, setShowForm] = useState(false);
  const { data: seasons, isLoading, refetch } = trpc.seasons.list.useQuery({ centerId: undefined });
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });

  const createMutation = trpc.seasons.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الموسم الدراسي"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: Number(fd.get("centerId")),
      name: fd.get("name") as string,
      type: fd.get("type") as any,
      startDate: new Date(fd.get("startDate") as string),
      endDate: new Date(fd.get("endDate") as string),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center"><BookText className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">المواسم الدراسية</h1><p className="page-subtitle">إدارة المواسم والفصول الدراسية</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>موسم جديد</button>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-4"><div className="skeleton h-5 w-48 mb-2"/><div className="skeleton h-4 w-32"/></div>)}</div>
      ) : (seasons?.length ?? 0) === 0 ? (
        <div className="text-center py-16"><BookText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد مواسم دراسية</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إنشاء أول موسم</button></div>
      ) : (
        <div className="space-y-3">
          {seasons?.map((season, i) => (
            <div key={season.id} className={`glass-card rounded-2xl p-4 flex items-center gap-4 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="w-10 h-10 rounded-xl bg-teal-600/10 flex items-center justify-center flex-shrink-0"><Calendar className="w-5 h-5 text-teal-600"/></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{season.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-0.5 rounded-full">{SEASON_TYPE_LABELS[season.type]}</span>
                  <span className="text-xs text-muted-foreground">{new Date(season.startDate).toLocaleDateString("ar-SA")} - {new Date(season.endDate).toLocaleDateString("ar-SA")}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${season.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{season.isActive?"نشط":"منتهي"}</span>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm title="إنشاء موسم دراسي جديد" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input"><option value="">اختر المركز</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <FormInput label="اسم الموسم" name="name" required placeholder="العام الدراسي 1446-1447"/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">نوع الموسم</label>
          <select name="type" className="tarteel-input">
            {Object.entries(SEASON_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <FormInput label="تاريخ البداية" name="startDate" type="date" required/>
        <FormInput label="تاريخ النهاية" name="endDate" type="date" required/>
      </EntityForm>}
    </div>
  );
}
