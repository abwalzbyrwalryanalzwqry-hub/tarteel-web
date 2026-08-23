import { describe, expect, it } from "vitest";
import { getVisibleNavigationPaths, hasTarteelPermission, normalizeTarteelRole, ROLE_LABELS } from "../shared/permissions";

describe("صلاحيات أدوار ترتيل", () => {
  it("يمنح مدير المركز ومشرفه صلاحيات الإدارة", () => {
    expect(hasTarteelPermission("center_manager", "centers:manage")).toBe(true);
    expect(hasTarteelPermission("supervisor", "students:manage")).toBe(true);
  });

  it("يحصر صلاحية المعلم في الحلقات والطلاب والجلسات", () => {
    expect(hasTarteelPermission("teacher", "sessions:manage")).toBe(true);
    expect(hasTarteelPermission("teacher", "centers:manage")).toBe(false);
    expect(hasTarteelPermission("teacher", "quran:view")).toBe(true);
    expect(hasTarteelPermission("teacher", "messages:manage")).toBe(true);
  });

  it("يحصر الطالب وولي الأمر في الخدمات المسموح بها", () => {
    expect(hasTarteelPermission("student", "students:manage")).toBe(false);
    expect(hasTarteelPermission("guardian", "sessions:manage")).toBe(false);
    expect(hasTarteelPermission("guardian", "ai:use")).toBe(true);
    expect(hasTarteelPermission("guardian", "quran:view")).toBe(true);
    expect(hasTarteelPermission("guardian", "messages:manage")).toBe(false);
  });

  it("يتعامل بأمان مع الأدوار غير المعروفة", () => {
    expect(normalizeTarteelRole("unknown-role")).toBe("user");
    expect(ROLE_LABELS[normalizeTarteelRole("guardian")]).toBe("ولي أمر");
  });

  it("يعرض قوائم مختلفة للمعلم والطالب وولي الأمر", () => {
    const teacherPaths = getVisibleNavigationPaths("teacher");
    const studentPaths = getVisibleNavigationPaths("student");
    const guardianPaths = getVisibleNavigationPaths("guardian");

    expect(teacherPaths).toContain("/sessions");
    expect(teacherPaths).toContain("/students");
    expect(teacherPaths).toContain("/quran");
    expect(teacherPaths).toContain("/parent-messages");
    expect(teacherPaths).not.toContain("/teacher-invites");
    expect(teacherPaths).not.toContain("/centers");
    expect(studentPaths).not.toContain("/students");
    expect(studentPaths).toContain("/assistant");
    expect(studentPaths).toContain("/quran");
    expect(studentPaths).not.toContain("/parent-messages");
    expect(guardianPaths).not.toContain("/reports");
    expect(getVisibleNavigationPaths("center_manager")).toContain("/teacher-invites");
  });
});
