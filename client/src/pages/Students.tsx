import EntityForm, { FormInput } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { BookOpen, Edit, Phone, Plus, Search, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { QURAN_SURAHS } from "../../../shared/types";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { Link } from "wouter";

export default function Students() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const { data: students, isLoading, refetch } = trpc.students.list.useQuery({ search: search || undefined });
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الطالب بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث بيانات الطالب"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.students.delete.useMutation({
    onSuccess: () => { toast.success("تم نقل الطالب إلى سلة المحذوفات"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: Number(fd.get("centerId")),
      circleId: fd.get("circleId") ? Number(fd.get("circleId")) : undefined,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      guardianName: fd.get("guardianName") as string,
      guardianPhone: fd.get("guardianPhone") as string,
      userId: fd.get("userId") ? Number(fd.get("userId")) : undefined,
      guardianUserId: fd.get("guardianUserId") ? Number(fd.get("guardianUserId")) : undefined,
      nationalId: fd.get("nationalId") as string,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editItem.id,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      guardianPhone: fd.get("guardianPhone") as string,
      circleId: fd.get("circleId") ? Number(fd.get("circleId")) : undefined,
      userId: fd.get("userId") ? Number(fd.get("userId")) : undefined,
      guardianUserId: fd.get("guardianUserId") ? Number(fd.get("guardianUserId")) : undefined,
    });
  }

  const getSurahName = (num: number) => QURAN_SURAHS.find(s => s.number === num)?.name ?? `سورة ${num}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center"><User className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">الطلاب</h1><p className="page-subtitle">إدارة بيانات الطلاب وتتبع حفظهم</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>تسجيل طالب</button>
      </div>
      <AIGuidanceCard context="students" />
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث باسم الطالب..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-10 w-10 rounded-full mb-3"/><div className="skeleton h-5 w-32 mb-2"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : (students?.length ?? 0) === 0 ? (
        <div className="text-center py-16"><User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا يوجد طلاب</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">تسجيل أول طالب</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students?.map((student, i) => (
            <div key={student.id} className={`glass-card rounded-2xl p-5 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600/10 flex items-center justify-center">
                  <span className="font-display font-bold text-emerald-600 text-lg">{student.name.charAt(0)}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>setEditItem(student)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-3.5 h-3.5 text-muted-foreground"/></button>
                  <button onClick={()=>{if(confirm("نقل إلى سلة المحذوفات؟"))deleteMutation.mutate({id:student.id})}} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5 text-destructive"/></button>
                </div>
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-1">{student.name}</h3>
              {student.guardianName&&<p className="text-sm text-muted-foreground mb-1">ولي الأمر: {student.guardianName}</p>}
              {student.phone&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1"><Phone className="w-3.5 h-3.5"/>{student.phone}</div>}
              <div className="flex items-center gap-1.5 text-sm text-primary mt-2">
                <BookOpen className="w-3.5 h-3.5"/>
                <span>آخر حفظ: {getSurahName(student.lastMemorizedSurah ?? 1)} - آية {student.lastMemorizedAyah ?? 1}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${student.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{student.isActive?"نشط":"غير نشط"}</span>
                <span className="text-xs text-muted-foreground">{student.totalMemorizedJuz ?? 0} جزء</span>
              </div>
              <Link href={`/students/${student.id}`} className="mt-3 block rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10">فتح ملف الطالب</Link>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm title="تسجيل طالب جديد" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input"><option value="">اختر المركز</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحلقة</label>
          <select name="circleId" className="tarteel-input"><option value="">اختر الحلقة (اختياري)</option>{circles?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <FormInput label="اسم الطالب" name="name" required placeholder="محمد بن أحمد"/>
        <FormInput label="رقم الهاتف" name="phone" placeholder="0500000000"/>
        <FormInput label="اسم ولي الأمر" name="guardianName" placeholder="أحمد بن محمد"/>
        <FormInput label="هاتف ولي الأمر" name="guardianPhone" placeholder="0500000000"/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب الطالب المرتبط</label><select name="userId" className="tarteel-input"><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "student").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب ولي الأمر المرتبط</label><select name="guardianUserId" className="tarteel-input"><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "guardian").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">يمنح الربط ولي الأمر قراءة إنجاز الأبناء المرتبطين بحسابه فقط.</p></div>
        <FormInput label="رقم الهوية" name="nationalId" placeholder="1234567890"/>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل بيانات الطالب" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="اسم الطالب" name="name" required defaultValue={editItem.name}/>
        <FormInput label="رقم الهاتف" name="phone" defaultValue={editItem.phone??""}/>
        <FormInput label="هاتف ولي الأمر" name="guardianPhone" defaultValue={editItem.guardianPhone??""}/>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب الطالب المرتبط</label><select name="userId" className="tarteel-input" defaultValue={editItem.userId??""}><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "student").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب ولي الأمر المرتبط</label><select name="guardianUserId" className="tarteel-input" defaultValue={editItem.guardianUserId??""}><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "guardian").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحلقة</label>
          <select name="circleId" className="tarteel-input" defaultValue={editItem.circleId??""}>
            <option value="">بدون حلقة</option>{circles?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </EntityForm>}
    </div>
  );
}
