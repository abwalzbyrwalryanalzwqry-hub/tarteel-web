import { describe, expect, it } from "vitest";
import { getUnrecordedStudentIds } from "../shared/attendance";

describe("تسجيل الحضور الجماعي", () => {
  it("يختار الطلاب غير المسجلين مرة واحدة ولا يمرر قيماً أو معرّفات مكررة", () => {
    expect(getUnrecordedStudentIds([101, 102, 101, 0, -1, 103], [102])).toEqual([101, 103]);
  });

  it("لا يعيد إدراج أي طالب إذا كانت كل الحالات الفردية مسجلة مسبقاً", () => {
    expect(getUnrecordedStudentIds([101, 102], [102, 101])).toEqual([]);
  });
});
