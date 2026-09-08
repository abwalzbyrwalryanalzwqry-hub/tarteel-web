# التصميم التنفيذي لتطبيق ترتيل Android Offline‑First

## مبدأ التشغيل

تقرأ واجهة Android من قاعدة SQLite المحلية أولاً، وتكتب إليها داخل معاملات قصيرة، ثم تسجل التغيير في Outbox في المعاملة نفسها. بعد ظهور النتيجة للمستخدم، يعمل Sync Engine في الخلفية عند توفر الشبكة. لا تنتظر الواجهة الشبكة لعرض البيانات المحلية، ولا تُخفي حالة عدم الاتصال كخطأ.

## طبقات التطبيق

| الطبقة | المسؤولية | الممنوع |
|---|---|---|
| UI | عرض الحالة المحلية والتفاعل والإشعارات المرئية | استدعاء API أو معرفة تفاصيل SQLite مباشرة |
| ViewModel/Use Cases | تنسيق حالات الشاشة وتطبيق حالات التحميل/الاتصال | تجاوز الصلاحيات المحلية |
| Repository | نقطة موحدة للقراءة والكتابة، وتحديد Local أو Remote | إعادة بيانات غير مصرح بها |
| Local DB | SQLite معاملات وفهارس وترحيلات | تخزين كلمة المرور أو token الخام |
| Authorization | صلاحيات ونطاقات من snapshot موثق للمستخدم | اعتبار إخفاء الزر حماية كافية |
| Outbox | عمليات CREATE/UPDATE/DELETE idempotent | إسقاط العملية عند فشل الشبكة |
| Sync Engine | سحب التغييرات ودفع العمليات مع backoff وتعارض | الكتابة فوق سجل حساس بصمت |
| Remote Adapter | استدعاء tRPC/Sync API مع timeouts | وضع أسرار الخادم في التطبيق |

## الجداول المحلية التشغيلية

يُعاد تمثيل كيانات الخادم المطلوبة في SQLite. وتضاف الجداول التشغيلية التالية:

```sql
CREATE TABLE sync_outbox (
  operation_id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE','UPDATE','DELETE')),
  payload_json TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  base_version INTEGER,
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('PENDING','SYNCING','SYNCED','FAILED','CONFLICT')),
  last_error TEXT,
  next_attempt_at TEXT
);

CREATE TABLE sync_conflicts (
  conflict_id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_json TEXT NOT NULL,
  remote_json TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolution TEXT CHECK (resolution IN ('PENDING','KEEP_LOCAL','KEEP_REMOTE','MERGED')),
  resolved_at TEXT
);

CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

لا تُطبق هذه الجداول على MySQL مباشرة بهذه الصيغة؛ هي عقد محلي مبدئي. قبل ربطها بالخادم يجب إضافة API متوافق، ومعرّف جهاز، ونسخة سجل أو `updatedAt` موثوقة، وسياسة idempotency تمنع تكرار الجلسة أو الحضور عند إعادة المحاولة.

## سياسة التعارض

السجلات التعليمية الحساسة مثل الحضور والحفظ والمراجعة والتقييم والجلسة لا تُحل بسياسة «آخر كتابة تفوز» وحدها. يجب إرسال `operationId` و`baseVersion`، ورفض التحديث إذا تغيرت النسخة على الخادم، وحفظ local/remote في `sync_conflicts`. يعرض التطبيق للمستخدم المخول الفرق والإجراء، أو يستخدم دمجاً حقلياً موثقاً عندما تكون الحقول مستقلة. لا يُحذف سجل تعليمي محلياً عند تعارض غير محلول.

## المصادقة المحلية

بعد نجاح الدخول Online، تُحفظ هوية الحساب ولقطة الصلاحيات والنطاقات ووقت انتهاء الجلسة في Secure Storage المدعوم بـ Android Keystore. لا تحفظ كلمة المرور. عند فتح التطبيق Offline، يتحقق التطبيق من توقيع snapshot ومدة صلاحيته ومن حالة الحساب المحلية. لا يُسمح بإضافة نطاق أو دور محلياً؛ التغييرات الإدارية الحساسة تحتاج الخادم أو مراجعة تعارض.

## عقد المزامنة المطلوب

يجب أن يدعم الخادم لاحقاً عقداً منطقياً مثل:

```text
POST /sync/push
  { deviceId, cursor, operations[] }

POST /sync/pull
  { deviceId, cursor, scope, limit }

Response
  { accepted[], conflicts[], changes[], nextCursor }
```

هذا وصف للعقد وليس إذناً بإضافة REST wrappers عشوائية؛ تطبيق ترتيل الحالي يفضل tRPC-first، ولذلك يضاف router typed مخصص للمزامنة أو Adapter موثق، وتستعمل الواجهة عقده عبر العميل typed.

## مراحل التنفيذ المقترحة

تبدأ المرحلة العملية بمشروع Android مستقل يعرض شاشة محلية بسيطة ويثبت SQLite والترحيلات وحالة الاتصال واختبار Repository. بعدها تُنقل وحدة واحدة عالية القيمة، مثل جلسة المعلم، مع outbox واختبارات انقطاع الشبكة. لا تُنقل كل الشاشات دفعة واحدة؛ لأن ذلك قد يخفي فقدان البيانات أو اختلاف الصلاحيات بين الويب والهاتف.
