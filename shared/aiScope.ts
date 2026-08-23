export const AI_OUT_OF_SCOPE_REPLY = "لم يتم عملي للإجابة عن هذا النوع من الأسئلة";

const normalizeArabic = (value: string) =>
  value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim();

const DOMAIN_TERMS = [
  "قران", "قراني", "مصحف", "سوره", "ايه", "ايات", "حفظ", "مراجعه", "تلاوه", "تجويد",
  "حلقه", "حلقات", "تحفيظ", "جلسه", "جلسات", "طالب", "طلاب", "معلم", "معلمين",
  "مركز", "مراكز", "حضور", "غياب", "اختبار", "اختبارات", "اجازه", "اجازات",
  "انجاز", "انجازات", "نقاط", "جوائز", "ولي امر", "ولي الامر", "تقارير",
  "اداره المركز", "اداره الحلق", "اداره الطلاب", "تعليم قران", "تعليم القران",
];

const SKILL_TERMS = ["مهاره", "تطوير", "خطه", "تحسين", "نشاط", "انشطه", "تحفيز", "تقييم"];

/**
 * حارس نطاق حتمي يعمل قبل استدعاء النموذج. وهو لا يعتمد على قرار النموذج
 * لذلك لا يمكن للمستخدم تجاوزه بصياغة تعليمات ضمن رسالته.
 */
export function isTarteelAiInScope(question: string): boolean {
  const normalized = normalizeArabic(question);
  if (!normalized || normalized.length < 2) return false;

  const hasDomainTerm = DOMAIN_TERMS.some((term) => normalized.includes(term));
  if (hasDomainTerm) return true;

  // لا يقبل التطوير المهاري العام؛ يجب أن يرتبط صراحةً بسياق المنصة أو القرآن.
  const hasSkillTerm = SKILL_TERMS.some((term) => normalized.includes(term));
  const hasLearningContext = ["حفظ", "قران", "حلق", "طالب", "معلم", "مركز"].some((term) =>
    normalized.includes(term)
  );
  return hasSkillTerm && hasLearningContext;
}

export type AiContext = "general" | "dashboard" | "sessions" | "students" | "circles" | "reports";

export const AI_CONTEXT_LABELS: Record<AiContext, string> = {
  general: "خدمات منصة ترتيل",
  dashboard: "لوحة المعلومات",
  sessions: "إدارة الجلسات",
  students: "إدارة الطلاب",
  circles: "إدارة الحلقات",
  reports: "التقارير والإحصائيات",
};
