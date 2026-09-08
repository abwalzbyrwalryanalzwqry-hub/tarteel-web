import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "ترتيل",
  slug: "tarteel-android",
  version: "0.1.0",
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
    architecture: "local-first",
    remoteSync: "typed-adapter-required"
  }
};

export default config;
