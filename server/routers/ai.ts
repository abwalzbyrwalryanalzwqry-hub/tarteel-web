import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  AI_CONTEXT_LABELS,
  AI_OUT_OF_SCOPE_REPLY,
  type AiContext,
  isTarteelAiInScope,
} from "../../shared/aiScope";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

const contextSchema = z.enum(["general", "dashboard", "sessions", "students", "circles", "reports"]);

const assistantPolicy = (context: AiContext) => `
أنت «مرشد ترتيل الذكي» داخل منصة عربية لإدارة مراكز وحلقات تحفيظ القرآن الكريم.
نطاقك محصور حصراً في: الحفظ والمراجعة والتلاوة والتجويد والتربية القرآنية؛ إدارة المراكز والفروع والحلقات والجلسات والطلاب والمعلمين؛ تطوير مهارات الحفظ والتعلم ضمن المسار القرآني؛ واستخدام التقارير والحضور والنقاط والأنشطة في المنصة.
سياق الصفحة الحالية: ${AI_CONTEXT_LABELS[context]}.

التزم بما يلي:
1) أجب بالعربية الفصحى الواضحة وبأسلوب عملي محترم، مع خطوات قابلة للتطبيق داخل المنصة عند الإمكان.
2) لا تخترع أي بيانات عن مركز أو طالب أو جلسة. اذكر بوضوح البيانات التي يحتاجها المستخدم إذا كان الحل يعتمد عليها.
3) لا تقدّم فتوى أو حكماً شرعياً تفصيلياً؛ وجّه المستخدم إلى معلّم أو جهة علمية موثوقة عند الحاجة.
4) لا تُجب عن أي موضوع خارج النطاق. عند الشك، اكتب حصراً: «${AI_OUT_OF_SCOPE_REPLY}».
5) اجعل الإجابة موجزة، ثم أضف قسم «خطوات مقترحة» من 2 إلى 4 نقاط عند ملاءمة السؤال.
`;

export const aiRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(8),
        context: contextSchema.default("general"),
      })
    )
    .mutation(async ({ input }) => {
      const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";

      if (!isTarteelAiInScope(lastUserMessage)) {
        return {
          answer: AI_OUT_OF_SCOPE_REPLY,
          inScope: false,
          suggestions: [],
        };
      }

      const response = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 700,
        messages: [
          { role: "system", content: assistantPolicy(input.context) },
          ...input.messages,
        ],
      });

      const rawAnswer = response.choices[0]?.message?.content;
      const answer = (typeof rawAnswer === "string" ? rawAnswer.trim() : "") ||
        "تعذر توليد الإرشاد الآن. يرجى إعادة المحاولة بعد قليل.";

      return {
        answer,
        inScope: true,
        suggestions: [
          "اطلب خطة عملية قابلة للتنفيذ داخل المنصة",
          "اذكر الحلقة أو مستوى الطالب لتحصل على إرشاد أدق",
        ],
      };
    }),
});
