/**
 * جلسة قسم المصحف في ترتيل: بديل useSession في زِن (جلسة Supabase) فوق حساب ترتيل نفسه (useAuth).
 * داخل المنصة لا يُفتح القسم إلا بحساب (MushafApp يحوّل غير المسجّل إلى الدخول). وفي «المصحف
 * المستقل» (تبويب المصحف في تطبيق أندرويد) يعمل بوضع الضيف كما في زِن، دون حساب ودون أي طلب للخادم.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { STANDALONE_MUSHAF } from "@/mushaf/lib/standalone";

const GUEST_SESSION = {
  session: null,
  userId: null,
  guest: true,
  loading: false,
  offline: false,
} as const;

function useGuestSession() {
  return GUEST_SESSION;
}

function useAccountSession() {
  const { user, loading } = useAuth();
  return {
    session: user,
    userId: user ? String(user.id) : null,
    guest: false,
    loading,
    offline: false,
  };
}

/** ثابت طوال عمر الصفحة، فلا يتبدّل ترتيب الخطافات بين رسم وآخر. */
export const useSession: () => {
  session: unknown;
  userId: string | null;
  guest: boolean;
  loading: boolean;
  offline: boolean;
} = STANDALONE_MUSHAF ? useGuestSession : useAccountSession;
