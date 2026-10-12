# ثغرات الاعتماديات في تطبيق أندرويد

يُفحص هذا المجلد في CI بالأمر `pnpm audit --audit-level=high` (ملف `android-native.yml`).
الثغرات التالية مستثناة صراحةً في `pnpm.auditConfig.ignoreGhsas` داخل `package.json`، وسبب كل استثناء مذكور هنا.
**راجع هذه القائمة عند كل ترقية لـ Expo SDK**، واحذف أي استثناء صار له إصلاح.

آخر مراجعة: 13 أكتوبر 2026 (Expo SDK 54، وReact Native 0.81.5).

## مرقّعة محلياً (تدخل حزمة التطبيق)

| الثغرة | المكتبة | الوضع |
|---|---|---|
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | `decode-uri-component@0.2.2`، عبر `query-string@7` ← React Navigation وexpo-router | الإصدار المصلح (0.5) يعمل بصيغة ESM فقط، و`query-string@7` يستورده بـ `require`. لذلك نُقلت دالة فك الترميز الخطية من 0.5.0 إلى 0.2.2 في `patches/decode-uri-component@0.2.2.patch`. النتائج مطابقة للإصدار الأصلي، وزمن المعالجة: نص من 400 مقطع خبيث كان يستغرق 11 ثانية، وصار أقل من 1 ملي ثانية. pnpm يفشل إن لم تنطبق الرقعة، فلا تسقط بصمت عند تحديث ملف القفل. |

## أدوات بناء فقط (لا تدخل ملف APK)

| الثغرة | المكتبة | لماذا لا تُحدَّث | لماذا الخطر منخفض |
|---|---|---|---|
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)، [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | `image-size@1.2.1`، عبر Metro | الإصلاح في 2.x فقط، وMetro 0.83 يمرّر مسار ملف كنص، وهذه الطريقة أُزيلت في 2.x | Metro يقرأ صور المشروع نفسه وقت البناء، لا ملفات من مستخدمين |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge@1.4.0`، عبر `@expo/cli` | لا يوجد إصدار مصلح | تستخدمه Expo CLI لشهادات HTTPS لخادم التطوير المحلي فقط |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces@3.0.3`، عبر chokidar وmicromatch | لا يوجد إصدار مصلح | أنماط الملفات تأتي من إعدادات المشروع |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | `sprintf-js@1.0.3`، عبر argparse | لا يوجد إصدار مصلح | أدوات سطر أوامر وقت البناء |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | `postcss-selector-parser@6`، عبر Tailwind 3 وNativeWind | الإصلاح في 7.x فقط، وTailwind 3 لا يدعمه | يعالج CSS المشروع وقت البناء |

## الإصدارات المفروضة (`pnpm.overrides`)

`postcss`، و`source-map-js`، و`compression`، و`shell-quote` (كانت حرجة)، و`brace-expansion` (الإصدارات 1 و2 و5)، و`uuid` داخل `xcode`: كلها ترقيات تصحيحية متوافقة. وحُدّث `vitest` إلى 4.1.11، وهذا أصلح ثغرة `tinypool` الحرجة.
