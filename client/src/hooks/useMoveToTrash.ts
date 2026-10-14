import { useConfirm } from "@/components/ConfirmProvider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type TrashTable = "centers" | "teachers" | "students" | "circles";

const nouns: Record<TrashTable, string> = {
  centers: "المركز",
  teachers: "المعلم",
  students: "الطالب",
  circles: "الحلقة",
};

/**
 * نقل إلى سلة المحذوفات بنافذة تأكيد موحدة، ثم رسالة فيها «تراجع» تعيد العنصر فوراً
 * دون الذهاب إلى السلة.
 */
export function useMoveToTrash(table: TrashTable, onChanged: () => void) {
  const confirm = useConfirm();
  const utils = trpc.useUtils();
  const restore = trpc.trash.restore.useMutation();

  return async (
    item: { id: number; name?: string | null },
    remove: (id: number) => Promise<unknown>
  ) => {
    const noun = nouns[table];
    const ok = await confirm({
      title: `نقل ${noun} إلى سلة المحذوفات؟`,
      description: item.name
        ? `«${item.name}» لن يظهر في القوائم والتقارير، ويمكن استرجاعه لاحقاً.`
        : "لن يظهر في القوائم والتقارير، ويمكن استرجاعه لاحقاً.",
      confirmLabel: "نقل إلى السلة",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove(item.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الحذف");
      return;
    }
    onChanged();
    toast.success(`نُقل ${noun} إلى سلة المحذوفات`, {
      duration: 6000,
      action: {
        label: "تراجع",
        onClick: () =>
          restore.mutate(
            { table, id: item.id },
            {
              onSuccess: () => {
                toast.success(`استُرجع ${noun}`);
                void utils.trash.list.invalidate();
                onChanged();
              },
              onError: error => toast.error(error.message),
            }
          ),
      },
    });
  };
}
