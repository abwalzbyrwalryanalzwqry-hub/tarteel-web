import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { AI_OUT_OF_SCOPE_REPLY, isTarteelAiInScope } from "../shared/aiScope";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 77,
    openId: "ai-test-user",
    email: "teacher@tarteel.test",
    name: "معلم الاختبار",
    loginMethod: "manus",
    role: "teacher",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("نطاق مرشد ترتيل الذكي", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يقبل الأسئلة التي تخدم الحفظ والحلقات وإدارة المركز", () => {
    expect(isTarteelAiInScope("كيف أعد خطة مراجعة لطالب في حلقة القرآن؟")).toBe(true);
    expect(isTarteelAiInScope("ما أفضل إجراء لمتابعة غياب الطلاب المتكرر؟")).toBe(true);
  });

  it("يرفض الأسئلة العامة غير المرتبطة بخدمات ترتيل", () => {
    expect(isTarteelAiInScope("كيف أطبخ وجبة صحية؟")).toBe(false);
    expect(isTarteelAiInScope("ما حالة الطقس اليوم؟")).toBe(false);
  });

  it("يعيد صيغة الرفض المعتمدة دون استدعاء النموذج خارج النطاق", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.ai.chat({
      context: "general",
      messages: [{ role: "user", content: "اكتب لي وصفة معكرونة" }],
    });

    expect(result).toMatchObject({ answer: AI_OUT_OF_SCOPE_REPLY, inScope: false });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("يمرر السؤال المتخصص إلى النموذج مع سياسة النظام", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "ابدأ بتحديد ورد يومي ثم راقب المراجعة الأسبوعية." } }],
    } as never);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.ai.chat({
      context: "students",
      messages: [{ role: "user", content: "اقترح خطة حفظ مناسبة لطالب مبتدئ" }],
    });

    expect(result.inScope).toBe(true);
    expect(result.answer).toContain("ورد يومي");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });
});
