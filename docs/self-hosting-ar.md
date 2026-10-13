# تشغيل ترتيل على خادمك

ترتيل الآن مستقل بالكامل: لا يحتاج أي خدمة خارجية للعمل. كل شيء يُضبط من `.env` (انظر `.env.example`).

| الوظيفة | التنفيذ | الإعداد |
|---|---|---|
| تسجيل الدخول | بريد + كلمة مرور (scrypt، قفل بعد 8 محاولات، حد لكل IP، سجل تدقيق) | `JWT_SECRET`, `ALLOW_SIGNUP`, `TRUST_PROXY_HOPS` |
| حدود الاستخدام | حد المحاولات لكل IP وحصة المساعد اليومية محفوظان في MySQL (جدولا `rate_limit_buckets` و`ai_daily_usage`) فيبقيان بعد إعادة التشغيل | `AI_DAILY_LIMIT` |
| الملفات (المصحف، التفسير، الخطوط، الشعارات) | تُخدم من `/storage/` | `STORAGE_DRIVER=local` + `STORAGE_DIR`، أو `s3` (S3/R2/B2/MinIO) |
| المساعد الذكي | أي خدمة متوافقة مع OpenAI | `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| إشعارات المالك | Webhook عام | `OWNER_NOTIFY_WEBHOOK_URL` |
| النشر | Docker | `Dockerfile` + `docker-compose.yml` (التطبيق + MySQL 8 + Caddy بشهادة HTTPS تلقائية) |
| تطبيق أندرويد | يفتح المنصة من عنوان خادمك | `TARTEEL_SERVER_URL` وقت البناء، أو من «الإعدادات» داخل التطبيق |

## 1. قبل الانتقال (على الاستضافة الحالية)

1. **نسخة احتياطية:** حمّل النسخة الرسمية (قاعدة البيانات + الملفات + الأسرار)، واحفظ `JWT_SECRET` و`DATABASE_URL`.
2. **كلمات المرور:** انشر الفرع `main` الحالي على الاستضافة القديمة؛ صفحة الدخول فيه تعرض البريد وكلمة المرور إلى جانب الطريقة القديمة. اطلب من المستخدمين: «الإعدادات ← كلمة المرور ← عيّن كلمة مرور». للمتأخرين: «إدارة الوصول ← رابط كلمة المرور» (صالح 72 ساعة).
   ```sql
   SELECT COUNT(*) AS without_password FROM users u LEFT JOIN local_credentials c ON c.userId = u.id
   WHERE c.id IS NULL AND u.deletedAt IS NULL AND u.isActive = 1;
   ```
3. **تفريغ القاعدة:** `mysqldump --single-transaction --routines --triggers` كاملاً.

## 2. الخادم الجديد

VPS واحد (2 vCPU، 4GB RAM، 40GB، Ubuntu 24.04) يكفي.

```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/abwalzbyrwalryanalzwqry-hub/tarteel-web.git && cd tarteel-web
cp .env.example .env && nano .env      # JWT_SECRET, APP_DOMAIN, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD
docker compose up -d db
docker compose exec -T db mysql -utarteel -p"$MYSQL_PASSWORD" tarteel < tarteel-dump.sql
docker compose up -d --build           # يطبق الترحيلات (0016 توحّد روابط الشعارات، 0017 تضيف إصدار الجلسة)
# على خادم جديد بلا قاعدة قديمة: أنشئ المدير العام (تُطبع كلمة مرور مؤقتة مرة واحدة)
docker compose exec app pnpm auth:create-admin --email you@example.com --name "اسمك"
```

> **الجلسات:** مدتها 30 يوماً وتتجدد تلقائياً مع الاستخدام. تغيير كلمة المرور يُخرج الأجهزة الأخرى، وفي الإعدادات زر «الخروج من كل الأجهزة». الجلسات الصادرة قبل الترحيل 0017 تُرفض، فيدخل كل مستخدم مرة واحدة من جديد. العملاء الذين يرسلون الجلسة في ترويسة `Authorization: Bearer` يستلمون الرمز المجدَّد في ترويسة الاستجابة `X-Session-Token`، وعليهم حفظه بدل القديم.

> **التسجيل العام مغلق افتراضياً** (`ALLOW_SIGNUP=false`)، لكن من وصله رمز دعوة معلم (`TRTL-…`) أو كود دخول (`TRT-…`) من المركز يستطيع إنشاء حساب بنفسه من تبويب «حساب جديد» في صفحة الدخول؛ يُفحص الرمز قبل إنشاء الحساب ويُسترد معه مباشرة، وإن فشل الاسترداد يُلغى الحساب. اجعل `ALLOW_SIGNUP=true` فقط إن أردت السماح لأي شخص بإنشاء حساب بلا رمز.

> **الوكيل العكسي:** `TRUST_PROXY_HOPS=1` يفترض وكيلاً واحداً بالضبط أمام الخادم (Caddy في `docker-compose.yml`). منه يُحسب عنوان IP لحد المحاولات، ومنه يُعرف أن الطلب HTTPS لعلامة `Secure` في كوكي الجلسة. لا تفتح منفذ التطبيق 3000 للعامة، وإن وضعت أمامه وكيلاً إضافياً (مثل Cloudflare) فاجعل القيمة 2.

**الملفات:** انسخها من الاستضافة القديمة (كانت تحت مسار `/manus-storage/`)، فتُعاد كتابة الروابط داخل ملفات المصحف تلقائياً:

```bash
pnpm assets:import --from https://النطاق-القديم --source-prefix /manus-storage/ --out ./data/uploads
docker compose cp ./data/uploads/. app:/data/uploads/
```

أضف شعارات المراكز بـ `--keys-file` (الاستعلام في رأس `scripts/import-assets.ts`).

## خط الواجهة (ثمانية)

الواجهة مصممة على خط «ثمانية للنصوص»، لكن ملفاته **ليست في المستودع**: [ترخيص ثمانية](https://font.thmanyah.com/licenses-en) يمنع رفعها أو استضافتها لإعادة التوزيع. دون الملفات تعمل الواجهة بخطوط النظام العربية (Noto Naskh Arabic أو Segoe UI أو Tahoma)، ومن ثبّت الخط على جهازه يراه تلقائياً.

إن قررت إدارة المركز استخدام الخط على الخادم بعد مراجعة الترخيص (أو بإذن من ثمانية عبر ask@thmanyah.com)، ضع ملفات woff2 في `STORAGE_DIR` بهذه الأسماء:

```
thmanyahseriftext-Light_bb4bb1fe.woff2
thmanyahseriftext-Regular_f5aef1ee.woff2
thmanyahseriftext-Medium_be200abb.woff2
thmanyahseriftext-Bold_6c86ea07.woff2
thmanyahseriftext-Black_99238822.woff2
```

## 3. قائمة الاختبار

- [ ] `curl https://$APP_DOMAIN/api/health` ← `{"ok":true}`
- [ ] دخول مدير ومعلم وطالب بكلمات المرور
- [ ] صفحات المصحف (1، 300، 604) والتفسير والخطوط
- [ ] جلسة: حضور وحفظ ومراجعة ثم اعتماد
- [ ] تقرير PDF بشعار المركز، ورفع شعار جديد يبقى بعد إعادة التشغيل
- [ ] كود وصول ورابط دعوة معلم
- [ ] تطبيق أندرويد: «الإعدادات ← عنوان الخادم» ← النطاق الجديد

## الأداء وعامل الخدمة

- كل صفحة تُحمَّل عند فتحها فقط، والمكتبات الكبيرة في ملفات مستقلة (`vendor-*`) تبقى في ذاكرة المتصفح عبر النشرات.
- ملفات `/assets/` تُرسل مع `Cache-Control: immutable` لسنة؛ و`index.html` و`sw.js` مع `no-cache` حتى تصل كل نسخة جديدة فوراً.
- عامل الخدمة (`client/public/sw.js`) يحفظ الواجهة لتفتح عند انقطاع الشبكة، ولا يحفظ أبداً `/api/` ولا `/storage/`. لإيقافه: `VITE_DISABLE_SW=true` ثم أعد البناء؛ الواجهة حينها تلغي تسجيله عند المستخدمين.
- إحصاءات Umami اختيارية: اضبط `VITE_ANALYTICS_ENDPOINT` و`VITE_ANALYTICS_WEBSITE_ID` عند البناء.

## 4. بعد النقل

- نسخ احتياطي يومي:
  ```bash
  0 3 * * * cd ~/tarteel-web && docker compose exec -T db mysqldump --single-transaction -utarteel -p"$MYSQL_PASSWORD" tarteel | gzip > ~/backups/tarteel-$(date +\%F).sql.gz && find ~/backups -mtime +14 -delete
  ```
- مراقبة `/api/health` كل 5 دقائق.
- متغير المستودع `TARTEEL_SERVER_URL` = النطاق الجديد، حتى تفتحه نسخ أندرويد القادمة مباشرة.
