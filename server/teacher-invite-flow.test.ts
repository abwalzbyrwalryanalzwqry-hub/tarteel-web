import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingTeacherInvite, readPendingTeacherInvite, savePendingTeacherInvite } from "../shared/teacherInviteFlow";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } } });
});

describe("استمرار دعوة المعلم عبر المصادقة", () => {
  it("يحفظ رمز الدعوة وينظفه بعد إتمام التفعيل", () => {
    savePendingTeacherInvite("trtl-a1b2c3d4");
    expect(readPendingTeacherInvite()).toBe("TRTL-A1B2C3D4");
    clearPendingTeacherInvite();
    expect(readPendingTeacherInvite()).toBeNull();
  });
});
