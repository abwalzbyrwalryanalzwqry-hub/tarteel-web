import EntityForm, { FormInput, FormTextarea } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { BookOpen, Edit, Plus, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { Link } from "wouter";

export default function Circles() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const { data: circles, isLoading, refetch } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: branches } = trpc.branches.list.useQuery({ centerId: undefined });
  const { data: seasons } = trpc.seasons.list.useQuery({ centerId: undefined });
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });

  const createMutation = trpc.circles.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الحلقة بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.circles.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحلقة"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.circles.delete.useMutation({
    onSuccess: () => { toast.success("تم نقل الحلقة إلى سلة المحذوفات"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = circles?.filter((c) => c.name.includes(search)) ?? [];

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      branchId: Number(fd.get("branchId")),
      seasonId: Number(fd.get("seasonId")),
      name: fd.get("name") as string,
      teacherId: fd.get("teacherId") ? Number(fd.get("teacherId")) : undefined,
      maxStudents: Number(fd.get("maxStudents")) || 20,
      schedule: fd.get("schedule") as string,
      description: fd.get("description") as string,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editItem.id,
      name: fd.get("name") as string,
      teacherId: fd.get("teacherId") ? Number(fd.get("teacherId")) : undefined,
      maxStudents: Number(fd.get("maxStudents")) || 20,
      schedule: fd.get("schedule") as string,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center"><BookOpen className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">الحلقات</h1><p className="page-subtitle">إدارة حلقات التحفيظ</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>حلقة جديدة</button>
      </div>
      <AIGuidanceCard context="circles" />
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث في الحلقات..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-5 w-32 mb-3"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد حلقات</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إنشاء أول حلقة</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((circle, i) => {
            const teacher = teachers?.find(t => t.id === circle.teacherId);
            return (
              <div key={circle.id} className={`glass-card rounded-2xl p-5 animate-fade-in-up stagger-${(i%5)+1}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-purple-600"/></div>
                  <div className="flex gap-1">
                    <button onClick={()=>setEditItem(circle)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-3.5 h-3.5 text-muted-foreground"/></button>
                    <button onClick={()=>{if(confirm("نقل إلى سلة المحذوفات؟"))deleteMutation.mutate({id:circle.id})}} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5 text-destructive"/></button>
                  </div>
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-1">{circle.name}</h3>
                {teacher&&<p className="text-sm text-primary mb-1">المعلم: {teacher.name}</p>}
                {circle.schedule&&<p className="text-sm text-muted-foreground mb-1">{circle.schedule}</p>}
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="w-3.5 h-3.5"/>الحد الأقصى: {circle.maxStudents}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${circle.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{circle.isActive?"نشطة":"غير نشطة"}</span>
                </div>
                <Link href={`/circles/${circle.id}`} className="mt-3 block rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10">فتح لوحة الحلقة</Link>
              </div>
            );
          })}
        </div>
      )}
      {showForm&&<EntityForm title="إنشاء حلقة جديدة" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الفرع <span className="text-destructive">*</span></label>
          <select name="branchId" required className="tarteel-input"><option value="">اختر الفرع</option>{branches?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الموسم الدراسي <span className="text-destructive">*</span></label>
          <select name="seasonId" required className="tarteel-input"><option value="">اختر الموسم</option>{seasons?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <FormInput label="اسم الحلقة" name="name" required placeholder="حلقة الفجر"/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم</label>
          <select name="teacherId" className="tarteel-input"><option value="">اختر المعلم</option>{teachers?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <FormInput label="الحد الأقصى للطلاب" name="maxStudents" type="number" defaultValue="20"/>
        <FormInput label="الجدول الزمني" name="schedule" placeholder="السبت والاثنين 8-10 صباحاً"/>
        <FormTextarea label="الوصف" name="description" placeholder="وصف مختصر..."/>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل الحلقة" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="اسم الحلقة" name="name" required defaultValue={editItem.name}/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم</label>
          <select name="teacherId" className="tarteel-input" defaultValue={editItem.teacherId??""}>
            <option value="">بدون معلم</option>{teachers?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <FormInput label="الحد الأقصى للطلاب" name="maxStudents" type="number" defaultValue={editItem.maxStudents??20}/>
        <FormInput label="الجدول الزمني" name="schedule" defaultValue={editItem.schedule??""}/>
      </EntityForm>}
    </div>
  );
}
