import { beforeEach, describe, expect, it } from "vitest";
import { getReportExportHistory, recordReportExport } from "../shared/reportHistory";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: () => true,
    },
  });
});

describe("سجل تصدير التقارير", () => {
  it("يحفظ بيانات عملية التصدير محلياً ويعيد الأحدث أولاً", () => {
    recordReportExport({ filename: "students.xlsx", reportType: "students", format: "excel" });
    recordReportExport({ filename: "attendance.pdf", reportType: "attendance", format: "pdf" });

    const history = getReportExportHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ filename: "attendance.pdf", reportType: "attendance", format: "pdf" });
    expect(history[1]).toMatchObject({ filename: "students.xlsx", reportType: "students", format: "excel" });
  });
});
