import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "ترتيل",
  slug: "tarteel-android",
  version: "0.2.0",
  orientation: "default",
  scheme: "tarteel",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: "com.tarteel.quranapp" },
  android: {
    package: "com.tarteel.quranapp",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-foreground.png",
      backgroundColor: "#E89B00"
    },
    permissions: ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", "android.permission.POST_NOTIFICATIONS"]
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
