# تطبيق ترتيل لأندرويد

تطبيق أصلي (Expo SDK 54 / React Native 0.81) بثلاثة أقسام:

| القسم | ما يفعله | يحتاج اتصالاً؟ |
|---|---|---|
| **المنصة** | منصة ترتيل الكاملة (الحلقات، الطلاب، الحفظ والمراجعة، التقارير، إدارة الوصول…) داخل WebView مع: زر الرجوع، تنزيل تقارير PDF/CSV ومشاركتها، فتح واتساب والبريد خارجياً، رفع الشعارات، وإعادة التحميل تلقائياً عند عودة الشبكة | نعم |
| **المصحف** | 114 سورة و6236 آية من نص Tanzil (حفص)، بحث بلا تشكيل، قارئ سور مع تذكّر آخر موضع | لا |
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

## ما زال قيد التطوير

طبقة المزامنة دون اتصال (`src/sync`, `src/db`) جاهزة ومختبرة لكنها غير مربوطة بالواجهة بعد؛ الإدخال حالياً عبر المنصة المتصلة.
