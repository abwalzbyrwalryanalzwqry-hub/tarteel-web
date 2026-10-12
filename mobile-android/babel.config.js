// NativeWind v4: يجب أن يكون nativewind/babel ضمن presets (وليس plugins)
// مع jsxImportSource حتى تعمل خاصية className على مكونات React Native.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
