import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import { Link } from "wouter";

type GuidanceContext = "dashboard" | "sessions" | "students" | "circles" | "reports";

const contextCopy: Record<GuidanceContext, { title: string; body: string }> = {
  dashboard: { title: "أولوية ذكية", body: "حوّل مؤشرات اليوم إلى خطوات عملية للحلقة أو المركز." },
  sessions: { title: "إرشاد للفترة", body: "احصل على تسلسل عملي للفترة أو فكرة تربوية للحضور والحفظ." },
  students: { title: "تطوير الطالب", body: "اطلب خطة مراجعة أو أسلوب تحفيز يناسب مستوى الطالب." },
  circles: { title: "تحسين الحلقة", body: "اطلب فكرة لتوزيع الطلاب أو نشاطاً قرآنياً مناسباً للحلقة." },
  reports: { title: "اقرأ الأرقام بذكاء", body: "حوّل نتائج الحضور والحفظ إلى قرارات قابلة للتطبيق." },
};

export function AIGuidanceCard({ context }: { context: GuidanceContext }) {
  const content = contextCopy[context];
  return (
    <section className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary/10 to-emerald-500/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">{content.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{content.body}</p>
          </div>
        </div>
        <Link href={`/assistant?context=${context}`}>
          <Button size="sm" variant="outline" className="shrink-0 gap-2 border-primary/30 bg-background/70">
            <Sparkles className="h-4 w-4 text-primary" />
            اسأل المرشد
          </Button>
        </Link>
      </div>
    </section>
  );
}
