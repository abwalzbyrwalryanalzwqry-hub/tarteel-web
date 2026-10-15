import type { ExpoConfig } from "expo/config";

/**
 * رقم الإصدار الظاهر في الإعدادات وفي وكيل المستخدم (TarteelAndroid/…): من ANDROID_VERSION_NAME الذي يضبطه
 * سير عمل الإصدار (ويستعمله Gradle لـ versionName)، حتى لا تبقى الإعدادات تعرض «0.4.0» في كل إصدار.
 */
const versionName =
  (process.env.ANDROID_VERSION_NAME ?? "").replace(/^android-v/i, "").trim() || "0.5.4";

const config: ExpoConfig = {
  name: "ترتيل",
  slug: "tarteel-android",
  version: versionName,
  orientation: "default",
  scheme: "tarteel",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: "com.tarteel.quranapp" },
  android: {
    package: "com.tarteel.quranapp",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-foreground.png",
      backgroundColor: "#EC8C06"
    },
    permissions: ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.POST_NOTIFICATIONS"],
    // تمنع إعادة إضافتها عند expo prebuild (انظر AndroidManifest.xml).
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT"
    ]
  },
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#F6F3EA"
  },
  plugins: [
    "expo-router",
    ["expo-sqlite", { enableFTS: true }],
    "expo-secure-store"
  ],
  extra: {
    // عنوان المنصة الافتراضي يُحدَّد وقت البناء: TARTEEL_SERVER_URL=https://tarteel.example.org
    // ويمكن للمستخدم تغييره من شاشة الإعدادات. إن تُرك فارغاً يطلب التطبيق العنوان عند أول تشغيل.
    defaultServerUrl: process.env.TARTEEL_SERVER_URL || ""
  }
};

export default config;
