import { UserX } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { LegalContact, LegalPage, LegalSection } from "@/components/LegalPage";

/**
 * صفحة حذف الحساب العامة (/delete-account). Google Play يطلب رابطاً يُفتح دون تثبيت التطبيق
 * ويشرح طريقة الحذف وما يُحذف وما يبقى.
 */
export default function DeleteAccountInfo() {
  const { isAuthenticated, user } = useAuth();
  return (
    <LegalPage
      icon={UserX}
      title="حذف حسابك في ترتيل"
      intro="تستطيع حذف حسابك بنفسك في أي وقت، من الموقع أو من تطبيق أندرويد. الحذف نهائي ولا يمكن التراجع عنه."
    >
      {isAuthenticated && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            أنت داخل بحساب «
            <strong className="text-foreground">{user?.name}</strong>»، ويمكنك
            حذفه من هنا مباشرة.
          </p>
          <DeleteAccountCard />
        </div>
      )}
      <LegalSection title="طريقة الحذف">
        <ol className="list-decimal space-y-2">
          <li>سجّل الدخول إلى ترتيل من الموقع أو من تطبيق أندرويد.</li>
          <li>
            افتح «الإعدادات ← حذف الحساب»، أو عُد إلى هذه الصفحة (رابطها في أسفل
            صفحة البداية وفي إعدادات التطبيق).
          </li>
          <li>
            اكتب عبارة التأكيد «احذف حسابي» وكلمة مرورك، ثم اضغط «حذف حسابي
            نهائياً».
          </li>
        </ol>
        {!isAuthenticated && (
          <a
            href="/login"
            className="btn-gold mt-2 inline-flex min-h-11 items-center px-5 text-sm"
          >
            تسجيل الدخول
          </a>
        )}
        <p className="text-sm text-muted-foreground">
          لا تستطيع الدخول إلى حسابك؟ راسلنا من البريد أو الرقم المسجل في الحساب
          وسنحذفه خلال 30 يوماً بعد التحقق من أنه لك:
        </p>
        <LegalContact />
      </LegalSection>

      <LegalSection title="ما يُحذف">
        <ul>
          <li>اسمك وبريدك ورقم هاتفك وكلمة مرورك وربط حساب Google.</li>
          <li>علاماتك وملاحظاتك وآياتك المفضلة في المصحف، وإشعاراتك.</li>
          <li>عضوياتك في المراكز وصلاحياتك، وربطك بأبنائك إن كنت ولي أمر.</li>
          <li>عنوان IP ونوع المتصفح المرتبطان بحسابك في سجلات الأمان.</li>
        </ul>
      </LegalSection>

      <LegalSection title="ما يبقى">
        <ul>
          <li>
            السجلات التعليمية التي يملكها المركز، مثل ملف الطالب وحضوره وحفظه
            وتقييمه، تبقى لدى المركز دون ارتباط بحسابك. لحذفها اطلب ذلك من إدارة
            مركزك.
          </li>
          <li>
            سجل بأن حساباً محذوفاً نفّذ عمليات سابقة، دون أي بيانات تعرّف به،
            لسلامة سجل التدقيق.
          </li>
          <li>
            النسخ الاحتياطية القديمة تُحذف تلقائياً بعد انتهاء مدة الاحتفاظ (14
            يوماً افتراضياً).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="حالات تحتاج خطوة قبل الحذف">
        <ul>
          <li>
            إن كنت المدير الوحيد لمركز: أضف مديراً آخر أو احذف المركز أولاً حتى
            لا يبقى بلا إدارة.
          </li>
          <li>
            حساب المدير العام للمنصة لا يُحذف من الواجهة؛ يوقفه مدير عام آخر.
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
