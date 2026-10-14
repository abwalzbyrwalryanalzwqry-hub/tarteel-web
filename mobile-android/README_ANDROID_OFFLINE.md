# تطبيق ترتيل لأندرويد

تطبيق أصلي (Expo SDK 54 / React Native 0.81) بثلاثة أقسام:

| القسم | ما يفعله | يحتاج اتصالاً؟ |
|---|---|---|
| **المنصة** | منصة ترتيل الكاملة (الحلقات، الطلاب، الحفظ والمراجعة، التقارير، إدارة الوصول…) داخل WebView مع: زر الرجوع، تنزيل تقارير PDF/CSV ومشاركتها، فتح واتساب والبريد خارجياً، رفع الشعارات، وإعادة التحميل تلقائياً عند عودة الشبكة | نعم |
| **المصحف** | قسم المصحف في ترتيل نفسه (المنقول من زِن) من نسخة الجهاز المضمّنة في التطبيق: مصحف المدينة ١٥ سطراً ووضع السورة، التفاسير، البحث، العلامات، الختمة، آخر قراءة، وضع الحفظ، ومشاركة بطاقة الآية. يعمل بوضع «المصحف المستقل» دون حساب ودون قاعدة بيانات المنصة، مع إبقاء الشاشة مضاءة أثناء القراءة. المصحف المرتبط بالحساب (سجل الحفظ والمراجعة) في تبويب المنصة | لا (التلاوات من EveryAyah تحتاج اتصالاً) |
| **الإعدادات** | عنوان خادم ترتيل (يُتحقق منه ويُحفظ في SecureStore) — يغني عن إعادة البناء عند نقل المنصة | — |

## عنوان الخادم

يُحدد وقت البناء: `TARTEEL_SERVER_URL=https://tarteel.example.org`، وفي GitHub Actions من متغير المستودع
`TARTEEL_SERVER_URL` (Settings ← Secrets and variables ← Actions ← Variables). إن تُرك فارغاً يطلب التطبيق العنوان عند أول تشغيل.

## البناء محلياً

```bash
pnpm install --frozen-lockfile --ignore-scripts
cd android
TARTEEL_SERVER_URL=https://tarteel.example.org ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

للتوقيع: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
ولـ Google Play: `./gradlew :app:bundleRelease` (أو سير العمل `android-release.yml`).

## تبويب المصحف

- يفتح `https://appassets.androidplatform.net/quran?app=reader`، أي ملفات `assets/web` (ناتج `pnpm build:local`) نفسها التي يعرضها تبويب المنصة دون خادم.
- المعامل `app=reader` يشغّل «المصحف المستقل» (`client/src/mushaf/lib/standalone.ts`): لا tRPC ولا sql.js، حتى لا تحفظ نسختان من قاعدة البيانات فوق بعضهما. العلامات والإعدادات وآخر موضع في `localStorage` المشترك مع تبويب المنصة لأن الأصل واحد.
- الجسر (`src/web/bridge.ts`) يضيف `navigator.share` (نص إلى مربع المشاركة، وملف عبر مسار التنزيل) و`navigator.wakeLock` (عبر `expo-keep-awake`، ولكل تبويب وسمه).
- آخر موضع من القارئ الأصلي السابق (`tarteel.quran.lastRead` في SecureStore) يُفتح مرة واحدة عند أول تشغيل بعد التحديث ثم يُحذف.

## ما زال قيد التطوير

طبقة المزامنة دون اتصال (`src/sync`, `src/db`) جاهزة ومختبرة لكنها غير مربوطة بالواجهة بعد؛ الإدخال حالياً عبر المنصة المتصلة.
