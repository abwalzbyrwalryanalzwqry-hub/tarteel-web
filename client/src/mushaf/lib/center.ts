/** نسبة الحضور كما في زِن: (حاضر + متأخر) من كل من سُجّلت حالته، أو null إن لم يُسجَّل أحد. */
import type { AttendanceStatus } from "@/mushaf/lib/halaqa-register";

export function attendanceRate(
  s: Partial<Record<AttendanceStatus, number>>
): number | null {
  const present = (s.present ?? 0) + (s.late ?? 0);
  const total = present + (s.absent ?? 0) + (s.excused ?? 0);
  return total === 0 ? null : Math.round((present * 100) / total);
}
