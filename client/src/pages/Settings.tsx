import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Bell, Building2, Code2, Moon, Settings as SettingsIcon, Sun, Type, Users } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme, fontScale, setFontScale } = useTheme();
  const { data: users } = trpc.users.list.useQuery();

  const createNotifMutation = trpc.notifications.create.useMutation({
    onSuccess: () => toast.success("تم إرسال الإشعار التجريبي"),
    onError: (e) => toast.error(e.message),
  });

  function sendTestNotification() {
    if (!user) return;
    createNotifMutation.mutate({
      userId: user.id,
      title: "إشعار تجريبي",
      message: "هذا إشعار تجريبي من إعدادات المنصة",
      type: "info",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-600 flex items-center justify-center"><SettingsIcon className="w-5 h-5 text-white"/></div>
        <div><h1 className="page-title">الإعدادات</h1><p className="page-subtitle">إدارة إعدادات المنصة والحساب</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary"/>معلومات الحساب</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
              <div className="w-14 h-14 rounded-full gold-gradient flex items-center justify-center text-white text-xl font-bold">
                {user?.name?.charAt(0) ?? "م"}
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{user?.name ?? "مستخدم"}</p>
                <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">{user?.role === "admin" ? "مدير" : "مستخدم"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                <span className="text-sm text-muted-foreground">معرف المستخدم</span>
                <span className="text-sm font-mono text-foreground">{user?.id}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                <span className="text-sm text-muted-foreground">آخر دخول</span>
                <span className="text-sm text-foreground">{user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString("ar-SA") : "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2">
            {theme === "dark" ? <Moon className="w-5 h-5 text-primary"/> : <Sun className="w-5 h-5 text-primary"/>}
            المظهر
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختر المظهر المناسب لك</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => theme === 'dark' && toggleTheme?.()}
                className={`p-4 rounded-xl border-2 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Sun className="w-6 h-6 mx-auto mb-2 text-amber-500"/>
                <p className="text-sm font-medium text-foreground">نهاري</p>
                <p className="text-xs text-muted-foreground">خلفية فاتحة</p>
              </button>
              <button
                onClick={() => theme === 'light' && toggleTheme?.()}
                className={`p-4 rounded-xl border-2 transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Moon className="w-6 h-6 mx-auto mb-2 text-blue-400"/>
                <p className="text-sm font-medium text-foreground">ليلي</p>
                <p className="text-xs text-muted-foreground">خلفية داكنة</p>
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Test */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Type className="w-5 h-5 text-primary"/>سهولة القراءة</h2>
          <p className="text-sm text-muted-foreground mb-4">اختر حجم الخط الذي يناسبك. يُحفظ التفضيل محلياً في هذا المتصفح.</p>
          <div className="grid grid-cols-3 gap-2">
            {(["small", "standard", "large"] as const).map((scale) => (
              <button key={scale} onClick={() => setFontScale(scale)} className={`rounded-xl border-2 p-3 text-center transition-colors ${fontScale === scale ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                <span className={scale === "small" ? "text-sm" : scale === "large" ? "text-xl" : "text-base"}>{scale === "small" ? "صغير" : scale === "large" ? "كبير" : "قياسي"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Test */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-primary"/>الإشعارات</h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختبر نظام الإشعارات الداخلي</p>
            <button onClick={sendTestNotification} disabled={createNotifMutation.isPending} className="btn-gold w-full">
              {createNotifMutation.isPending ? "جارٍ الإرسال..." : "إرسال إشعار تجريبي"}
            </button>
          </div>
        </div>

        {/* Platform Info */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-primary"/>معلومات المنصة</h2>
          <div className="space-y-2">
            {[
              { label: "اسم المنصة", value: "ترتيل" },
              { label: "الإصدار", value: "1.0.0" },
              { label: "اللغة", value: "العربية" },
              { label: "الاتجاه", value: "من اليمين إلى اليسار (RTL)" },
              { label: "المطور", value: "أ. إدريس الزوقري" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Developer Information */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Code2 className="w-5 h-5 text-primary"/>عن المطور</h2>
          <p className="text-sm leading-6 text-muted-foreground">بيانات التواصل والدعم الفني الخاصة بمنصة ترتيل.</p>
          <Link href="/developer" className="mt-4 inline-flex">
            <span className="btn-gold inline-flex min-h-10 items-center px-4 text-sm">عرض بيانات المطور</span>
          </Link>
        </div>
      </div>

      {/* Users List (Admin only) */}
      {user?.role === "admin" && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-foreground text-lg mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary"/>المستخدمون المسجلون</h2>
          {!users || users.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">لا يوجد مستخدمون</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">الاسم</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">البريد</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">الدور</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">آخر دخول</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground">{u.name ?? "-"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{u.email ?? "-"}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.role==="admin"?"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400":"bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{u.role==="admin"?"مدير":"مستخدم"}</span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{new Date(u.lastSignedIn).toLocaleDateString("ar-SA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
