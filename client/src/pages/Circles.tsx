import EntityForm, { FormInput, FormMore, FormTextarea } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { BookOpen, Edit, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { useLocation } from "wouter";
import { SearchField } from "@/components/SearchField";
import { useCreateFormParam } from "@/hooks/useUrlParams";
import { useMoveToTrash } from "@/hooks/useMoveToTrash";

export default function Circles() {
  const [showForm, setShowForm] = useCreateFormParam();
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [, navigate] = useLocation();

  const { data: circles, isLoading, refetch } = trpc.circles.list.useQuery();
  const { data: centers } = trpc.centers.list.useQuery({});
  const { data: teachers } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: students } = trpc.students.list.useQuery({});

  const createMutation = trpc.circles.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الحلقة");
      setShowForm(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.circles.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحلقة"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.circles.delete.useMutation();
  const moveToTrash = useMoveToTrash("circles", () => refetch());

  const studentCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const student of students ?? []) if (student.circleId) counts.set(student.circleId, (counts.get(student.circleId) ?? 0) + 1);
    return counts;
  }, [students]);
  const term = search.trim();
  const filtered = circles?.filter((c) => !term || c.name.includes(term) || teachers?.find((t) => t.id === c.teacherId)?.name.includes(term)) ?? [];
  const teacherOptions = (centerId?: number) => (teachers ?? []).filter((t) => !centerId || t.centerId === centerId);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: fd.get("centerId") ? Number(fd.get("centerId")) : centers?.length === 1 ? centers[0].id : undefined,
      name: fd.get("name") as string,
      teacherId: fd.get("teacherId") ? Number(fd.get("teacherId")) : undefined,
      assistantTeacherId: fd.get("assistantTeacherId") ? Number(fd.get("assistantTeacherId")) : undefined,
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
      assistantTeacherId: fd.get("assistantTeacherId") ? Number(fd.get("assistantTeacherId")) : null,
      maxStudents: Number(fd.get("maxStudents")) || 20,
      schedule: fd.get("schedule") as string,
      description: fd.get("description") as string,
    });
  }

  const open = (id: number) => navigate(`/circles/${id}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center"><BookOpen className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">الحلقات</h1><p className="page-subtitle">{circles ? `${circles.length} حلقة` : "إدارة حلقات التحفيظ"}</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex shrink-0 items-center gap-2 text-sm"><Plus className="w-4 h-4"/>حلقة جديدة</button>
      </div>
      <AIGuidanceCard context="circles" />
      <SearchField value={search} onChange={setSearch} placeholder="بحث باسم الحلقة أو المعلم..." />
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-5 w-32 mb-3"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">{term ? "لا نتائج مطابقة" : "لا توجد حلقات"}</p>{term ? <button onClick={() => setSearch("")} className="mt-3 text-sm font-semibold text-primary hover:underline">مسح البحث</button> : <button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إنشاء أول حلقة</button>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((circle, i) => {
            const teacher = teachers?.find(t => t.id === circle.teacherId);
            const assistant = teachers?.find(t => t.id === circle.assistantTeacherId);
            const count = studentCounts.get(circle.id) ?? 0;
            const full = circle.maxStudents ? count >= circle.maxStudents : false;
            return (
              <div key={circle.id} role="link" tabIndex={0} onClick={() => open(circle.id)} onKeyDown={(event) => { if (event.key === "Enter") open(circle.id); }} className={`glass-card cursor-pointer rounded-2xl p-5 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary animate-fade-in-up stagger-${(i%5)+1}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-purple-600"/></div>
                  <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                    <button onClick={()=>setEditItem(circle)} aria-label={`تعديل ${circle.name}`} title="تعديل" className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-4 h-4 text-muted-foreground"/></button>
                    <button onClick={()=>void moveToTrash(circle, (id) => deleteMutation.mutateAsync({ id }))} aria-label={`حذف ${circle.name}`} title="نقل إلى السلة" className="w-9 h-9 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-4 h-4 text-destructive"/></button>
                  </div>
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-1">{circle.name}</h3>
                <p className="text-sm text-primary mb-1">{teacher ? `المعلم: ${teacher.name}` : "لم يُحدد معلم"}{assistant ? ` · المساعد: ${assistant.name}` : ""}</p>
                {circle.schedule&&<p className="text-sm text-muted-foreground mb-1">{circle.schedule}</p>}
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 text-sm ${full ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}><Users className="w-3.5 h-3.5"/>{count} من {circle.maxStudents} طالب</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${circle.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{circle.isActive?"نشطة":"غير نشطة"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showForm&&<EntityForm title="إنشاء حلقة جديدة" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <FormInput label="اسم الحلقة" name="name" required placeholder="حلقة الفجر" autoComplete="off"/>
        {(centers?.length ?? 0) > 1 && <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input"><option value="">اختر المركز</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>}
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم</label>
          <select name="teacherId" className="tarteel-input" defaultValue={teachers?.length === 1 ? teachers[0].id : ""}><option value="">بدون معلم الآن</option>{teachers?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <FormInput label="الجدول الزمني" name="schedule" placeholder="السبت إلى الأربعاء بعد العصر"/>
        <FormMore>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم المساعد</label>
            <select name="assistantTeacherId" className="tarteel-input"><option value="">بدون مساعد</option>{teachers?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
          <FormInput label="الحد الأقصى للطلاب" name="maxStudents" type="number" inputMode="numeric" min={1} defaultValue="20"/>
          <FormTextarea label="الوصف" name="description" placeholder="وصف مختصر..."/>
        </FormMore>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل الحلقة" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="حفظ التعديلات">
        <FormInput label="اسم الحلقة" name="name" required defaultValue={editItem.name}/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم</label>
          <select name="teacherId" className="tarteel-input" defaultValue={editItem.teacherId??""}>
            <option value="">بدون معلم</option>{teacherOptions(editItem.centerId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المعلم المساعد</label>
          <select name="assistantTeacherId" className="tarteel-input" defaultValue={editItem.assistantTeacherId??""}>
            <option value="">بدون مساعد</option>{teacherOptions(editItem.centerId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <FormInput label="الحد الأقصى للطلاب" name="maxStudents" type="number" inputMode="numeric" min={1} defaultValue={editItem.maxStudents??20}/>
        <FormInput label="الجدول الزمني" name="schedule" defaultValue={editItem.schedule??""}/>
        <FormTextarea label="الوصف" name="description" defaultValue={editItem.description??""}/>
      </EntityForm>}
    </div>
  );
}
