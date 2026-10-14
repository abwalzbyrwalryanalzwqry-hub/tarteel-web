# ترتيل ويب

منصة لإدارة مراكز وحلقات تحفيظ القرآن الكريم: المراكز والحلقات والمعلمون والطلاب، الجلسات اليومية (الحضور والحفظ والمراجعة والتقييم بالميزان)، التقارير وتصديرها إلى Excel وPDF، المصحف المرئي، ومساعد ذكي اختياري.

## التقنيات

| الطبقة | الأدوات |
|---|---|
| الواجهة | React 19، Vite، Tailwind CSS 4، Radix UI، wouter، TanStack Query |
| الخادم | Node.js 22، Express، tRPC 11، Zod |
| البيانات | MySQL 8 عبر Drizzle ORM (الترحيلات في `drizzle/`) |
| الدخول | بريد وكلمة مرور (scrypt) وجلسات JWT، مع رموز الدعوة وأكواد الدخول |
| التخزين | قرص محلي أو S3/R2 (`STORAGE_DRIVER`) |
| الاختبارات | Vitest، ومنها اختبارات تكامل على MySQL حقيقية |

## التشغيل محلياً

يلزم Node.js 22 وpnpm 10 وقاعدة MySQL 8.

```bash
pnpm install
cp .env.example .env            # املأ DATABASE_URL وJWT_SECRET على الأقل
pnpm exec drizzle-kit migrate   # ينشئ الجداول
pnpm auth:create-admin --email you@example.com --name "اسمك"
pnpm dev                        # http://localhost:3000
```

## الأوامر

| الأمر | ما يفعله |
|---|---|
| `pnpm dev` | الخادم والواجهة مع إعادة التحميل التلقائي |
| `pnpm build` ثم `pnpm start` | بناء الإنتاج وتشغيله |
| `pnpm check` | فحص الأنواع (TypeScript) |
| `pnpm lint` | ESLint |
| `pnpm test` | الاختبارات؛ اضبط `TEST_DATABASE_URL` لتشغيل اختبارات التكامل على MySQL |
| `pnpm exec drizzle-kit generate --name وصف` | ترحيل جديد بعد تعديل `drizzle/schema.ts` |
| `pnpm auth:setup-link` | رابط تعيين كلمة مرور لمستخدم موجود |
| `pnpm assets:import` | نسخ الملفات المرفوعة من استضافة سابقة |

## بنية المستودع

```
client/            الواجهة (React)
  src/pages/       صفحة لكل مسار، تُحمَّل عند فتحها
  src/components/  المكونات المشتركة
server/
  _core/           الإقلاع، السياق، الكوكيز، السجلات، الاتصال بنموذج اللغة
  auth/            الدخول المحلي والتسجيل برمز دعوة
  routers.ts       موجّه tRPC الجذري
  routers/         موجّهات المجالات (المراكز، الحلقات، الجلسات، الصلاحيات، التقارير…)
  data/            استعلامات قاعدة البيانات حسب المجال
  export/ reports/ تصدير Excel وPDF والتقارير
  integration/     اختبارات التكامل على MySQL
shared/            شيفرة مشتركة بين الواجهة والخادم (الصلاحيات، الميزان، التواريخ…)
drizzle/           المخطط والترحيلات
deploy/            إعداد Caddy
mobile-android/    تطبيق أندرويد (Expo)
docs/              الأدلة (انظر docs/README.md)
```

## النشر

خادم واحد بـ Docker Compose (التطبيق وMySQL وCaddy مع HTTPS تلقائي). التفاصيل والمتغيرات وقائمة الاختبار في [docs/self-hosting-ar.md](docs/self-hosting-ar.md).

## المساهمة

- كل طلب دمج يمر على CI: فحص الثغرات، والأنواع، وESLint، وتنسيق Prettier للملفات الجديدة، والترحيلات على MySQL، والاختبارات، والبناء.
- أي تعديل في `drizzle/schema.ts` يحتاج ترحيلاً مولّداً معه، وإلا يفشل CI.
- النصوص الظاهرة للمستخدم بالعربية.
