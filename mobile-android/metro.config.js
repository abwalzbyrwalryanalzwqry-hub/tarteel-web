// NativeWind v4 يحتاج Metro لتحويل global.css (Tailwind) إلى أنماط React Native.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// نص المصحف (Tanzil) يُضمَّن كأصل .txt ويُقرأ عبر expo-asset في src/quran/localQuran.ts.
if (!config.resolver.assetExts.includes("txt")) config.resolver.assetExts.push("txt");

module.exports = withNativeWind(config, { input: "./global.css" });
