# اختبارات ترتيل من طرف إلى طرف

Playwright على الخادم المبني (`dist/`) وقاعدة MySQL حقيقية. الحزمة منفصلة عن اعتماديات التطبيق (لها `package-lock.json` خاص)، فلا تمس `pnpm-lock.yaml`.

| الملف | ما يغطيه |
|---|---|
| `tests/auth.spec.ts` | إنشاء حساب، رفض كلمة مرور خاطئة برسالة عربية، الدخول، حماية الصفحات |
| `tests/daily-session.spec.ts` | مركز جديد ← فترة اليوم ← حضور/غياب ← حفظ بتقدير ← اعتماد ← التقرير التنفيذي بالأرقام نفسها ← PDF صالح |

## التشغيل محلياً

```bash
pnpm build
DATABASE_URL=mysql://… pnpm exec drizzle-kit migrate
cd e2e && npm ci && npx playwright install chromium
DATABASE_URL=mysql://… npx playwright test        # يشغّل الخادم على 3100 بنفسه
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test   # أو على خادم يعمل مسبقاً (ALLOW_SIGNUP=true)
```

البيانات الأساسية (فرع، موسم، معلم، حلقة، طلاب) تُجهز عبر tRPC لأنها ليست موضوع الاختبار؛ أما الخطوات المختبرة فكلها عبر الواجهة. كل تشغيل ينشئ حسابات ومراكز جديدة بأسماء فريدة، فلا تحتاج القاعدة تنظيفاً.

عند الفشل في CI يُرفع `playwright-report` و`test-results` (لقطات وtrace) كأثر للتشغيل.
