# نسخة الجهاز: ترتيل على أندرويد دون خادم

منذ الإصدار 0.3.0 يعمل تطبيق أندرويد مباشرة على الهاتف: لا يحتاج خادماً ولا اتصالاً بالإنترنت.
الواجهة نفسها ومنطق الخادم نفسه (`server/routers`) يعملان داخل WebView، والبيانات في قاعدة SQLite على الجهاز.

## كيف تعمل

- `pnpm build:local` (أي `vite build --mode device`) يبني الواجهة في `dist/local`، ويستبدل وقت البناء:
  `drizzle/schema.ts` بـ `drizzle/schema.sqlite.ts`، واتصال MySQL بـ `client/src/local/connection.ts` (sql.js)،
  ورابط tRPC عبر HTTP باستدعاء `appRouter` داخل الصفحة (`client/src/local/apiLink.ts`).
- `drizzle/schema.sqlite.ts` مولّد من `schema.ts`: بعد أي تعديل على المخطط شغّل `pnpm db:sqlite`
  ثم `pnpm exec drizzle-kit generate --config drizzle.sqlite.config.ts` لإنشاء ترحيل SQLite.
- تُحفظ القاعدة في IndexedDB بعد كل تعديل، ومعها نسخة ملف في مجلد التطبيق الخاص
  (`mobile-android/src/data/localDatabaseFile.ts`) تُستعاد إن مُسحت بيانات WebView.
- في أندرويد تُنسخ `dist/local` إلى `android/app/src/main/assets/web` وقت البناء في CI،
  ويخدمها رقعة `react-native-webview` من `https://appassets.androidplatform.net`.
- عدة حسابات على الجهاز نفسه: المدير ينشئ المركز وأكواد الوصول، ويسجّل المعلم أو المشرف بحسابه
  برقم الهاتف وكلمة المرور، فيرى كلٌّ ما تسمح به صلاحياته.

## ما لا يتوفر بعد في نسخة الجهاز

- تصدير PDF (تصدير Excel يعمل).
- الدخول بـ Google، ورموز SMS، واستعادة كلمة المرور بالبريد.
- المساعد الذكي.
- النسخ الاحتياطي والنقل بين الأجهزة والمزامنة مع خادم (المرحلة التالية).
  حتى ذلك الحين البيانات على هاتف واحد؛ حذف التطبيق أو مسح بياناته يحذفها.

يمكن ربط التطبيق بخادم مركز منشور من «الإعدادات ← الربط بخادم مركز (اختياري)»، والعودة إلى نسخة الجهاز في أي وقت.

## الاختبارات

```bash
pnpm build:local
cd e2e && npx playwright test -c playwright.device.config.ts
```
