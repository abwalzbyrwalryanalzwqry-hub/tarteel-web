import { trpc } from "@/lib/trpc";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Trash() {
  const { data: trashed, isLoading, refetch } = trpc.trash.list.useQuery();
  const [permanentItem, setPermanentItem] = useState<any>(null);

  const restoreMutation = trpc.trash.restore.useMutation({
    onSuccess: () => { toast.success("تم الاسترجاع بنجاح"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const permanentlyDelete = trpc.trash.permanentlyDeleteSession.useMutation({
    onSuccess: () => { toast.success("حُذفت الفترة نهائياً"); setPermanentItem(null); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const sections = [
    { key: "centers", label: "المراكز", items: trashed?.centers ?? [] },
    { key: "branches", label: "الفروع", items: trashed?.branches ?? [] },
    { key: "teachers", label: "المعلمون", items: trashed?.teachers ?? [] },
    { key: "students", label: "الطلاب", items: trashed?.students ?? [] },
    { key: "circles", label: "الحلقات", items: trashed?.circles ?? [] },
    { key: "sessions", label: "الفترات", items: trashed?.sessions ?? [] },
  ] as const;

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center"><Trash2 className="w-5 h-5 text-white"/></div>
        <div><h1 className="page-title">سلة المحذوفات</h1><p className="page-subtitle">{totalItems > 0 ? `${totalItems} عنصر محذوف` : "سلة المحذوفات فارغة"}</p></div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="glass-card rounded-2xl p-4"><div className="skeleton h-5 w-32 mb-2"/><div className="skeleton h-4 w-48"/></div>)}</div>
      ) : totalItems === 0 ? (
        <div className="text-center py-16">
          <Trash2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4"/>
          <p className="text-muted-foreground">سلة المحذوفات فارغة</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.filter(s => s.items.length > 0).map((section) => (
            <div key={section.key} className="glass-card rounded-2xl p-5">
              <h2 className="font-display font-bold text-foreground text-lg mb-3">{section.label} ({section.items.length})</h2>
              <div className="space-y-2">
                {section.items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{item.name ?? item.title ?? `#${item.id}`}</p>
                      <p className="text-xs text-muted-foreground">حُذف: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("ar-SA") : "-"}</p>
                    </div>
                    <button
                      onClick={() => restoreMutation.mutate({ table: section.key, id: item.id })}
                      disabled={restoreMutation.isPending}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5"/>
                      استرجاع
                    </button>
                    {section.key === "sessions" && <button onClick={() => setPermanentItem(item)} disabled={permanentlyDelete.isPending} className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />حذف نهائي</button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={Boolean(permanentItem)} onOpenChange={(open) => !open && setPermanentItem(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle className="font-display">حذف الفترة نهائياً؟</AlertDialogTitle><AlertDialogDescription>سيُحذف سجل «{permanentItem?.title ?? `فترة #${permanentItem?.id ?? ""}`}» وبيانات الحضور والحفظ والمراجعة المرتبطة به نهائياً. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (permanentItem) permanentlyDelete.mutate({ id: permanentItem.id }); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{permanentlyDelete.isPending ? "جارٍ الحذف…" : "تأكيد الحذف النهائي"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
