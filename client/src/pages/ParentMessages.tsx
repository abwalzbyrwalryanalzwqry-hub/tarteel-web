import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { createSmsUrl, createWhatsAppUrl, PARENT_MESSAGE_TEMPLATES, renderParentMessage, type ParentMessageTemplateKey } from "../../../shared/messageTemplates";
import { CheckCircle2, MessageCircle, MessageSquareText, Send, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function ParentMessages() {
  const { data: students } = trpc.students.list.useQuery({});
  const { data: circles } = trpc.circles.list.useQuery({ branchId: undefined, seasonId: undefined });
  const [studentId, setStudentId] = useState<number | undefined>();
  const [templateKey, setTemplateKey] = useState<ParentMessageTemplateKey>("achievement");
  const [period, setPeriod] = useState("هذا الشهر");
  const [message, setMessage] = useState("");

  const selectedStudent = students?.find((student) => student.id === studentId);
  const selectedCircle = circles?.find((circle) => circle.id === selectedStudent?.circleId);
  const activeTemplate = PARENT_MESSAGE_TEMPLATES.find((template) => template.key === templateKey) ?? PARENT_MESSAGE_TEMPLATES[0];
  const renderedTemplate = useMemo(() => renderParentMessage(activeTemplate.content, { studentName: selectedStudent?.name, circleName: selectedCircle?.name, period }), [activeTemplate.content, period, selectedCircle?.name, selectedStudent?.name]);

  useEffect(() => setMessage(renderedTemplate), [renderedTemplate]);

  const guardianPhone = selectedStudent?.guardianPhone || selectedStudent?.phone;
  const ensureContact = () => {
    if (!selectedStudent) { toast.error("اختر الطالب أولاً"); return false; }
    if (!guardianPhone) { toast.error("لا يوجد رقم تواصل مسجل لولي أمر هذا الطالب"); return false; }
    return true;
  };

  const openWhatsApp = () => {
    if (!ensureContact()) return;
    window.open(createWhatsAppUrl(guardianPhone!, message), "_blank", "noopener,noreferrer");
  };

  const openSms = () => {
    if (!ensureContact()) return;
    window.location.href = createSmsUrl(guardianPhone!, message);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <section className="rounded-3xl border border-primary/15 bg-gradient-to-l from-primary/10 via-card to-emerald-500/10 p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl gold-gradient shadow-lg"><MessageSquareText className="h-7 w-7 text-white" /></div><div><h1 className="font-display text-3xl font-bold text-foreground">رسائل أولياء الأمور</h1><p className="mt-1 text-sm leading-7 text-muted-foreground">قوالب تواصل جاهزة تُراجع قبل فتح WhatsApp أو الرسائل النصية؛ لا يتم إرسال أي رسالة تلقائياً.</p></div></div><div className="flex items-center gap-2 rounded-2xl bg-background/70 px-4 py-3 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />إرسال يدوي تحت سيطرتك</div></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="glass-card rounded-2xl p-5"><h2 className="font-display text-lg font-bold text-foreground">اختيار الرسالة</h2><div className="mt-4 space-y-2">{PARENT_MESSAGE_TEMPLATES.map((template) => <button key={template.key} onClick={() => setTemplateKey(template.key)} className={`w-full rounded-xl border p-3 text-right transition-colors ${template.key === templateKey ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}><span className="block text-sm font-bold text-foreground">{template.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span></button>)}</div></aside>
        <main className="glass-card rounded-2xl p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-foreground">الطالب</label><select value={studentId ?? ""} onChange={(event) => setStudentId(event.target.value ? Number(event.target.value) : undefined)} className="tarteel-input"><option value="">اختر الطالب</option>{students?.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-foreground">الفترة</label><Input value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="مثال: هذا الشهر" /></div></div>
          {selectedStudent && <div className="mt-4 rounded-xl bg-muted/35 p-3 text-sm text-muted-foreground">سيتم تجهيز الرسالة إلى ولي أمر <strong className="text-foreground">{selectedStudent.name}</strong>{selectedCircle ? ` — ${selectedCircle.name}` : ""}.</div>}
          <div className="mt-5"><label className="mb-2 block text-sm font-medium text-foreground">معاينة الرسالة وتحريرها</label><Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-52 leading-8" /></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button onClick={openWhatsApp} className="min-h-11 flex-1 gap-2 bg-green-600 hover:bg-green-700"><MessageCircle className="h-4 w-4" />فتح WhatsApp</Button><Button onClick={openSms} variant="outline" className="min-h-11 flex-1 gap-2"><Smartphone className="h-4 w-4 text-primary" />فتح الرسائل النصية</Button></div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><Send className="mt-0.5 h-4 w-4 shrink-0 text-primary" />تفتح القناة المختارة مع النص المُعدّ مسبقاً، ثم تقرر أنت الإرسال من تطبيقك. إذا لم يكن التطبيق مثبتاً، قد يفتح المتصفح أو الواجهة الافتراضية للجهاز.</p>
        </main>
      </div>
    </div>
  );
}
