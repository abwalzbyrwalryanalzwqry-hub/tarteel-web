/**
 * جلسة قسم المصحف في ترتيل: بديل useSession في زِن (جلسة Supabase) فوق حساب ترتيل نفسه (useAuth).
 * قسم المصحف لا يُفتح إلا بحساب (MushafApp يحوّل غير المسجّل إلى الدخول)، فلا وضع ضيف هنا.
 */
import { useAuth } from "@/_core/hooks/useAuth";

export function useSession() {
  const { user, loading } = useAuth();
  return {
    session: user,
    userId: user ? String(user.id) : null,
    guest: false,
    loading,
    offline: false,
  };
}
