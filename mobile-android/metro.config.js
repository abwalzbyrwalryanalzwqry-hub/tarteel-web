// NativeWind v4 يحتاج Metro لتحويل global.css (Tailwind) إلى أنماط React Native.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
