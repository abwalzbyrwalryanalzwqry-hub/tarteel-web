import EntityForm, { FormInput, FormMore, FormPhoneInput, isAddAnotherSubmit } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { BookOpen, Edit, Plus, Trash2, User } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QURAN_SURAHS } from "../../../shared/types";
import { AIGuidanceCard } from "@/components/AIGuidanceCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useLocation } from "wouter";
import { ContactLinks } from "@/components/ContactLinks";
import { FilterChips, SearchField } from "@/components/SearchField";
import { recallChoice, rememberChoice, useCreateFormParam, useNumberParam } from "@/hooks/useUrlParams";
import { useMoveToTrash } from "@/hooks/useMoveToTrash";

export default function Students() {
  const { can, role } = usePermissions();
  const isTeachingRole = role === "teacher" || role === "assistant_teacher";
  const isReaderRole = role === "student" || role === "guardian";
  const canManageStudents = can("students:manage");
  const [showForm, setShowForm] = useCreateFormParam();
  const [formKey, setFormKey] = useState(0);
  const urlCircleId = useNumberParam("circleId");
  const [circleFilter, setCircleFilter] = useState<number | undefined>(urlCircleId);
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const [editItem, setEditItem] = useState<any>(null);
  const utils = trpc.useUtils();

  const { data: students, isLoading, refetch } = trpc.students.list.useQuery({ search: search || undefined });
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined }, { enabled: !isReaderRole });
  const { data: circles } = trpc.circles.list.useQuery(undefined, { enabled: !isReaderRole });
  const { data: users } = trpc.users.list.useQuery(undefined, { enabled: !isTeachingRole && !isReaderRole });
  const syncSharedData = () => void Promise.all([
    utils.dashboard.stats.invalidate(),
    utils.dashboard.recentDays.invalidate(),
    utils.students.list.invalidate(),
    utils.circles.list.invalidate(),
    utils.teachers.list.invalidate(),
  ]);

  const [addAnother, setAddAnother] = useState(false);
  const createMutation = trpc.students.create.useMutation({
    onSuccess: (_result, values) => {
      toast.success(`تم تسجيل ${values.name}`);
      rememberChoice("circle", values.circleId);
      if (addAnother) setFormKey((key) => key + 1); else setShowForm(false);
      refetch(); syncSharedData();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث بيانات الطالب"); setEditItem(null); refetch(); syncSharedData(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.students.delete.useMutation();
  const moveToTrash = useMoveToTrash("students", () => { refetch(); syncSharedData(); });
  const singleCenterId = centers?.length === 1 ? centers[0].id : undefined;
  const defaultCircleId = useMemo(() => {
    const ids = circles?.map((circle) => circle.id) ?? [];
    const preferred = [circleFilter, urlCircleId, recallChoice("circle")].find((id) => id && ids.includes(id));
    return preferred ?? (ids.length === 1 ? ids[0] : undefined);
  }, [circles, circleFilter, urlCircleId]);
  const visibleStudents = useMemo(() => (students ?? []).filter((student) => !circleFilter || student.circleId === circleFilter), [students, circleFilter]);
  const circleOptions = useMemo(() => (circles ?? []).map((circle) => ({ value: circle.id, label: circle.name, count: students?.filter((student) => student.circleId === circle.id).length })), [circles, students]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddAnother(isAddAnotherSubmit(e));
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: fd.get("centerId") ? Number(fd.get("centerId")) : singleCenterId,
      circleId: fd.get("circleId") ? Number(fd.get("circleId")) : undefined,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      guardianName: fd.get("guardianName") as string,
      guardianPhone: fd.get("guardianPhone") as string,
      userId: fd.get("userId") ? Number(fd.get("userId")) : undefined,
      guardianUserId: fd.get("guardianUserId") ? Number(fd.get("guardianUserId")) : undefined,
      nationalId: fd.get("nationalId") as string,
      birthDate: fd.get("birthDate") ? new Date(fd.get("birthDate") as string) : undefined,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editItem.id,
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      guardianName: fd.get("guardianName") as string,
      guardianPhone: fd.get("guardianPhone") as string,
      nationalId: (fd.get("nationalId") as string) || null,
      birthDate: fd.get("birthDate") ? new Date(fd.get("birthDate") as string) : null,
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
          <div><h1 className="page-title">{role === "student" ? "إنجازي" : role === "guardian" ? "إنجازات الابن" : "الطلاب"}</h1><p className="page-subtitle">{isReaderRole ? "قراءة التقدم المصرح به فقط." : "إدارة بيانات الطلاب وتتبع حفظهم"}</p></div>
        </div>
        {canManageStudents && <button onClick={()=>setShowForm(true)} className="btn-gold flex shrink-0 items-center gap-2 whitespace-nowrap text-sm"><Plus className="w-4 h-4"/>تسجيل طالب</button>}
      </div>
      {!isReaderRole && <AIGuidanceCard context="students" />}
      {!isReaderRole && <div className="space-y-3">
        <SearchField value={search} onChange={setSearch} placeholder="بحث باسم الطالب..." />
        <FilterChips options={circleOptions} value={circleFilter} onChange={setCircleFilter} allLabel="كل الحلقات" />
      </div>}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-10 w-10 rounded-full mb-3"/><div className="skeleton h-5 w-32 mb-2"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : visibleStudents.length === 0 ? (
        <div className="text-center py-16"><User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">{search || circleFilter ? "لا نتائج مطابقة" : "لا يوجد طلاب"}</p>{(search || circleFilter) && <button onClick={() => { setSearch(""); setCircleFilter(undefined); }} className="mt-3 text-sm font-semibold text-primary hover:underline">مسح التصفية</button>}{canManageStudents && <button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">تسجيل أول طالب</button>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleStudents.map((student, i) => (
            <div key={student.id} role="link" tabIndex={0} onClick={() => navigate(`/students/${student.id}`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/students/${student.id}`); }} className={`glass-card cursor-pointer rounded-2xl p-5 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600/10 flex items-center justify-center">
                  <span className="font-display font-bold text-emerald-600 text-lg">{student.name.charAt(0)}</span>
                </div>
                {canManageStudents && <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                  <button onClick={()=>setEditItem(student)} aria-label={`تعديل ${student.name}`} title="تعديل" className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-4 h-4 text-muted-foreground"/></button>
                  <button onClick={()=>void moveToTrash(student, (id) => deleteMutation.mutateAsync({ id }))} aria-label={`حذف ${student.name}`} title="نقل إلى السلة" className="w-9 h-9 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-4 h-4 text-destructive"/></button>
                </div>}
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-1">{student.name}</h3>
              {!isReaderRole && circles && student.circleId && <p className="text-xs font-semibold text-primary/80 mb-1">{circles.find((circle) => circle.id === student.circleId)?.name}</p>}
              {!isReaderRole && student.guardianName&&<p className="text-sm text-muted-foreground mb-1">ولي الأمر: {student.guardianName}</p>}
              {!isReaderRole && <ContactLinks phone={student.guardianPhone} label="ولي الأمر" />}
              {!isReaderRole && <ContactLinks phone={student.phone} label="الطالب" />}
              <div className="flex items-center gap-1.5 text-sm text-primary mt-2">
                <BookOpen className="w-3.5 h-3.5"/>
                <span>آخر حفظ: {getSurahName(student.lastMemorizedSurah ?? 1)} - آية {student.lastMemorizedAyah ?? 1}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${student.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{student.isActive?"نشط":"غير نشط"}</span>
                <span className="text-xs text-muted-foreground">{student.totalMemorizedJuz ?? 0} جزء</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm key={formKey} title="تسجيل طالب جديد" description="الاسم والحلقة يكفيان للبدء، وبقية البيانات اختيارية." onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending} submitLabel="حفظ" addAnotherLabel="حفظ وإضافة آخر">
        <FormInput label="اسم الطالب" name="name" required placeholder="محمد بن أحمد" autoComplete="off"/>
        {!isTeachingRole && (centers?.length ?? 0) > 1 && <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input"><option value="">اختر المركز</option>{centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>}
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحلقة {isTeachingRole && <span className="text-destructive">*</span>}</label>
          <select key={defaultCircleId ?? "none"} name="circleId" required={isTeachingRole} defaultValue={defaultCircleId ?? ""} className="tarteel-input"><option value="">{isTeachingRole ? "اختر حلقتك" : "بدون حلقة الآن"}</option>{circles?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <FormInput label="اسم ولي الأمر" name="guardianName" placeholder="أحمد بن محمد" autoComplete="off"/>
        <FormPhoneInput label="هاتف ولي الأمر" name="guardianPhone" hint="يُربط حساب ولي الأمر تلقائياً إن سجّل بهذا الرقم."/>
        <FormMore>
          <FormPhoneInput label="هاتف الطالب" name="phone"/>
          <FormInput label="رقم الهوية" name="nationalId" inputMode="numeric" dir="ltr" placeholder="1234567890"/>
          <FormInput label="تاريخ الميلاد" name="birthDate" type="date"/>
          {!isTeachingRole && <><div><label className="block text-sm font-medium text-foreground mb-1.5">حساب الطالب المرتبط</label><select name="userId" className="tarteel-input"><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "student").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب ولي الأمر المرتبط</label><select name="guardianUserId" className="tarteel-input"><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "guardian").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">يمنح الربط ولي الأمر قراءة إنجاز الأبناء المرتبطين بحسابه فقط.</p></div></>}
        </FormMore>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل بيانات الطالب" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="اسم الطالب" name="name" required defaultValue={editItem.name}/>
        <FormInput label="اسم ولي الأمر" name="guardianName" defaultValue={editItem.guardianName??""}/>
        <FormPhoneInput label="هاتف ولي الأمر" name="guardianPhone" defaultValue={editItem.guardianPhone??""}/>
        <FormPhoneInput label="هاتف الطالب" name="phone" defaultValue={editItem.phone??""}/>
        <FormInput label="رقم الهوية" name="nationalId" defaultValue={editItem.nationalId??""}/>
        <FormInput label="تاريخ الميلاد" name="birthDate" type="date" defaultValue={editItem.birthDate ? new Date(editItem.birthDate).toISOString().slice(0, 10) : ""}/>
        {!isTeachingRole && <><div><label className="block text-sm font-medium text-foreground mb-1.5">حساب الطالب المرتبط</label><select name="userId" className="tarteel-input" defaultValue={editItem.userId??""}><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "student").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">حساب ولي الأمر المرتبط</label><select name="guardianUserId" className="tarteel-input" defaultValue={editItem.guardianUserId??""}><option value="">بدون حساب مرتبط</option>{users?.filter((user) => user.role === "guardian").map((user) => <option key={user.id} value={user.id}>{user.name || user.email || `حساب #${user.id}`}</option>)}</select></div></>}
        <div><label className="block text-sm font-medium text-foreground mb-1.5">الحلقة</label>
          <select name="circleId" required={isTeachingRole} className="tarteel-input" defaultValue={editItem.circleId??""}>
            {!isTeachingRole && <option value="">بدون حلقة</option>}{circles?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </EntityForm>}
    </div>
  );
}
