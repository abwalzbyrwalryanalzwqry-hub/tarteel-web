/** يعيد معرّفات الطلاب الصالحة غير المسجلة فقط، مع إزالة التكرار من الإدخال. */
export function getUnrecordedStudentIds(studentIds: readonly number[], recordedStudentIds: readonly number[]) {
  const candidates = Array.from(new Set(studentIds.filter((studentId) => Number.isInteger(studentId) && studentId > 0)));
  const recorded = new Set(recordedStudentIds);
  return candidates.filter((studentId) => !recorded.has(studentId));
}
