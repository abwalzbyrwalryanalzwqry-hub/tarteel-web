import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tarteel.quran",
  appName: "ترتيل",
  webDir: "www",
  server: {
    url: "https://tarteel-qura-8kmxg5hu.manus.space",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
