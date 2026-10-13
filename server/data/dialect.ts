/**
 * محرك قاعدة البيانات الحالي. الخادم يعمل على MySQL دائماً؛ نسخة أندرويد المحلية تشغّل
 * منطق الخادم نفسه على SQLite داخل التطبيق (client/src/local) وتضبط هذا العلم قبل تحميل الوحدات.
 */
export type SqlDialect = "mysql" | "sqlite";

export function getSqlDialect(): SqlDialect {
  return (globalThis as { __TARTEEL_LOCAL__?: boolean }).__TARTEEL_LOCAL__ === true ? "sqlite" : "mysql";
}

export const isSqliteDialect = () => getSqlDialect() === "sqlite";
