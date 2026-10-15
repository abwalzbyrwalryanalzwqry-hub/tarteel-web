import { UI_LOCALE } from "@shared/dates";
import { trpc } from "@/lib/trpc";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Trash() {
  const { data: trashed, isLoading, refetch } = trpc.trash.list.useQuery();

  const restoreMutation = trpc.trash.restore.useMutation({
    onSuccess: () => { toast.success("تم الاسترجاع بنجاح"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const sections = [
    { key: "centers", label: "المراكز", items: trashed?.centers ?? [] },
    { key: "teachers", label: "المعلمون", items: trashed?.teachers ?? [] },
    { key: "students", label: "الطلاب", items: trashed?.students ?? [] },
    { key: "circles", label: "الحلقات", items: trashed?.circles ?? [] },
  ] as const;

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center"><Trash2 className="w-5 h-5 text-white"/></div>
        <div><h1 className="page-title">سلة المحذوفات</h1><p className="page-subtitle">{totalItems > 0 ? `${totalItems} عنصر محذوف` : "سلة المحذوفات فارغة"}</p><p className="mt-1 text-xs text-muted-foreground">أيام السجل اليومي المحذوفة تُستعاد من «السجلات السابقة» في السجل اليومي نفسه.</p></div>
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
                      <p className="text-xs text-muted-foreground">حُذف: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString(UI_LOCALE) : "-"}</p>
                    </div>
                    <button
                      onClick={() => restoreMutation.mutate({ table: section.key, id: item.id })}
                      disabled={restoreMutation.isPending}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5"/>
                      استرجاع
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
