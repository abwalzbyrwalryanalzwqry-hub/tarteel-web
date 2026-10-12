# خطة نقل ترتيل خارج Manus

> الهدف: تشغيل ترتيل على خادم تملكه أنت، بلا أي اعتماد على Manus، دون فقدان بيانات ودون حجب أي مستخدم عن الدخول.
> المدة المتوقعة: 5–8 أيام عمل، منها يومان انتظار لتعيين المستخدمين كلمات مرورهم.

## 0. ما أُنجز في الكود (فرع `feat/independent-auth-hosting`)

| الاعتماد على Manus | قبل | بعد |
|---|---|---|
| تسجيل الدخول | Manus OAuth فقط | بريد + كلمة مرور داخل ترتيل (scrypt، قفل بعد 8 محاولات، حد لكل IP، سجل تدقيق). Manus اختياري للانتقال |
| المستخدمون الحاليون | مرتبطون بـ openId من Manus | يعيّنون كلمة مرور من «الإعدادات»، أو برابط لمرة واحدة من المدير (72 ساعة)، أو `pnpm auth:setup-link` |
| صفحات المصحف والتفسير والخطوط (1821 ملفاً، ~400MB) | تخزين Manus | `pnpm assets:export` ينسخها إلى قرص الخادم وتُخدم بالروابط نفسها `/manus-storage/...` |
| رفع الشعارات | Forge Storage | `STORAGE_DRIVER=local` أو `s3` (S3/R2/B2/MinIO) |
| المساعد الذكي | Forge LLM | أي خدمة متوافقة مع OpenAI: `LLM_API_URL` + `LLM_API_KEY` + `LLM_MODEL` |
| إشعارات المالك | Forge Notification | `OWNER_NOTIFY_WEBHOOK_URL` أو سجل الخادم |
| سكربت Manus في كل صفحة | يُحقن تلقائياً | يُستبعد بـ `DISABLE_MANUS_RUNTIME=1` (مفعّل في Dockerfile) |
| النشر | Manus فقط | `Dockerfile` + `docker-compose.yml` (التطبيق + MySQL 8 + Caddy بشهادة HTTPS تلقائية) |

إصلاح مرافق: ملف الترحيل `drizzle/0008_purple_kylun.sql` كان يحوي أمرين بلا فاصل، فيفشل إنشاء قاعدة بيانات جديدة من الصفر على أي خادم. أُصلح وتم التحقق من تطبيق كل الترحيلات (0000–0015) على قاعدة فارغة.

**الأمان أثناء الانتقال:** إن لم يُضبط `AUTH_PROVIDER`، يعمل ترتيل تلقائياً بوضع `hybrid` على Manus (لوجود `OAUTH_SERVER_URL`)، وبوضع `local` خارجه. أي أن دمج الفرع ونشره على Manus لا يحجب أحداً.

## 1. تأمين نسخ احتياطية (اليوم الأول — قبل أي تغيير)

1. **النسخة الرسمية من Manus:** Backup & Restoration ← Task Data Backup، وتشمل قاعدة البيانات وملفات التخزين والأسرار. احفظ الحزم كما هي دون إعادة تسمية.
2. **تفريغ قاعدة البيانات:** من محادثة المشروع في Manus اطلب:
   «نفّذ `mysqldump --single-transaction --routines --triggers` كاملاً لقاعدة بيانات المشروع وأعطني ملف .sql للتنزيل».
   أو انسخ `DATABASE_URL` من تبويب Secrets ونفّذ التفريغ بنفسك.
3. **الأسرار:** صوّر تبويب Secrets واحفظ القيم في مدير كلمات مرور، وخاصة `JWT_SECRET` و`DATABASE_URL`.
4. **الملفات:**
   ```bash
   pnpm assets:export --from https://tarteel-qura-8kmxg5hu.manus.space --out ./data/uploads
   ```
   أضف شعارات المراكز: نفّذ الاستعلام الموجود في رأس `scripts/export-manus-assets.ts` ومرّر الناتج بـ `--keys-file`.
5. **الكود:** وسم git: `git tag pre-migration-$(date +%F) && git push --tags`.

✅ معيار الإنجاز: ملف .sql يفتح ويحوي جدول `users`، ومجلد `data/uploads` فيه 1821 ملفاً أو أكثر، والسكربت خرج بلا أخطاء.

## 2. تعيين كلمات المرور وأنت ما زلت على Manus (الأيام 2–4)

1. ادمج طلب الدمج وانشر على Manus كالمعتاد. يظهر في صفحة الدخول نموذج البريد وكلمة المرور، ومعه زر «الدخول بالطريقة السابقة (Manus)».
2. أرسل للمستخدمين: «ادخل كالمعتاد ← الإعدادات ← كلمة المرور ← عيّن كلمة مرور».
3. للمتأخرين: من «إدارة الوصول» يضغط المدير «رابط كلمة المرور» بجانب العضو، فيُنسخ رابط صالح 72 ساعة يرسله عبر واتساب.
4. تابع النسبة:
   ```sql
   SELECT COUNT(*) AS without_password
   FROM users u LEFT JOIN local_credentials c ON c.userId = u.id
   WHERE c.id IS NULL AND u.deletedAt IS NULL AND u.isActive = 1;
   ```

✅ معيار الإنجاز: كل المدراء والمشرفين والمعلمين لديهم كلمة مرور. الطلاب وأولياء الأمور يمكن إرسال روابط لهم لاحقاً.

## 3. تجهيز الخادم الجديد (اليوم 3، بالتوازي)

**الخيار الموصى به: خادم VPS واحد** (2 vCPU، 4GB RAM، 40GB قرص، Ubuntu 24.04) من أي مزود (Hetzner, Contabo, DigitalOcean...).

```bash
# على الخادم
curl -fsSL https://get.docker.com | sh
git clone https://github.com/abwalzbyrwalryanalzwqry-hub/tarteel-web.git && cd tarteel-web
cp .env.example .env && nano .env    # املأ: JWT_SECRET, OWNER_EMAIL, APP_DOMAIN, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD
docker compose up -d db              # قاعدة البيانات أولاً
```

- **النطاق:** سجّل نطاقاً، مثلاً `tarteel.app`، ووجّه سجل A إلى IP الخادم. يصدر Caddy شهادة HTTPS تلقائياً.
- **بديل بلا إدارة خوادم:** Railway أو Render للتطبيق، مع MySQL مُدار (TiDB Cloud Serverless أو Aiven). عندها اجعل `STORAGE_DRIVER=s3` مع Cloudflare R2، لأن قرص هذه المنصات مؤقت.

## 4. نقل البيانات والتجربة على نطاق مؤقت (اليوم 4–5)

```bash
docker compose exec -T db mysql -utarteel -p"$MYSQL_PASSWORD" tarteel < tarteel-dump.sql
docker compose cp ./data/uploads/. app:/data/uploads/     # أو انسخ إلى مجلد الحجم
docker compose up -d --build                             # يطبق الترحيلات (0015 تضيف جداول الدخول) ثم يشغّل
curl https://$APP_DOMAIN/api/health                      # {"ok":true,"auth":"local"}
```

قارن عدد الصفوف بين القديم والجديد في الجداول الحرجة: `users`, `students`, `sessions`, `memorization`, `revision`, `attendance`, `evaluation`, `access_codes`.

**قائمة الاختبار** (استخدم نطاقاً فرعياً مؤقتاً مثل `new.tarteel.app`):
- [ ] دخول مدير ومعلم وطالب بكلمات المرور التي عيّنوها على Manus
- [ ] عرض صفحات المصحف (1، 300، 604) والتفسير والخطوط العربية
- [ ] إنشاء جلسة وتسجيل حضور وحفظ ومراجعة ثم اعتمادها
- [ ] تقرير PDF مع شعار المركز
- [ ] استرداد كود وصول جديد ورابط دعوة معلم
- [ ] رفع شعار جديد يظهر بعد إعادة تشغيل الحاوية (الحجم دائم)
- [ ] المساعد الذكي (إن ضُبط `LLM_*`)

## 5. يوم التحويل (ساعة صيانة واحدة)

1. أعلن نافذة صيانة، ثم أوقف الكتابة على نسخة Manus (اطلب من المدراء عدم الإدخال).
2. تفريغ نهائي من Manus ← استيراد في قاعدة فارغة جديدة ← مقارنة الأعداد.
3. أعد تشغيل `pnpm assets:export` (يتخطى الموجود وينسخ الجديد فقط).
4. شغّل التطبيق على النطاق النهائي، ونفّذ قائمة الاختبار المختصرة.
5. **تطبيق أندرويد (غلاف Capacitor):** غيّر `server.url` في `android-wrapper/capacitor.config.ts` إلى النطاق الجديد، وابنِ نسخة جديدة. التطبيق الأصلي (`mobile-android`) يعمل دون اتصال حالياً ولا يتأثر.
6. ضع على Manus صفحة تحويل أو رسالة «انتقلنا إلى tarteel.app».

## 6. بعد النقل

- احذف متغيرات Manus من `.env`: `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_*`.
- **نسخ احتياطي يومي** (cron على الخادم):
  ```bash
  0 3 * * * cd ~/tarteel-web && docker compose exec -T db mysqldump --single-transaction -utarteel -p"$MYSQL_PASSWORD" tarteel | gzip > ~/backups/tarteel-$(date +\%F).sql.gz && find ~/backups -mtime +14 -delete
  ```
  وانسخ `~/backups` ومجلد الرفوعات أسبوعياً إلى مكان خارج الخادم.
- مراقبة: فحص `/api/health` كل 5 دقائق (UptimeRobot أو ما يماثله).
- لاحقاً: إرسال روابط تعيين كلمة المرور بالبريد تلقائياً (Resend أو SMTP) بدل نسخها يدوياً.

## خطة التراجع

نسخة Manus تبقى كما هي حتى يمر أسبوعان على التحويل دون مشاكل. للتراجع: أعد توجيه المستخدمين إلى رابط manus.space. أي بيانات أُدخلت بعد التحويل تُصدَّر من الخادم الجديد وتُستورد يدوياً.

## المخاطر المعروفة

| الخطر | التخفيف |
|---|---|
| تعذّر الحصول على تفريغ قاعدة البيانات من Manus | Task Data Backup الرسمي يتضمن القاعدة، والبديل طلب التفريغ من وكيل المشروع |
| مستخدمون لم يعيّنوا كلمة مرور قبل التحويل | روابط المدير أو `pnpm auth:setup-link --email ...` تعمل بعد النقل أيضاً |
| ملفات رفعها مستخدمون ولم تُنسخ | `--keys-file` بمفاتيح الشعارات من القاعدة. الملف المفقود يعيد 404 ولا يعطل الصفحة |
| انقطاع أو تغيير في خدمة Manus قبل اكتمال النقل | الخطوة 1 (النسخ الاحتياطي) أولاً ودون تأجيل |
