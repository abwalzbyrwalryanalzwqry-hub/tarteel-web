# تشغيل ترتيل على خادمك

ترتيل الآن مستقل بالكامل: لا يحتاج أي خدمة خارجية للعمل. كل شيء يُضبط من `.env` (انظر `.env.example`).

| الوظيفة | التنفيذ | الإعداد |
|---|---|---|
| تسجيل الدخول | بريد + كلمة مرور (scrypt، قفل بعد 8 محاولات، حد لكل IP، سجل تدقيق) | `JWT_SECRET`, `ALLOW_SIGNUP`, `TRUST_PROXY_HOPS` |
| حدود الاستخدام | حد المحاولات لكل IP وحصة المساعد اليومية محفوظان في MySQL (جدولا `rate_limit_buckets` و`ai_daily_usage`) فيبقيان بعد إعادة التشغيل | `AI_DAILY_LIMIT` |
| الملفات (المصحف، التفسير، الخطوط، الشعارات) | تُخدم من `/storage/` | `STORAGE_DRIVER=local` + `STORAGE_DIR`، أو `s3` (S3/R2/B2/MinIO) |
| المساعد الذكي | أي خدمة متوافقة مع OpenAI | `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| البريد التشغيلي (اختياري) | «نسيت كلمة المرور» برابط 30 دقيقة، وتأكيد البريد بعد التسجيل، عبر Resend أو Brevo | `RESEND_API_KEY` أو `BREVO_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL` |
| الدخول بـ Google (اختياري) | OpenID Connect مع PKCE؛ يُربط بالحساب الموجود فقط إن كان بريد Google مؤكداً | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_APP_URL` |
| ترويسات الأمان | CSP صارمة (`script-src 'self'`) وnosniff وPermissions-Policy من التطبيق نفسه | `CSP_MODE`, `CSP_EXTRA_SOURCES` |
| النسخ الاحتياطي | `deploy/backup.sh`: قاعدة البيانات + الرفوعات، حذف القديم، رفع اختياري إلى R2/B2 | `BACKUP_*` |
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
docker compose up -d --build           # خدمة migrate تطبق الترحيلات ثم يبدأ التطبيق
# على خادم جديد بلا قاعدة قديمة: أنشئ المدير العام (تُطبع كلمة مرور مؤقتة مرة واحدة)
docker compose exec app node dist/create-admin.js create-admin --email you@example.com --name "اسمك"
# رابط تعيين كلمة مرور لمستخدم موجود:
docker compose exec app node dist/create-admin.js setup-link --email user@example.com
```

> **الصورة والترحيلات:** `Dockerfile` متعدد المراحل؛ صورة التشغيل فيها اعتماديات الإنتاج و`dist/` و`drizzle/` فقط (لا vite ولا drizzle-kit ولا الشيفرة المصدرية). الترحيلات تعمل في خدمة `migrate` المستقلة (`node dist/migrate.js`)، ولا يبدأ `app` إلا بعد نجاحها؛ إن فشلت فاقرأ السبب بـ `docker compose logs migrate`. تستخدم نفس جدول `__drizzle_migrations` الذي يستخدمه `drizzle-kit migrate`، فالقواعد التي رُحّلت سابقاً تكمل منه.

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

## الدخول برقم الهاتف

يستطيع المستخدم إنشاء حسابه والدخول **برقم الهاتف وكلمة المرور** بدل البريد (أو بجانبه). التسجيل برقم الهاتف يخضع للقواعد نفسها: مغلق إلا برمز دعوة أو كود دخول ما لم يُضبط `ALLOW_SIGNUP=true`.

- يُحفظ الرقم بصيغة دولية موحّدة (`+967771234567`) فيدخل صاحبه به مهما كتبه: بمسافات، أو بالأرقام العربية، أو بـ `00`، أو محلياً.
- الرقم المحلي يُكمَّل بـ `PHONE_DEFAULT_COUNTRY_CODE` (اليمن `967` افتراضياً؛ للسعودية `966`)، ومن خارجها يكتب رمز دولته.
- من دخل بالبريد يضيف رقم هاتفه من «الإعدادات ← كلمة المرور ← إضافة رقم هاتف للدخول» (بكلمة مروره الحالية) ليدخل بأيهما.

### التحقق برسالة SMS واستعادة كلمة المرور بالهاتف (Twilio)

بلا إعداد يبقى الرقم معرّف دخول **غير مؤكد**، والاستعادة لأصحاب الأرقام برابط من إدارة المركز. مع [Twilio Verify](https://www.twilio.com/docs/verify/api) يصبح:

- **التسجيل برقم الهاتف** يتطلب رمزاً من 6 أرقام يصل برسالة SMS («أرسل رمز التحقق» ثم إدخال الرمز)، فلا يُحجز رقم دون إثبات امتلاكه.
- **إضافة رقم أو تغييره** من الإعدادات: كلمة المرور الحالية ثم رمز إلى الرقم الجديد.
- **تأكيد رقم قديم** (سُجّل قبل تفعيل Twilio): زر «أرسل رمز التحقق» في «الإعدادات ← كلمة المرور».
- **«نسيت كلمة المرور؟» برقم الهاتف**: رمز إلى الرقم ثم كلمة مرور جديدة، فيدخل مباشرة وتخرج الأجهزة الأخرى. متاحة **للأرقام المؤكدة فقط**، لأن رقماً أُدخل دون تحقق قد يملكه شخص آخر. والرد واحد سواء كان الرقم مسجلاً أو لا.

الإعداد:

1. أنشئ حساباً في [Twilio](https://www.twilio.com/try-twilio) واشحن رصيداً (الحساب التجريبي لا يرسل إلا لأرقام موثقة فيه).
2. Console ← **Verify ← Services ← Create new**، وانسخ **Service SID** (يبدأ بـ `VA`).
3. Console ← **Messaging ← Settings ← Geo permissions**: فعّل الدول التي يسكنها طلابك (اليمن، السعودية…)، وإلا تُرفض الرسائل بخطأ 60410.
4. في `.env`: `TWILIO_ACCOUNT_SID` (يبدأ بـ `AC`) و`TWILIO_AUTH_TOKEN` و`TWILIO_VERIFY_SERVICE_SID`، ثم `docker compose up -d`. (يمكن بدل الرمز الرئيسي إنشاء مفتاح API في «Account ← API keys» ووضعه في `TWILIO_API_KEY_SID` و`TWILIO_API_KEY_SECRET`.)

Twilio يولّد الرمز ويتحقق منه (صالح 10 دقائق ولمرة واحدة)، فلا يُخزَّن في قاعدة ترتيل. ولمنع إغراق الأرقام برسائل مدفوعة: رمز التسجيل لا يُرسل إلا حين يكون التسجيل مسموحاً لهذا الشخص، وهناك حد 3 رسائل في الساعة لكل رقم، و10 لكل IP، و10 محاولات إدخال لكل رقم.

## 3. البريد وGoogle (اختياريان)

**البريد** يفعّل «نسيت كلمة المرور؟» في صفحة الدخول (رابط لمرة واحدة صالح 30 دقيقة، ويُخرج الأجهزة الأخرى)، ورسالة تأكيد البريد بعد التسجيل (لا تمنع الدخول)، وزر «أرسل رابط التأكيد» في الإعدادات. بلا بريد تبقى الطريقة الحالية: رابط تعيين كلمة المرور من «إدارة الوصول».

1. أنشئ حساباً في [Resend](https://resend.com) أو [Brevo](https://www.brevo.com) ووثّق نطاقك (سجلات SPF وDKIM) حتى لا تذهب الرسائل إلى غير المرغوب فيه.
2. في `.env`: `RESEND_API_KEY=…` (أو `BREVO_API_KEY=…`)، و`EMAIL_FROM=no-reply@نطاقك`، و`PUBLIC_APP_URL=https://نطاقك`.

> روابط الرسائل تُبنى من `PUBLIC_APP_URL` وحده، لا من ترويسة `Host` التي يتحكم بها المرسل؛ بدونه تبقى الاستعادة بالبريد معطلة. صفحة الاستعادة تعطي الرد نفسه سواء كان البريد مسجلاً أو لا، وفيها حد لكل IP وحد 3 رسائل في الساعة لكل بريد.

**Google:**

1. في [Google Cloud Console](https://console.cloud.google.com/apis/credentials): «Create credentials ← OAuth client ID ← Web application».
2. Authorized redirect URI: `https://نطاقك/api/auth/google/callback` (يجب أن يطابق `PUBLIC_APP_URL` حرفياً).
3. في `.env`: `GOOGLE_CLIENT_ID` و`GOOGLE_CLIENT_SECRET`، ثم `docker compose up -d`. يظهر زر «المتابعة بـ Google».

قواعد الربط: من دخل بـ Google قبلاً يُعرف بمعرّفه الثابت لدى Google حتى لو غيّر بريده. أول دخول ببريد Google **مؤكد** يطابق حساباً موجوداً يُربط به (ويُعدّ البريد مؤكداً). البريد غير المؤكد لا يُربط أبداً. ولا ينشأ حساب جديد إلا مع `ALLOW_SIGNUP=true` أو برمز دعوة/كود دخول صالح في تبويب «حساب جديد».

## 4. ترويسات الأمان

يضع التطبيق في الإنتاج `Content-Security-Policy` تمنع أي سكربت مضمن أو من نطاق آخر، إضافة إلى `X-Content-Type-Options: nosniff` و`X-Frame-Options` و`Permissions-Policy`؛ وCaddy يضيف HSTS. جُرّبت السياسة على كل صفحات المنصة ببيانات مركز فعلية دون أي مخالفة.

- إن أضفت تحليلات مثل Umami على نطاق آخر: `CSP_EXTRA_SOURCES=https://analytics.example.com`.
- لتجربة تغيير دون كسر شيء: `CSP_MODE=report-only` (المخالفات تظهر في وحدة تحكم المتصفح فقط). `CSP_MODE=off` يعطلها.

## 5. قائمة الاختبار

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

## 6. النسخ الاحتياطي والاستعادة

`deploy/backup.sh` يأخذ لقطة متسقة من القاعدة (`mysqldump --single-transaction`) وأرشيفاً للملفات المرفوعة إلى `./backups/`، ويتحقق أن التفريغ اكتمل قبل اعتماده، ويحذف ما مضى عليه `BACKUP_KEEP_DAYS` يوماً (14 افتراضياً).

```bash
chmod +x deploy/backup.sh && ./deploy/backup.sh     # تجربة يدوية
crontab -e
30 2 * * * cd /root/tarteel-web && ./deploy/backup.sh >> /var/log/tarteel-backup.log 2>&1
```

**نسخة خارج الخادم (موصى بها):** نسخة على نفس القرص تضيع معه. أنشئ حاوية في Cloudflare R2 أو Backblaze B2 بمفتاح منفصل عن مفتاح الرفوعات، وقاعدة انتهاء (lifecycle) تحذف ما مضى عليه 30 يوماً، ثم في `.env`:

```bash
BACKUP_S3_BUCKET=tarteel-backups
BACKUP_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com   # B2: https://s3.<region>.backblazeb2.com
BACKUP_S3_ACCESS_KEY_ID=…
BACKUP_S3_SECRET_ACCESS_KEY=…
```

**الاستعادة** (جرّبها مرة على خادم تجريبي قبل أن تحتاجها):

```bash
docker compose stop app
gunzip -c backups/tarteel-db-<التاريخ>.sql.gz | docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root'
docker compose run --rm --no-deps -T app sh -c 'rm -rf /data/uploads/* && tar -C /data/uploads -xzf -' < backups/tarteel-uploads-<التاريخ>.tar.gz
docker compose up -d        # migrate يكمل أي ترحيل أحدث من النسخة
```

التفريغ يحتوي `CREATE DATABASE`/`USE tarteel`، فيُستعاد بمستخدم root. احفظ `.env` (وفيه `JWT_SECRET`) في مكان آمن منفصل؛ النسخة لا تحتويه.

## 7. بعد النقل

- مراقبة `/api/health` كل 5 دقائق.
- متغير المستودع `TARTEEL_SERVER_URL` = النطاق الجديد، حتى تفتحه نسخ أندرويد القادمة مباشرة.
