import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

/** يقرأ رقماً من عنوان الصفحة (مثل ?circleId=5)، أو undefined. */
export function useNumberParam(name: string): number | undefined {
  const search = useSearch();
  const value = Number(new URLSearchParams(search).get(name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * نموذج الإنشاء يُفتح مباشرة من رابط ?new=1 (الإجراءات السريعة في اللوحة وصفحة الحلقة)،
 * فيصل المستخدم إلى النموذج بنقرة واحدة. يُزال المعامل عند الإغلاق حتى لا يعود النموذج مع الرجوع.
 */
export function useCreateFormParam(): [boolean, (open: boolean) => void] {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const requested = new URLSearchParams(search).get("new") === "1";
  const [open, setOpenState] = useState(requested);

  useEffect(() => {
    if (requested) setOpenState(true);
  }, [requested]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next && requested) {
        const params = new URLSearchParams(search);
        params.delete("new");
        const rest = params.toString();
        navigate(rest ? `${location}?${rest}` : location, { replace: true });
      }
    },
    [location, navigate, requested, search]
  );

  return [open, setOpen];
}

/** يتذكر آخر اختيار (الحلقة مثلاً) على هذا الجهاز ليكون الاختيار الافتراضي في المرة التالية. */
export function rememberChoice(key: string, value: number | undefined) {
  try {
    if (value) localStorage.setItem(`tarteel:last:${key}`, String(value));
  } catch {
    /* التخزين غير متاح: لا بأس */
  }
}

export function recallChoice(key: string): number | undefined {
  try {
    const value = Number(localStorage.getItem(`tarteel:last:${key}`));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
