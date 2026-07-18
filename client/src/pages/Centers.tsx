import EntityForm, { FormInput, FormTextarea } from "@/components/EntityForm";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, MapPin, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Centers() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<any>(null);

  const { data: centers, isLoading, refetch } = trpc.centers.list.useQuery({ orgId: undefined });
  const { data: orgs } = trpc.organizations.list.useQuery();

  const createMutation = trpc.centers.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء المركز بنجاح"); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.centers.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث المركز"); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.centers.delete.useMutation({
    onSuccess: () => { toast.success("تم نقل المركز إلى سلة المحذوفات"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = centers?.filter((c) => c.name.includes(search) || (c.city ?? "").includes(search)) ?? [];

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const orgId = orgs?.[0]?.id ?? 1;
    createMutation.mutate({
      organizationId: Number(fd.get("organizationId")) || orgId,
      name: fd.get("name") as string,
      city: fd.get("city") as string,
      phone: fd.get("phone") as string,
      address: fd.get("address") as string,
      description: fd.get("description") as string,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({ id: editItem.id, name: fd.get("name") as string, city: fd.get("city") as string, phone: fd.get("phone") as string, address: fd.get("address") as string });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
          <div><h1 className="page-title">المراكز</h1><p className="page-subtitle">إدارة مراكز تحفيظ القرآن الكريم</p></div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-gold flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />مركز جديد</button>
      </div>
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المراكز..." className="tarteel-input pr-10" />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-5"><div className="skeleton h-5 w-32 mb-3"/><div className="skeleton h-4 w-24 mb-2"/><div className="skeleton h-4 w-20"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><Building2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/><p className="text-muted-foreground">لا توجد مراكز</p><button onClick={()=>setShowForm(true)} className="mt-4 btn-gold text-sm px-4 py-2">إضافة أول مركز</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((center, i) => (
            <div key={center.id} className={`glass-card rounded-2xl p-5 animate-fade-in-up stagger-${(i%5)+1}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600"/></div>
                <div className="flex gap-1">
                  <button onClick={()=>setEditItem(center)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"><Edit className="w-3.5 h-3.5 text-muted-foreground"/></button>
                  <button onClick={()=>{if(confirm("نقل إلى سلة المحذوفات؟"))deleteMutation.mutate({id:center.id})}} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors"><Trash2 className="w-3.5 h-3.5 text-destructive"/></button>
                </div>
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-1">{center.name}</h3>
              {center.city&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1"><MapPin className="w-3.5 h-3.5"/>{center.city}</div>}
              {center.phone&&<div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5"/>{center.phone}</div>}
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full ${center.isActive?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 text-gray-500"}`}>{center.isActive?"نشط":"غير نشط"}</span>
                <span className="text-xs text-muted-foreground">{new Date(center.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm&&<EntityForm title="إضافة مركز جديد" onClose={()=>setShowForm(false)} onSubmit={handleCreate} isLoading={createMutation.isPending}>
        {orgs&&orgs.length>0&&<div><label className="block text-sm font-medium text-foreground mb-1.5">المنظمة</label><select name="organizationId" className="tarteel-input">{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
        <FormInput label="اسم المركز" name="name" required placeholder="مركز تحفيظ القرآن الكريم"/>
        <FormInput label="المدينة" name="city" placeholder="الرياض"/>
        <FormInput label="رقم الهاتف" name="phone" placeholder="0500000000"/>
        <FormInput label="العنوان" name="address" placeholder="حي النزهة"/>
        <FormTextarea label="الوصف" name="description" placeholder="وصف مختصر..."/>
      </EntityForm>}
      {editItem&&<EntityForm title="تعديل المركز" onClose={()=>setEditItem(null)} onSubmit={handleUpdate} isLoading={updateMutation.isPending} submitLabel="تحديث">
        <FormInput label="اسم المركز" name="name" required defaultValue={editItem.name}/>
        <FormInput label="المدينة" name="city" defaultValue={editItem.city??""}/>
        <FormInput label="رقم الهاتف" name="phone" defaultValue={editItem.phone??""}/>
        <FormInput label="العنوان" name="address" defaultValue={editItem.address??""}/>
      </EntityForm>}
    </div>
  );
}
