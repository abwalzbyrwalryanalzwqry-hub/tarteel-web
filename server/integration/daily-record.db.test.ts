/**
 * تكامل مع MySQL: السجل اليومي للحلقة من فتح اليوم إلى التقرير.
 * فتح اليوم ← الحضور الجماعي (دون المساس بغياب مسجّل) ← تسميع حفظ بتقدير ← إنهاء اليوم ← السجلات
 * السابقة وملف الطالب وبيانات التقرير، مع رفض من لا يملك الحلقة وتعارض النسخ.
 */
import { describeWithDb, uniqueSuffix } from "../testing/database";
import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";
import {
  centerMemberships,
  centers,
  circles,
  organizations,
  students,
  users,
} from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { appRouter } from "../routers";
import { getDb } from "../data/connection";
import { getRiyadhDayKey } from "../../shared/dates";

type User = NonNullable<TrpcContext["user"]>;
const ctx = (user: User): TrpcContext => ({
  user,
  req: {
    protocol: "https",
    ip: "198.51.100.21",
    headers: { "user-agent": "vitest" },
  } as unknown as TrpcContext["req"],
  res: {
    cookie: () => undefined,
    clearCookie: () => undefined,
  } as unknown as TrpcContext["res"],
});

let manager: User;
let outsider: User;
let halaqa = 0;
const ids: number[] = [];
const today = getRiyadhDayKey(new Date());

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return;
  const d = (await getDb())!;
  const user = async (name: string) => {
    const [row] = await d
      .insert(users)
      .values({ openId: `local_daily_${uniqueSuffix()}`, name, role: "user" });
    return (
      await d
        .select()
        .from(users)
        .where(eq(users.id, Number(row.insertId)))
    )[0] as User;
  };
  manager = await user("مدير السجل");
  outsider = await user("زائر");
  const [org] = await d
    .insert(organizations)
    .values({ name: `منظمة ${uniqueSuffix()}` });
  const [center] = await d.insert(centers).values({
    organizationId: Number(org.insertId),
    name: `مركز السجل ${uniqueSuffix()}`,
  });
  const centerId = Number(center.insertId);
  await d.insert(centerMemberships).values({
    userId: manager.id,
    centerId,
    role: "center_manager",
    status: "active",
    isOwner: true,
  });
  const [circle] = await d
    .insert(circles)
    .values({ centerId, name: "حلقة السجل" });
  halaqa = Number(circle.insertId);
  for (const name of ["أحمد", "بلال", "حمزة"]) {
    const [s] = await d
      .insert(students)
      .values({ centerId, circleId: halaqa, name });
    ids.push(Number(s.insertId));
  }
});

describeWithDb("السجل اليومي للحلقة (MySQL)", () => {
  it("يفتح اليوم ويرصد الحضور والتسميع ثم يُنهيه ويظهر في السجلات والتقرير", async () => {
    const api = appRouter.createCaller(ctx(manager)).daily;

    const halaqat = await api.halaqat();
    expect(halaqat.map(h => h.id)).toContain(String(halaqa));

    const empty = await api.sheet({ halaqa, date: today });
    expect(empty.record).toBeNull();
    expect(empty.students).toHaveLength(3);
    expect(empty.can_edit).toBe(true);

    const opened = await api.open({ halaqa, date: today });
    const record = Number(opened.id);
    expect(opened.status).toBe("open");

    // غياب حمزة أولاً ثم «الجميع حاضر» لمن لم يُرصد فقط.
    const [ahmad, bilal, hamza] = ids;
    await api.setAttendance({
      record,
      student: hamza,
      status: "absent",
      reason: null,
      version: 0,
    });
    const sheet = await api.sheet({ halaqa, date: today });
    const bulk = await api.setAttendanceBulk({
      record,
      rows: sheet.students
        .filter(s => !s.status)
        .map(s => ({
          student: Number(s.student_id),
          status: "present" as const,
          version: s.version,
        })),
    });
    expect(bulk.students.length).toBe(2);

    const afterBulk = await api.sheet({ halaqa, date: today });
    const status = (id: number) =>
      afterBulk.students.find(s => s.student_id === String(id))?.status;
    expect(status(ahmad)).toBe("present");
    expect(status(bilal)).toBe("present");
    expect(status(hamza)).toBe("absent");

    // تسميع حفظ بتقدير ممتاز (5) لأحمد.
    const row = afterBulk.students.find(s => s.student_id === String(ahmad))!;
    await api.saveEntry({
      record,
      student: ahmad,
      version: row.version,
      payload: {
        memorize: {
          segments: [{ surah_name: "الملك", from_ayah: 1, to_ayah: 10 }],
          grade: 5,
        },
      },
    });
    // نسخة قديمة تُرفض بالتعارض بدل الكتابة فوق التعديل الأحدث.
    await expect(
      api.saveEntry({
        record,
        student: ahmad,
        version: row.version,
        payload: { note: "قديم" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // لا يُسجَّل إنجاز لغائب.
    await expect(
      api.saveEntry({
        record,
        student: hamza,
        version: afterBulk.students.find(s => s.student_id === String(hamza))!
          .version,
        payload: {
          memorize: {
            segments: [{ surah_name: "القلم", from_ayah: 1, to_ayah: 5 }],
            grade: 4,
          },
        },
      })
    ).rejects.toThrow("STUDENT_NOT_PRESENT");

    const head = (await api.sheet({ halaqa, date: today })).record!;
    const done = await api.complete({ record, version: head.version });
    expect(done.status).toBe("completed");

    const history = await api.history({ halaqa, limit: 10 });
    expect(history[0]).toMatchObject({
      date: today,
      status: "completed",
      present: 2,
      absent: 1,
      memorized: 1,
    });

    const overview = await api.studentOverview({ student: ahmad });
    expect(overview.attendance.present).toBe(1);
    expect(overview.last_memorize).toMatchObject({
      from_ayah: 1,
      to_ayah: 10,
      session_date: today,
    });

    const days = await api.studentDays({ student: ahmad });
    expect(days[0]).toMatchObject({ date: today, status: "present" });
    expect(days[0].memorize?.segments.length).toBe(1);

    const report = await api.reportData({ halaqa, from: today, to: today });
    expect(report.students.length).toBe(3);
    expect(report.days.map(d => d.date)).toEqual([today]);

    const located = await api.locate({ record });
    expect(located).toMatchObject({ halaqa: String(halaqa), date: today });
  });

  it("يرفض من لا يملك الحلقة في القراءة والكتابة والتقارير", async () => {
    const api = appRouter.createCaller(ctx(outsider)).daily;
    expect(await api.halaqat()).toEqual([]);
    await expect(api.sheet({ halaqa, date: today })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(api.open({ halaqa, date: today })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      api.reportData({ halaqa, from: today, to: today })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
