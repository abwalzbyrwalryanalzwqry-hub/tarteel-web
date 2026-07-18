import { startLogin } from "@/const";
import { BookOpen, Star } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden" dir="rtl">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"/>
      </div>

      {/* Islamic pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a84c' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}}/>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-card rounded-3xl p-8 text-center shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center shadow-lg">
              <BookOpen className="w-10 h-10 text-white"/>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">ترتيل</h1>
          <p className="text-muted-foreground text-lg mb-1">منصة إدارة مراكز تحفيظ القرآن الكريم</p>
          <div className="flex items-center justify-center gap-1 mb-8">
            {[1,2,3,4,5].map(i=><Star key={i} className="w-4 h-4 fill-primary text-primary"/>)}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 mb-8 text-right">
            {[
              { icon: "🕌", text: "إدارة المراكز والفروع" },
              { icon: "📖", text: "تتبع الحفظ والمراجعة" },
              { icon: "👥", text: "إدارة المعلمين والطلاب" },
              { icon: "📊", text: "تقارير وإحصائيات شاملة" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                <span className="text-xl">{f.icon}</span>
                <span className="text-xs text-muted-foreground">{f.text}</span>
              </div>
            ))}
          </div>

          {/* Login Button */}
          <button
            onClick={() => startLogin()}
            className="btn-gold w-full text-base py-3 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5"/>
            تسجيل الدخول
          </button>

          <p className="text-xs text-muted-foreground mt-4">
            بتسجيل الدخول، أنت توافق على شروط الاستخدام وسياسة الخصوصية
          </p>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
        </p>
      </div>
    </div>
  );
}
