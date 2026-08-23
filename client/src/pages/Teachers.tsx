import EntityForm, { FormInput } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, Clock3, Edit, GraduationCap, Mail, Phone, Plus, Search, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Teachers() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);
  const [transferItem, setTransferItem] = useState<any>(null);

  const { data: teachers, isLoading, refetch } = trpc.teachers.list.useQuery({ centerId: undefined });
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: teacherActivity } = trpc.teachers.activity.useQuery();

  const createMutation = trpc.teachers.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة المعلم بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.teachers.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث بيانات المعلم"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.teachers.delete.useMutation({
    onSuccess: () => { toast.success("تم نقل المعلم إلى سلة المحذوفات"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const transferMutation = trpc.teachers.transfer.useMutation({
    onSuccess: () => { toast.success("تم نقل المعلم وربطه بالحَلَقة الجديدة"); setTransferItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = teachers?.filter((t) => t.name.includes(search) || (t.phone ?? "").includes(search)) ?? [];

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: Number(fd.get("centerId")),
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      nationalId: fd.get("nationalId") as string,
      specialization: fd.get("specialization") as string,
      qualification: fd.get("qualification") as string,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({ id: editItem.id, name: fd.get("name") as string, phone: fd.get("phone") as string, specialization: fd.get("specialization") as string });
  }
  function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    transferMutation.mutate({ teacherId: transferItem.id, circleId: Number(fd.get("circleId")), role: fd.get("role") as "teacher" | "assistant_teacher" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">المعلمون</h1><p className="page-subtitle">إدارة بيانات المعلمين</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>إضافة معلم</button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث في المعلمين..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-5 w-32 mb-3"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><GraduationCap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا يوجد معلمون</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إضافة أول معلم</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((teacher, i) => {
            const lastActivity = teacherActivity?.[teacher.id];
            return <div key={teacher.id} className={`glass-card rounded-2xl p-5 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center"><User className="w-6 h-6 text-amber-600"/></div>
                <div className="flex gap-1">
                  <button onClick={()=>setEditItem(teacher)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-3.5 h-3.5 text-muted-foreground"/></button>
                  <button onClick={()=>setTransferItem(teacher)} className="w-8 h-8 rounded-lg hover:bg-primary/10 flex items-center justify-center" title="نقل إلى حلقة"><ArrowLeftRight className="w-3.5 h-3.5 text-primary"/></button>
                  <button onClick={()=>{if(confirm("نقل إلى سلة المحذوفات؟"))deleteMutation.mutate({id:teacher.id})}} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5 text-destructive"/></button>
                </div>
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-1">{teacher.name}</h3>
              {teacher.specialization&&<p className="text-sm text-primary mb-2">{teacher.specialization}</p>}
              {teacher.phone&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1"><Phone className="w-3.5 h-3.5"/>{teacher.phone}</div>}
              {teacher.email&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5"/>{teacher.email}</div>}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="w-3.5 h-3.5 text-primary" />{lastActivity ? `آخر جلسة: ${new Date(lastActivity).toLocaleDateString("ar-SA")}` : "لا توجد جلسات مسجلة بعد"}</div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${teacher.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{teacher.isActive?"نشط":"غير نشط"}</span>
                {teacher.qualification&&<span className="text-xs text-muted-foreground">{teacher.qualification}</span>}
              </div>
            </div>;
          })}
        </div>
      )}
      {showForm&&<EntityForm title="إضافة معلم جديد" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input"><option value="">اختر المركز</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <FormInput label="الاسم الكامل" name="name" required placeholder="أحمد بن محمد"/>
        <FormInput label="رقم الهاتف" name="phone" placeholder="0500000000"/>
        <FormInput label="البريد الإلكتروني" name="email" type="email" placeholder="teacher@example.com"/>
        <FormInput label="رقم الهوية" name="nationalId" placeholder="1234567890"/>
        <FormInput label="التخصص" name="specialization" placeholder="تحفيظ القرآن الكريم"/>
        <FormInput label="المؤهل العلمي" name="qualification" placeholder="بكالوريوس"/>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل بيانات المعلم" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="الاسم الكامل" name="name" required defaultValue={editItem.name}/>
        <FormInput label="رقم الهاتف" name="phone" defaultValue={editItem.phone??""}/>
        <FormInput label="التخصص" name="specialization" defaultValue={editItem.specialization??""}/>
      </EntityForm>}
      {transferItem&&<EntityForm title={`نقل ${transferItem.name} إلى حَلَقة`} onClose={()=>setTransferItem(null)} onSubmit={handleTransfer} isLoading={transferMutation.isPending} submitLabel="تأكيد النقل">
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحَلَقة المستهدفة <span className="text-destructive">*</span></label><select name="circleId" required className="tarteel-input"><option value="">اختر حَلَقة من مركز المعلم</option>{circles?.map(circle=><option key={circle.id} value={circle.id}>{circle.name}</option>)}</select><p className="mt-2 text-xs leading-5 text-muted-foreground">سيتحقق النظام من أن الحَلَقة تنتمي إلى المركز نفسه وأن المقعد المختار غير مشغول.</p></div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">صفة الارتباط</label><select name="role" defaultValue="teacher" className="tarteel-input"><option value="teacher">معلم الحلقة</option><option value="assistant_teacher">معلم مساعد</option></select></div>
      </EntityForm>}
    </div>
  );
}
