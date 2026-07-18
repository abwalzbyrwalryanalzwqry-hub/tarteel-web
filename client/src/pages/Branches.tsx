import EntityForm, { FormInput, FormTextarea } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, MapPin, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Branches() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const { data: branches, isLoading, refetch } = trpc.branches.list.useQuery({ centerId: undefined });
  const { data: centers } = trpc.centers.list.useQuery({ orgId: undefined });

  const createMutation = trpc.branches.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الفرع بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.branches.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الفرع"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.branches.delete.useMutation({
    onSuccess: () => { toast.success("تم نقل الفرع إلى سلة المحذوفات"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = branches?.filter((b) => b.name.includes(search)) ?? [];

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      centerId: Number(fd.get("centerId")),
      name: fd.get("name") as string,
      phone: fd.get("phone") as string,
      address: fd.get("address") as string,
      description: fd.get("description") as string,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({ id: editItem.id, name: fd.get("name") as string, phone: fd.get("phone") as string, address: fd.get("address") as string });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><Building2 className="w-5 h-5 text-white"/></div>
          <div><h1 className="page-title">الفروع</h1><p className="page-subtitle">إدارة فروع المراكز</p></div>
        </div>
        <button onClick={()=>setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4"/>فرع جديد</button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="بحث في الفروع..." className="tarteel-input pr-10"/>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-5 w-32 mb-3"/><div className="skeleton h-4 w-24"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><Building2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد فروع</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إضافة أول فرع</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((branch, i) => (
            <div key={branch.id} className={`glass-card rounded-2xl p-5 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-indigo-600"/></div>
                <div className="flex gap-1">
                  <button onClick={()=>setEditItem(branch)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Edit className="w-3.5 h-3.5 text-muted-foreground"/></button>
                  <button onClick={()=>{if(confirm("نقل إلى سلة المحذوفات؟"))deleteMutation.mutate({id:branch.id})}} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5 text-destructive"/></button>
                </div>
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-1">{branch.name}</h3>
              {branch.address&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1"><MapPin className="w-3.5 h-3.5"/>{branch.address}</div>}
              {branch.phone&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5"/>{branch.phone}</div>}
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${branch.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{branch.isActive?"نشط":"غير نشط"}</span>
                <span className="text-xs text-muted-foreground">{new Date(branch.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm title="إضافة فرع جديد" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        <div><label className="block text-sm font-medium text-foreground mb-1.5">المركز <span className="text-destructive">*</span></label>
          <select name="centerId" required className="tarteel-input">
            <option value="">اختر المركز</option>
            {centers?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <FormInput label="اسم الفرع" name="name" required placeholder="فرع حي النزهة"/>
        <FormInput label="رقم الهاتف" name="phone" placeholder="0500000000"/>
        <FormInput label="العنوان" name="address" placeholder="حي النزهة"/>
        <FormTextarea label="الوصف" name="description" placeholder="وصف مختصر..."/>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل الفرع" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="اسم الفرع" name="name" required defaultValue={editItem.name}/>
        <FormInput label="رقم الهاتف" name="phone" defaultValue={editItem.phone??""}/>
        <FormInput label="العنوان" name="address" defaultValue={editItem.address??""}/>
      </EntityForm>}
    </div>
  );
}
