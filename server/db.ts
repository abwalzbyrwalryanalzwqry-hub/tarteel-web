/* طبقة البيانات — نقطة الاستيراد الوحيدة (`./db`) كما كانت.
 * قُسِّم الملف الأصلي (1378 سطراً) إلى وحدات حسب المجال في `server/data/`
 * بنقلٍ حرفي دون تغيير أي دالة أو توقيع؛ كل الاستيرادات القائمة
 * و`vi.mock("./db")` تعمل كما هي.
 */
export * from "./data/connection";
export * from "./data/users";
export * from "./data/organizations";
export * from "./data/centers";
export * from "./data/quran-reading-state";
export * from "./data/quran-review";
export * from "./data/quran-records";
export * from "./data/circles";
export * from "./data/teachers";
export * from "./data/teacher-invites";
export * from "./data/students";
export * from "./data/notifications";
export * from "./data/audit-log";
export * from "./data/dashboard-stats";
export * from "./data/daily-record";
export * from "./data/trash";
export * from "./data/access-control";
