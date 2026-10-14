import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** إجراء حذف أو نقل إلى السلة: زر التأكيد بلون التحذير. */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * نافذة تأكيد موحدة بدل window.confirm: بالعربية واتجاه RTL، وتعمل في WebView أندرويد،
 * وتُغلق بزر الرجوع أو Esc، وزر التأكيد يأخذ التركيز فيكفي Enter.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(next => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={Boolean(options)}
        onOpenChange={open => !open && settle(false)}
      >
        <AlertDialogContent dir="rtl" className="sm:max-w-md">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="font-display text-xl">
              {options?.title}
            </AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription className="leading-6">
                {options.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction
              autoFocus
              onClick={() => settle(true)}
              className={
                options?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {options?.confirmLabel ?? "تأكيد"}
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => settle(false)}>
              {options?.cancelLabel ?? "إلغاء"}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  // خارج المزوّد (الاختبارات مثلاً) نعود إلى نافذة المتصفح.
  return (
    confirm ??
    (async options =>
      window.confirm(
        [
          options.title,
          typeof options.description === "string" ? options.description : "",
        ]
          .filter(Boolean)
          .join("\n")
      ))
  );
}
