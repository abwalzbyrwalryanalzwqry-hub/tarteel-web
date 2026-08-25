import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type AiContext = "general" | "dashboard" | "sessions" | "students" | "circles" | "reports";

const validContexts: AiContext[] = ["general", "dashboard", "sessions", "students", "circles", "reports"];

const promptsByContext: Record<AiContext, string[]> = {
  general: [
    "اقترح خطة أسبوعية لتحسين الحفظ والمراجعة في الحلقة.",
    "كيف أبني نظام تحفيز عادل للطلاب باستخدام النقاط والجوائز؟",
    "ما أفضل طريقة لمتابعة الطالب المتعثر في الحفظ؟",
  ],
  dashboard: [
    "كيف أقرأ مؤشرات الحضور والغياب في لوحة المعلومات؟",
    "اقترح أولويات إدارية لهذا الأسبوع لمركز التحفيظ.",
  ],
  sessions: [
    "اقترح تسلسلاً عملياً لإدارة فترة حفظ مدتها ساعة.",
    "كيف أتعامل تربوياً مع غياب الطالب المتكرر؟",
  ],
  students: [
    "كيف أضع خطة مراجعة مناسبة لطالب يحفظ ببطء؟",
    "ما البيانات التي ينبغي مراجعتها قبل تقييم تقدم الطالب؟",
  ],
  circles: [
    "كيف أوزع الطلاب في الحلقات بحسب المستوى والعمر؟",
    "اقترح نشاطاً قرآنياً قصيراً يعزز الالتزام بالحضور.",
  ],
  reports: [
    "كيف أستفيد من تقرير الحضور لتحسين انتظام الحلقة؟",
    "ما المؤشرات المناسبة لتقييم أداء المعلم دون ظلم؟",
  ],
};

function getContextFromSearch(search: string): AiContext {
  const context = new URLSearchParams(search).get("context") as AiContext | null;
  return context && validContexts.includes(context) ? context : "general";
}

export default function AIAssistant() {
  const [location] = useLocation();
  const context = useMemo(() => getContextFromSearch(location.split("?")[1] ?? ""), [location]);
  const [messages, setMessages] = useState<Message[]>([]);
  const chat = trpc.ai.chat.useMutation({
    onSuccess: (result: { answer: string }) => {
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    },
    onError: () => {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "تعذر تشغيل المرشد الذكي الآن. يرجى المحاولة لاحقاً." },
      ]);
    },
  });

  const sendMessage = (content: string) => {
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    chat.mutate({ messages: nextMessages.map(({ role, content: value }) => ({ role: role as "user" | "assistant", content: value })), context });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-l from-primary/10 via-card to-emerald-500/10 p-6 lg:p-8">
        <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gold-gradient shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold text-foreground">مرشد ترتيل الذكي</h1>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">متخصص</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                مساعد مخصص للحفظ والمراجعة والتعليم القرآني وإدارة المراكز والحلقات. يقدم إرشادات وأفكاراً عملية ضمن خدمات المنصة فقط.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-background/70 px-4 py-3 text-xs text-muted-foreground backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>الأسئلة خارج نطاق القرآن والمنصة تُرفض تلقائياً.</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <AIChatBox
          messages={messages}
          onSendMessage={sendMessage}
          isLoading={chat.isPending}
          height="640px"
          placeholder="اكتب سؤالك عن الحفظ أو الحلقة أو إدارة المركز..."
          emptyStateMessage="كيف يمكنني مساعدتك في خدمات ترتيل؟"
          suggestedPrompts={promptsByContext[context]}
          className="glass-card overflow-hidden rounded-3xl border-primary/10 shadow-xl"
        />

        <aside className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <BookOpenCheck className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">كيف يساعدك؟</h2>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              اطلب خطة للحفظ والمراجعة، فكرة لنشاط حلقة، قراءة عملية لتقرير، أو إرشاداً لإدارة الفترات والطلاب.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="text-sm font-semibold text-foreground">حدود المساعد</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              لا يجيب إلا في شؤون القرآن والتعليم وإدارة الحلقات. ولا يقدم فتاوى أو أحكاماً شرعية تفصيلية.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
