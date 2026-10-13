// فحص الشيفرة: قواعد typescript-eslint الموصى بها وقواعد React Hooks.
// الأخطاء تُفشل CI؛ التحذيرات للإصلاح التدريجي (الشيفرة القديمة فيها any كثير مثلاً).
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "mobile-android/**",
      "drizzle/meta/**",
      "**/*.d.ts",
      "client/public/sw.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "server/testing/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  }
);
