import { and, desc, eq, gt, gte, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  academicSeasons,
  accessCodeAttempts,
  accessCodes,
  attendance,
  auditLog,
  branches,
  centerMemberships,
  centers,
  circlePeriods,
  circles,
  evaluation,
  memorization,
  notifications,
  organizations,
  parentStudentLinks,
  permissionGrants,
  revision,
  sessions,
  students,
  teacherInvites,
  teachers,
  userScopes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getTeacherInviteAvailability } from "../shared/teacherInvites";
import { getRiyadhDayKey } from "../shared/dates";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===================== USERS =====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(isNull(users.deletedAt)).limit(limit).offset(offset).orderBy(desc(users.createdAt));
}

// ===================== ORGANIZATIONS =====================
export async function getOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizations).where(isNull(organizations.deletedAt)).orderBy(desc(organizations.createdAt));
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(and(eq(organizations.id, id), isNull(organizations.deletedAt))).limit(1);
  return result[0];
}

export async function createOrganization(data: typeof organizations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(organizations).values(data);
  return result[0];
}

export async function updateOrganization(id: number, data: Partial<typeof organizations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id));
}

export async function softDeleteOrganization(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(organizations).set({ deletedAt: new Date(), isActive: false }).where(eq(organizations.id, id));
}

// ===================== CENTERS =====================
export async function getCenters(orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(centers.deletedAt)];
  if (orgId) conditions.push(eq(centers.organizationId, orgId));
  return db.select().from(centers).where(and(...conditions)).orderBy(desc(centers.createdAt));
}

export async function getCenterById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(centers).where(and(eq(centers.id, id), isNull(centers.deletedAt))).limit(1);
  return result[0];
}

export async function createCenter(data: typeof centers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(centers).values(data);
}

export async function updateCenter(id: number, data: Partial<typeof centers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centers).set({ ...data, updatedAt: new Date() }).where(eq(centers.id, id));
}

export async function softDeleteCenter(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centers).set({ deletedAt: new Date(), isActive: false }).where(eq(centers.id, id));
}

// ===================== BRANCHES =====================
export async function getBranches(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(branches.deletedAt)];
  if (centerId) conditions.push(eq(branches.centerId, centerId));
  return db.select().from(branches).where(and(...conditions)).orderBy(desc(branches.createdAt));
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(branches).where(and(eq(branches.id, id), isNull(branches.deletedAt))).limit(1);
  return result[0];
}

export async function createBranch(data: typeof branches.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(branches).values(data);
}

export async function updateBranch(id: number, data: Partial<typeof branches.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(branches).set({ ...data, updatedAt: new Date() }).where(eq(branches.id, id));
}

export async function softDeleteBranch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(branches).set({ deletedAt: new Date(), isActive: false }).where(eq(branches.id, id));
}

// ===================== ACADEMIC SEASONS =====================
export async function getAcademicSeasons(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(academicSeasons.deletedAt)];
  if (centerId) conditions.push(eq(academicSeasons.centerId, centerId));
  return db.select().from(academicSeasons).where(and(...conditions)).orderBy(desc(academicSeasons.createdAt));
}

export async function getAcademicSeasonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(academicSeasons).where(and(eq(academicSeasons.id, id), isNull(academicSeasons.deletedAt))).limit(1);
  return result[0];
}

export async function createAcademicSeason(data: typeof academicSeasons.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(academicSeasons).values(data);
}

export async function updateAcademicSeason(id: number, data: Partial<typeof academicSeasons.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicSeasons).set({ ...data, updatedAt: new Date() }).where(eq(academicSeasons.id, id));
}

export async function softDeleteAcademicSeason(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicSeasons).set({ deletedAt: new Date(), isActive: false }).where(eq(academicSeasons.id, id));
}

// ===================== CIRCLES =====================
export async function getCircles(branchId?: number, seasonId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(circles.deletedAt)];
  if (branchId) conditions.push(eq(circles.branchId, branchId));
  if (seasonId) conditions.push(eq(circles.seasonId, seasonId));
  return db.select().from(circles).where(and(...conditions)).orderBy(desc(circles.createdAt));
}

export async function getCircleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(circles).where(and(eq(circles.id, id), isNull(circles.deletedAt))).limit(1);
  return result[0];
}

export async function createCircle(data: typeof circles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(circles).values(data);
}

export async function updateCircle(id: number, data: Partial<typeof circles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circles).set({ ...data, updatedAt: new Date() }).where(eq(circles.id, id));
}

export async function softDeleteCircle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circles).set({ deletedAt: new Date(), isActive: false }).where(eq(circles.id, id));
}

// ===================== CIRCLE PERIODS =====================
export async function getCirclePeriods(circleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(circlePeriods).where(and(eq(circlePeriods.circleId, circleId), isNull(circlePeriods.deletedAt))).orderBy(circlePeriods.startTime);
}

export async function getCirclePeriodById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(circlePeriods).where(and(eq(circlePeriods.id, id), isNull(circlePeriods.deletedAt))).limit(1);
  return result[0];
}

export async function createCirclePeriod(data: typeof circlePeriods.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(circlePeriods).values(data);
}

export async function updateCirclePeriod(id: number, data: Partial<typeof circlePeriods.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circlePeriods).set({ ...data, updatedAt: new Date() }).where(eq(circlePeriods.id, id));
}

export async function softDeleteCirclePeriod(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(circlePeriods).set({ deletedAt: new Date(), isActive: false }).where(eq(circlePeriods.id, id));
}

export async function getCircleMonthlyRecord(circleId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const studentRows = await getStudents(undefined, circleId);
  const sessionConditions = [eq(sessions.circleId, circleId), isNull(sessions.deletedAt)];
  if (startDate) sessionConditions.push(gte(sessions.scheduledAt, startDate));
  if (endDate) sessionConditions.push(lte(sessions.scheduledAt, endDate));
  const sessionRows = await db.select({ id: sessions.id }).from(sessions).where(and(...sessionConditions));
  const sessionIds = sessionRows.map((row) => row.id);
  if (!sessionIds.length) return studentRows.map((student) => ({ student, present: 0, absent: 0, excused: 0, late: 0, memorizedPages: 0, reviewedPages: 0, lastMemorization: null, lastRevision: null }));

  const [attendanceRows, memorizationRows, revisionRows] = await Promise.all([
    db.select().from(attendance).where(inArray(attendance.sessionId, sessionIds)),
    db.select().from(memorization).where(inArray(memorization.sessionId, sessionIds)).orderBy(desc(memorization.createdAt)),
    db.select().from(revision).where(inArray(revision.sessionId, sessionIds)).orderBy(desc(revision.createdAt)),
  ]);
  const currentAttendanceRows = keepLatestAttendanceRows(attendanceRows);

  return studentRows.map((student) => {
    const studentAttendance = currentAttendanceRows.filter((row) => row.studentId === student.id);
    const studentMemorization = memorizationRows.filter((row) => row.studentId === student.id);
    const studentRevision = revisionRows.filter((row) => row.studentId === student.id);
    return {
      student,
      present: studentAttendance.filter((row) => row.status === "present").length,
      absent: studentAttendance.filter((row) => row.status === "absent").length,
      excused: studentAttendance.filter((row) => row.status === "excused").length,
      late: studentAttendance.filter((row) => row.status === "late").length,
      memorizedPages: studentMemorization.reduce((sum, row) => sum + Number(row.pages ?? 0), 0),
      reviewedPages: studentRevision.reduce((sum, row) => sum + Number(row.pages ?? 0), 0),
      lastMemorization: studentMemorization[0] ?? null,
      lastRevision: studentRevision[0] ?? null,
    };
  });
}

// ===================== TEACHERS =====================
export async function getTeachers(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(teachers.deletedAt)];
  if (centerId) conditions.push(eq(teachers.centerId, centerId));
  return db.select().from(teachers).where(and(...conditions)).orderBy(desc(teachers.createdAt));
}

export async function getTeacherById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teachers).where(and(eq(teachers.id, id), isNull(teachers.deletedAt))).limit(1);
  return result[0];
}

export async function getTeacherByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teachers).where(and(eq(teachers.userId, userId), isNull(teachers.deletedAt))).limit(1);
  return result[0];
}

export async function getCircleIdsForTeacher(teacherId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: circles.id }).from(circles).where(and(isNull(circles.deletedAt), or(eq(circles.teacherId, teacherId), eq(circles.assistantTeacherId, teacherId))));
  return rows.map((row) => row.id);
}

export async function createTeacher(data: typeof teachers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(teachers).values(data);
}

export async function updateTeacher(id: number, data: Partial<typeof teachers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teachers).set({ ...data, updatedAt: new Date() }).where(eq(teachers.id, id));
}

export async function transferTeacherToCircle(teacherId: number, circleId: number, role: "teacher" | "assistant_teacher") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(circles).where(and(eq(circles.id, circleId), isNull(circles.deletedAt))).limit(1);
    if (!target) throw new Error("الحَلَقة المستهدفة غير متاحة");
    const occupied = role === "teacher" ? target.teacherId : target.assistantTeacherId;
    if (occupied && occupied !== teacherId) throw new Error("المقعد المحدد في الحَلَقة مرتبط بمعلم آخر");

    if (role === "teacher") {
      await tx.update(circles).set({ teacherId: null }).where(eq(circles.teacherId, teacherId));
      await tx.update(circles).set({ teacherId }).where(eq(circles.id, circleId));
    } else {
      await tx.update(circles).set({ assistantTeacherId: null }).where(eq(circles.assistantTeacherId, teacherId));
      await tx.update(circles).set({ assistantTeacherId: teacherId }).where(eq(circles.id, circleId));
    }
  });
}

export async function getTeacherLastActivity(teacherId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ scheduledAt: sessions.scheduledAt }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).where(and(or(eq(circles.teacherId, teacherId), eq(circles.assistantTeacherId, teacherId)), isNull(sessions.deletedAt), isNull(circles.deletedAt))).orderBy(desc(sessions.scheduledAt)).limit(1);
  return result[0]?.scheduledAt ?? null;
}

export async function softDeleteTeacher(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teachers).set({ deletedAt: new Date(), isActive: false }).where(eq(teachers.id, id));
}

// ===================== TEACHER INVITES =====================
export async function getTeacherInvites(centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (centerId) {
    return db.select().from(teacherInvites).where(eq(teacherInvites.centerId, centerId)).orderBy(desc(teacherInvites.createdAt));
  }
  return db.select().from(teacherInvites).orderBy(desc(teacherInvites.createdAt));
}

export async function createTeacherInvite(data: typeof teacherInvites.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(teacherInvites).values(data);
}

export async function getTeacherInviteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teacherInvites).where(eq(teacherInvites.id, id)).limit(1);
  return result[0];
}

export async function revokeTeacherInvite(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teacherInvites).set({ isRevoked: true }).where(eq(teacherInvites.id, id));
}

/** يسترد دعوة معلم صالحة مرة واحدة ويحدّث دور المستخدم وربطه بالحَلَقة ضمن معاملة واحدة. */
export async function redeemTeacherInvite(code: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const normalizedCode = code.trim().toUpperCase();

  return db.transaction(async (tx) => {
    const [invite] = await tx.select().from(teacherInvites).where(eq(teacherInvites.code, normalizedCode)).limit(1);
    if (!invite) throw new Error("رمز الدعوة غير صحيح");
    const availability = getTeacherInviteAvailability(invite);
    if (availability === "revoked") throw new Error("تم إلغاء هذه الدعوة");
    if (availability === "used") throw new Error("تم استخدام هذه الدعوة مسبقاً");
    if (availability === "expired") throw new Error("انتهت صلاحية هذه الدعوة");

    const [circle] = await tx.select().from(circles).where(and(eq(circles.id, invite.circleId), isNull(circles.deletedAt))).limit(1);
    if (!circle) throw new Error("الحَلَقة المرتبطة بالدعوة لم تعد متاحة");
    const assignedTeacherId = invite.role === "teacher" ? circle.teacherId : circle.assistantTeacherId;
    if (assignedTeacherId) throw new Error("هذا المقعد في الحَلَقة مرتبط بمعلم بالفعل");

    const claim = await tx.update(teacherInvites)
      .set({ usedAt: new Date(), usedByUserId: userId })
      .where(and(
        eq(teacherInvites.id, invite.id),
        isNull(teacherInvites.usedAt),
        eq(teacherInvites.isRevoked, false),
        or(isNull(teacherInvites.expiresAt), gt(teacherInvites.expiresAt, new Date())),
      ));
    if (!claim[0]?.affectedRows) throw new Error("تعذر استرداد الدعوة؛ ربما استُخدمت للتو");

    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("حساب المستخدم غير موجود");
    const [existingTeacher] = await tx.select().from(teachers).where(and(eq(teachers.userId, userId), isNull(teachers.deletedAt))).limit(1);
    if (existingTeacher) {
      const existingTeacherCircles = await tx.select({ id: circles.id }).from(circles).where(and(or(eq(circles.teacherId, existingTeacher.id), eq(circles.assistantTeacherId, existingTeacher.id)), isNull(circles.deletedAt)));
      if (existingTeacherCircles.some((circle) => circle.id !== invite.circleId)) throw new Error("هذا الحساب مرتبط بحلقة معلم أخرى ولا يمكن منحه حلقة إضافية");
    }
    const teacherId = existingTeacher?.id ?? Number((await tx.insert(teachers).values({
      userId,
      centerId: invite.centerId,
      name: user.name?.trim() || "معلم جديد",
      email: user.email,
      isActive: true,
    }))[0].insertId);

    await tx.update(users).set({ role: invite.role }).where(eq(users.id, userId));
    await tx.update(circles).set(invite.role === "teacher" ? { teacherId } : { assistantTeacherId: teacherId }).where(eq(circles.id, invite.circleId));
    return { centerId: invite.centerId, circleId: invite.circleId, role: invite.role };
  });
}

// ===================== STUDENTS =====================
export async function getStudents(centerId?: number, circleId?: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(students.deletedAt)];
  if (centerId) conditions.push(eq(students.centerId, centerId));
  if (circleId) conditions.push(eq(students.circleId, circleId));
  if (search) conditions.push(like(students.name, `%${search}%`));
  return db.select().from(students).where(and(...conditions)).orderBy(students.name);
}

export async function getStudentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(and(eq(students.id, id), isNull(students.deletedAt))).limit(1);
  return result[0];
}

export async function getStudentByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(students).where(and(eq(students.userId, userId), isNull(students.deletedAt))).limit(1);
  return result[0];
}

export async function getStudentsByGuardianUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(students).where(and(eq(students.guardianUserId, userId), isNull(students.deletedAt))).orderBy(students.name);
}

export async function createStudent(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(students).values(data);
}

export async function updateStudent(id: number, data: Partial<typeof students.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id));
}

export async function softDeleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ deletedAt: new Date(), isActive: false }).where(eq(students.id, id));
}

// ===================== SESSIONS =====================
export async function getSessions(circleId?: number, seasonId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNull(sessions.deletedAt)];
  if (circleId) conditions.push(eq(sessions.circleId, circleId));
  if (seasonId) conditions.push(eq(sessions.seasonId, seasonId));
  return db.select().from(sessions).where(and(...conditions)).orderBy(desc(sessions.scheduledAt));
}

export async function getSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(and(eq(sessions.id, id), isNull(sessions.deletedAt))).limit(1);
  return result[0];
}

/** تعيد الفترة الوحيدة للحلقة في اليوم التشغيلي المحدد، إن وُجدت. */
export async function getSessionByCircleDay(circleId: number, dayKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sessions).where(and(eq(sessions.circleId, circleId), eq(sessions.dayKey, dayKey), isNull(sessions.deletedAt))).limit(1);
  return result[0];
}

export async function createSession(data: typeof sessions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(sessions).values(data);
  return result;
}

export async function updateSession(id: number, data: Partial<typeof sessions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ ...data, updatedAt: new Date() }).where(eq(sessions.id, id));
}

export async function softDeleteSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sessions).set({ deletedAt: new Date() }).where(eq(sessions.id, id));
}

// ===================== ATTENDANCE =====================
export async function getAttendanceBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return keepLatestAttendanceRows(await db.select().from(attendance).where(eq(attendance.sessionId, sessionId)));
}

/** يبقي آخر حالة حضور فقط لكل طالب وفترة عند قراءة سجلات تاريخية متكررة. */
export function keepLatestAttendanceRows<T extends { id: number; sessionId: number; studentId: number; updatedAt: Date }>(rows: T[]) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.sessionId}:${row.studentId}`;
    const current = latest.get(key);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime() || (row.updatedAt.getTime() === current.updatedAt.getTime() && row.id > current.id)) latest.set(key, row);
  }
  return Array.from(latest.values());
}

export async function upsertAttendance(data: typeof attendance.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(attendance).values(data).onDuplicateKeyUpdate({
    set: { status: data.status, notes: data.notes, updatedAt: new Date() },
  });
}

// ===================== MEMORIZATION =====================
export async function getMemorizationBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memorization).where(eq(memorization.sessionId, sessionId));
}

export async function getMemorizationByStudent(studentId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memorization).where(eq(memorization.studentId, studentId)).orderBy(desc(memorization.createdAt)).limit(limit);
}

export async function getRevisionByStudent(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(revision).where(eq(revision.studentId, studentId)).orderBy(desc(revision.createdAt));
}

export async function getStudentMizanProfile(studentId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return undefined;
  const student = await getStudentById(studentId);
  if (!student) return undefined;
  const sessionConditions = [eq(sessions.circleId, student.circleId ?? -1), isNull(sessions.deletedAt)];
  if (startDate) sessionConditions.push(gte(sessions.scheduledAt, startDate));
  if (endDate) sessionConditions.push(lte(sessions.scheduledAt, endDate));
  const sessionRows = await db.select({ id: sessions.id }).from(sessions).where(and(...sessionConditions));
  const sessionIds = sessionRows.map((row) => row.id);
  const [memorizationRows, revisionRows, attendanceRows, evaluationRows] = await Promise.all([
    db.select().from(memorization).where(eq(memorization.studentId, studentId)).orderBy(desc(memorization.createdAt)),
    getRevisionByStudent(studentId),
    sessionIds.length ? db.select().from(attendance).where(and(eq(attendance.studentId, studentId), inArray(attendance.sessionId, sessionIds))) : Promise.resolve([]),
    sessionIds.length ? db.select().from(evaluation).where(and(eq(evaluation.studentId, studentId), inArray(evaluation.sessionId, sessionIds))).orderBy(desc(evaluation.createdAt)) : Promise.resolve([]),
  ]);
  const withinRange = <T extends { createdAt: Date }>(rows: T[]) => rows.filter((row) => (!startDate || row.createdAt >= startDate) && (!endDate || row.createdAt <= endDate));
  return { student, memorization: withinRange(memorizationRows), revision: withinRange(revisionRows), attendance: keepLatestAttendanceRows(attendanceRows), evaluations: evaluationRows };
}

export async function createMemorization(data: typeof memorization.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(memorization).values(data).onDuplicateKeyUpdate({
    set: { surahNumber: data.surahNumber, toSurahNumber: data.toSurahNumber, fromAyah: data.fromAyah, toAyah: data.toAyah, pages: data.pages, grade: data.grade, notes: data.notes, recordedBy: data.recordedBy, updatedAt: new Date() },
  });
  await db.update(students).set({ lastMemorizedSurah: data.toSurahNumber ?? data.surahNumber, lastMemorizedAyah: data.toAyah, updatedAt: new Date() }).where(eq(students.id, data.studentId));
}

export async function updateMemorization(id: number, data: Partial<typeof memorization.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(memorization).set({ ...data, updatedAt: new Date() }).where(eq(memorization.id, id));
}

// ===================== REVISION =====================
export async function getRevisionBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(revision).where(eq(revision.sessionId, sessionId));
}

export async function createRevision(data: typeof revision.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(revision).values(data).onDuplicateKeyUpdate({
    set: { surahNumber: data.surahNumber, toSurahNumber: data.toSurahNumber, fromAyah: data.fromAyah, toAyah: data.toAyah, pages: data.pages, grade: data.grade, notes: data.notes, recordedBy: data.recordedBy, updatedAt: new Date() },
  });
}

/** آخر موضع حفظ ومراجعة لكل طالب في الحلقة، لبدء الفترة التالية من حيث انتهى. */
export async function getLatestStudentPeriodProgress(circleId: number) {
  const db = await getDb();
  if (!db) return {} as Record<number, { memorization: typeof memorization.$inferSelect | null; revision: typeof revision.$inferSelect | null }>;
  const [memorizationRows, revisionRows] = await Promise.all([
    db.select({ record: memorization }).from(memorization).innerJoin(sessions, eq(memorization.sessionId, sessions.id)).where(and(eq(sessions.circleId, circleId), isNull(sessions.deletedAt))).orderBy(desc(sessions.scheduledAt), desc(memorization.updatedAt)),
    db.select({ record: revision }).from(revision).innerJoin(sessions, eq(revision.sessionId, sessions.id)).where(and(eq(sessions.circleId, circleId), isNull(sessions.deletedAt))).orderBy(desc(sessions.scheduledAt), desc(revision.updatedAt)),
  ]);
  const progress: Record<number, { memorization: typeof memorization.$inferSelect | null; revision: typeof revision.$inferSelect | null }> = {};
  for (const row of memorizationRows) if (!progress[row.record.studentId]?.memorization) progress[row.record.studentId] = { memorization: row.record, revision: progress[row.record.studentId]?.revision ?? null };
  for (const row of revisionRows) if (!progress[row.record.studentId]?.revision) progress[row.record.studentId] = { memorization: progress[row.record.studentId]?.memorization ?? null, revision: row.record };
  return progress;
}

// ===================== EVALUATION =====================
export async function getEvaluationBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluation).where(eq(evaluation.sessionId, sessionId));
}

export async function upsertEvaluation(data: typeof evaluation.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(evaluation).values(data).onDuplicateKeyUpdate({
    set: {
      tajweedScore: data.tajweedScore,
      pronunciationScore: data.pronunciationScore,
      memorizationScore: data.memorizationScore,
      behaviorScore: data.behaviorScore,
      totalScore: data.totalScore,
      points: data.points,
      notes: data.notes,
      updatedAt: new Date(),
    },
  });
}

// ===================== NOTIFICATIONS =====================
export async function getNotificationsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationsCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ===================== AUDIT LOG =====================
export async function createAuditLog(data: typeof auditLog.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(data);
}

export async function getAuditLog(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

export async function getAuditLogForCenter(centerId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).where(eq(auditLog.centerId, centerId)).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// ===================== DASHBOARD STATS =====================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0 };

  const [studentsCount, teachersCount, centersCount, circlesCount, sessionsCount, openSessionsCount, todayPresent, todayAbsent] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(isNull(students.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(teachers).where(isNull(teachers.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(centers).where(isNull(centers.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(circles).where(isNull(circles.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(isNull(sessions.deletedAt)),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(isNull(sessions.deletedAt), eq(sessions.status, 'open'))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).where(eq(attendance.status, 'present')),
    db.select({ count: sql<number>`count(*)` }).from(attendance).where(eq(attendance.status, 'absent')),
  ]);

  return {
    totalStudents: studentsCount[0]?.count ?? 0,
    totalTeachers: teachersCount[0]?.count ?? 0,
    totalCenters: centersCount[0]?.count ?? 0,
    totalCircles: circlesCount[0]?.count ?? 0,
    totalSessions: sessionsCount[0]?.count ?? 0,
    openSessions: openSessionsCount[0]?.count ?? 0,
    todayAttendance: todayPresent[0]?.count ?? 0,
    todayAbsence: todayAbsent[0]?.count ?? 0,
  };
}

export async function getDashboardStatsForCenters(centerIds: number[]) {
  const empty = { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0, openSessions: 0, todayAttendance: 0, todayAbsence: 0 };
  if (!centerIds.length) return empty;
  const db = await getDb();
  if (!db) return empty;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const [studentsCount, teachersCount, circlesCount, sessionsCount, openSessionsCount, presentCount, absentCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(and(inArray(students.centerId, centerIds), isNull(students.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(teachers).where(and(inArray(teachers.centerId, centerIds), isNull(teachers.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt), eq(sessions.status, "open"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "present"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "absent"))),
  ]);
  return { totalStudents: studentsCount[0]?.count ?? 0, totalTeachers: teachersCount[0]?.count ?? 0, totalCenters: centerIds.length, totalCircles: circlesCount[0]?.count ?? 0, totalSessions: sessionsCount[0]?.count ?? 0, openSessions: openSessionsCount[0]?.count ?? 0, todayAttendance: presentCount[0]?.count ?? 0, todayAbsence: absentCount[0]?.count ?? 0 };
}

/** إحصاءات لوحة المعلم/الموجه داخل الحلقات التي يملك صلاحية قراءتها فقط. */
export async function getDashboardStatsForCircles(circleIds: number[]) {
  const empty = { totalStudents: 0, totalTeachers: 0, totalCenters: 0, totalCircles: 0, totalSessions: 0, openSessions: 0, todayAttendance: 0, todayAbsence: 0 };
  if (!circleIds.length) return empty;
  const db = await getDb();
  if (!db) return empty;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const [studentsCount, teachersCount, centersCount, sessionsCount, openSessionsCount, presentCount, absentCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).where(and(inArray(students.circleId, circleIds), isNull(students.deletedAt))),
    db.select({ count: sql<number>`count(distinct ${circles.teacherId})` }).from(circles).where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(distinct ${branches.centerId})` }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(circles.id, circleIds), isNull(circles.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt), eq(sessions.status, "open"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(inArray(sessions.circleId, circleIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "present"))),
    db.select({ count: sql<number>`count(*)` }).from(attendance).innerJoin(sessions, eq(attendance.sessionId, sessions.id)).where(and(inArray(sessions.circleId, circleIds), gte(sessions.scheduledAt, startOfDay), lt(sessions.scheduledAt, endOfDay), eq(attendance.status, "absent"))),
  ]);
  return {
    totalStudents: studentsCount[0]?.count ?? 0,
    totalTeachers: teachersCount[0]?.count ?? 0,
    totalCenters: centersCount[0]?.count ?? 0,
    totalCircles: circleIds.length,
    totalSessions: sessionsCount[0]?.count ?? 0,
    openSessions: openSessionsCount[0]?.count ?? 0,
    todayAttendance: presentCount[0]?.count ?? 0,
    todayAbsence: absentCount[0]?.count ?? 0,
  };
}

export async function getRecentSessions(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(desc(sessions.createdAt)).limit(limit);
}

export async function getRecentSessionsForCenters(centerIds: number[], limit = 5) {
  if (!centerIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ session: sessions }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), isNull(sessions.deletedAt))).orderBy(desc(sessions.createdAt)).limit(limit);
  return rows.map((row) => row.session);
}

export async function getRecentSessionsForCircles(circleIds: number[], limit = 5) {
  if (!circleIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(and(inArray(sessions.circleId, circleIds), isNull(sessions.deletedAt))).orderBy(desc(sessions.createdAt)).limit(limit);
}

// ===================== TRASH =====================
export async function getTrashedItems() {
  const db = await getDb();
  if (!db) return { centers: [], branches: [], teachers: [], students: [], circles: [], sessions: [] };

  const [trashedCenters, trashedBranches, trashedTeachers, trashedStudents, trashedCircles, trashedSessions] = await Promise.all([
    db.select().from(centers).where(sql`${centers.deletedAt} IS NOT NULL`),
    db.select().from(branches).where(sql`${branches.deletedAt} IS NOT NULL`),
    db.select().from(teachers).where(sql`${teachers.deletedAt} IS NOT NULL`),
    db.select().from(students).where(sql`${students.deletedAt} IS NOT NULL`),
    db.select().from(circles).where(sql`${circles.deletedAt} IS NOT NULL`),
    db.select().from(sessions).where(sql`${sessions.deletedAt} IS NOT NULL`),
  ]);

  return {
    centers: trashedCenters,
    branches: trashedBranches,
    teachers: trashedTeachers,
    students: trashedStudents,
    circles: trashedCircles,
    sessions: trashedSessions,
  };
}

export async function getTrashedItemsForCenters(centerIds: number[]) {
  if (!centerIds.length) return { centers: [], branches: [], teachers: [], students: [], circles: [], sessions: [] };
  const db = await getDb();
  if (!db) return { centers: [], branches: [], teachers: [], students: [], circles: [], sessions: [] };
  const [trashedCenters, trashedBranches, trashedTeachers, trashedStudents, trashedCircles, trashedSessions] = await Promise.all([
    db.select().from(centers).where(and(inArray(centers.id, centerIds), sql`${centers.deletedAt} IS NOT NULL`)),
    db.select().from(branches).where(and(inArray(branches.centerId, centerIds), sql`${branches.deletedAt} IS NOT NULL`)),
    db.select().from(teachers).where(and(inArray(teachers.centerId, centerIds), sql`${teachers.deletedAt} IS NOT NULL`)),
    db.select().from(students).where(and(inArray(students.centerId, centerIds), sql`${students.deletedAt} IS NOT NULL`)),
    db.select().from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), sql`${circles.deletedAt} IS NOT NULL`)),
    db.select().from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(branches.centerId, centerIds), sql`${sessions.deletedAt} IS NOT NULL`)),
  ]);
  return { centers: trashedCenters, branches: trashedBranches, teachers: trashedTeachers, students: trashedStudents, circles: trashedCircles.map((row) => row.circles), sessions: trashedSessions.map((row) => row.sessions) };
}

export async function getTrashedItemCenterId(table: "centers" | "branches" | "teachers" | "students" | "circles" | "sessions", id: number) {
  const db = await getDb();
  if (!db) return undefined;
  if (table === "centers") return id;
  if (table === "branches") return (await db.select({ centerId: branches.centerId }).from(branches).where(and(eq(branches.id, id), sql`${branches.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "teachers") return (await db.select({ centerId: teachers.centerId }).from(teachers).where(and(eq(teachers.id, id), sql`${teachers.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "students") return (await db.select({ centerId: students.centerId }).from(students).where(and(eq(students.id, id), sql`${students.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  if (table === "circles") return (await db.select({ centerId: branches.centerId }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(eq(circles.id, id), sql`${circles.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
  return (await db.select({ centerId: branches.centerId }).from(sessions).innerJoin(circles, eq(sessions.circleId, circles.id)).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(eq(sessions.id, id), sql`${sessions.deletedAt} IS NOT NULL`)).limit(1))[0]?.centerId;
}

export async function restoreItem(table: string, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const tableMap: Record<string, typeof centers | typeof branches | typeof teachers | typeof students | typeof circles | typeof sessions> = {
    centers,
    branches,
    teachers,
    students,
    circles,
    sessions,
  };

  const t = tableMap[table];
  if (!t) throw new Error("Invalid table");

  await db.update(t as typeof centers).set({ deletedAt: null, isActive: true } as any).where(eq((t as typeof centers).id, id));
}

// ===================== ACCESS CONTROL =====================
export async function getUserCenterMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(centerMemberships).where(eq(centerMemberships.userId, userId)).orderBy(desc(centerMemberships.createdAt));
}

export async function getActiveCenterMembership(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const result = await db.select().from(centerMemberships).where(and(eq(centerMemberships.userId, userId), eq(centerMemberships.centerId, centerId), eq(centerMemberships.status, "active"), isNull(centerMemberships.revokedAt), or(isNull(centerMemberships.expiresAt), gt(centerMemberships.expiresAt, now)))).limit(1);
  return result[0];
}

export async function getActivePermissionGrants(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(permissionGrants).where(and(eq(permissionGrants.userId, userId), eq(permissionGrants.centerId, centerId), isNull(permissionGrants.revokedAt), or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, now))));
}

export async function getActiveUserScopes(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(userScopes).where(and(eq(userScopes.userId, userId), eq(userScopes.centerId, centerId), isNull(userScopes.revokedAt), or(isNull(userScopes.expiresAt), gt(userScopes.expiresAt, now))));
}

export async function getCenterIdForCircle(circleId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ centerId: branches.centerId }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(eq(circles.id, circleId), isNull(circles.deletedAt), isNull(branches.deletedAt))).limit(1);
  return result[0]?.centerId;
}

export async function getCenterIdForStudent(studentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ centerId: students.centerId }).from(students).where(and(eq(students.id, studentId), isNull(students.deletedAt))).limit(1);
  return result[0]?.centerId;
}

export async function getAccessCodesForCenter(centerId: number) {
  const db = await getDb();
  if (!db) return [];
  await db.update(accessCodes).set({ status: "expired", updatedAt: new Date() }).where(and(eq(accessCodes.centerId, centerId), eq(accessCodes.status, "active"), lte(accessCodes.expiresAt, new Date())));
  return db.select().from(accessCodes).where(eq(accessCodes.centerId, centerId)).orderBy(desc(accessCodes.createdAt));
}

export async function getAccessCodeByHash(codeHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessCodes).where(eq(accessCodes.codeHash, codeHash)).limit(1);
  return result[0];
}

export async function createAccessCode(data: typeof accessCodes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(accessCodes).values(data);
  return Number(result[0].insertId);
}

export async function revokeAccessCode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(accessCodes).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(accessCodes.id, id));
}

export async function getAccessCodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessCodes).where(eq(accessCodes.id, id)).limit(1);
  return result[0];
}

export async function recordAccessCodeAttempt(data: typeof accessCodeAttempts.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(accessCodeAttempts).values(data);
}

export async function getParentStudentLinks(guardianUserId: number, centerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(parentStudentLinks.guardianUserId, guardianUserId)];
  if (centerId) conditions.push(eq(parentStudentLinks.centerId, centerId));
  return db.select().from(parentStudentLinks).where(and(...conditions));
}

export async function getCenterMembers(centerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ membership: centerMemberships, user: users }).from(centerMemberships).innerJoin(users, eq(centerMemberships.userId, users.id)).where(eq(centerMemberships.centerId, centerId)).orderBy(desc(centerMemberships.createdAt));
}

export async function getCenterMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(centerMemberships).where(eq(centerMemberships.id, id)).limit(1);
  return result[0];
}

export async function createCenterMembership(data: typeof centerMemberships.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(centerMemberships).values(data);
  return Number(result[0].insertId);
}

export async function updateCenterMembership(id: number, data: Partial<typeof centerMemberships.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(centerMemberships).set({ ...data, updatedAt: new Date() }).where(eq(centerMemberships.id, id));
}

export async function revokeUserPermissionGrants(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(permissionGrants).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(permissionGrants.userId, userId), eq(permissionGrants.centerId, centerId), isNull(permissionGrants.revokedAt)));
}

export async function createPermissionGrants(data: (typeof permissionGrants.$inferInsert)[]) {
  if (!data.length) return;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(permissionGrants).values(data);
}

export async function revokeUserScopes(userId: number, centerId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(userScopes).set({ revokedAt: new Date() }).where(and(eq(userScopes.userId, userId), eq(userScopes.centerId, centerId), isNull(userScopes.revokedAt)));
}

export async function createUserScopes(data: (typeof userScopes.$inferInsert)[]) {
  if (!data.length) return;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(userScopes).values(data);
}

export async function redeemAccessCodeSecure(input: { codeHash: string; userId: number; ipAddress?: string; userAgent?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [accessCode] = await tx.select().from(accessCodes).where(eq(accessCodes.codeHash, input.codeHash)).limit(1);
    if (!accessCode) {
      await tx.insert(accessCodeAttempts).values({ codeFingerprint: input.codeHash, attemptedByUserId: input.userId, wasSuccessful: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
      throw new Error("رمز الدخول غير صحيح");
    }
    const invalidate = async (message: string, disable = false) => {
      const attempts = accessCode.failedAttempts + 1;
      await tx.update(accessCodes).set({ failedAttempts: attempts, lockedUntil: attempts >= 5 ? new Date(now.getTime() + 15 * 60_000) : accessCode.lockedUntil, status: disable || attempts >= 10 ? "disabled" : accessCode.status, updatedAt: now }).where(eq(accessCodes.id, accessCode.id));
      await tx.insert(accessCodeAttempts).values({ accessCodeId: accessCode.id, codeFingerprint: input.codeHash, attemptedByUserId: input.userId, wasSuccessful: false, ipAddress: input.ipAddress, userAgent: input.userAgent });
      throw new Error(message);
    };
    if (accessCode.status !== "active") await invalidate("هذا الرمز غير متاح", true);
    if (accessCode.lockedUntil && accessCode.lockedUntil > now) await invalidate("تم تعليق محاولات هذا الرمز مؤقتاً");
    if (accessCode.expiresAt && accessCode.expiresAt <= now) {
      await tx.update(accessCodes).set({ status: "expired", updatedAt: now }).where(eq(accessCodes.id, accessCode.id));
      await invalidate("انتهت صلاحية هذا الرمز", true);
    }
    if (accessCode.usedCount >= accessCode.maxUses) {
      await tx.update(accessCodes).set({ status: "used", updatedAt: now }).where(eq(accessCodes.id, accessCode.id));
      await invalidate("تم استخدام هذا الرمز بالكامل", true);
    }
    const isTeacherAccessCode = accessCode.role === "teacher" || accessCode.role === "assistant_teacher";
    const isReaderAccessCode = accessCode.role === "student" || accessCode.role === "guardian";
    const isGuideAccessCode = accessCode.role === "guide";
    if (isTeacherAccessCode) {
      if (!accessCode.circleId || accessCode.maxUses !== 1) throw new Error("كود المعلم غير صالح؛ يلزم حلقة واحدة واستخدام واحد");
      let embeddedScopes: unknown[] = [];
      try { embeddedScopes = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : []; } catch { throw new Error("نطاق كود المعلم غير صالح"); }
      if (!Array.isArray(embeddedScopes) || embeddedScopes.some((scope: any) => scope?.scopeType !== "circle" || scope?.scopeId !== accessCode.circleId)) throw new Error("كود المعلم لا يمكن أن يمنح سوى نطاق الحلقة المعينة");
      const [existingTeacher] = await tx.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.userId, input.userId), eq(teachers.centerId, accessCode.centerId), isNull(teachers.deletedAt))).limit(1);
      if (existingTeacher) {
        const existingTeacherCircles = await tx.select({ id: circles.id }).from(circles).where(and(or(eq(circles.teacherId, existingTeacher.id), eq(circles.assistantTeacherId, existingTeacher.id)), isNull(circles.deletedAt)));
        if (existingTeacherCircles.some((circle) => circle.id !== accessCode.circleId)) throw new Error("هذا الحساب مرتبط بحلقة معلم أخرى ولا يمكن منحه حلقة إضافية");
      }
      const [targetCircle] = await tx.select().from(circles).where(and(eq(circles.id, accessCode.circleId), isNull(circles.deletedAt))).limit(1);
      if (!targetCircle) throw new Error("الحلقة المرتبطة بالكود لم تعد متاحة");
      const occupiedTeacherId = accessCode.role === "teacher" ? targetCircle.teacherId : targetCircle.assistantTeacherId;
      if (occupiedTeacherId && occupiedTeacherId !== existingTeacher?.id) throw new Error("مقعد المعلم في الحلقة مرتبط بحساب آخر");
    }
    let embeddedScopes: unknown[] = [];
    try { embeddedScopes = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : []; } catch { throw new Error("نطاق كود الدخول غير صالح"); }
    if (isGuideAccessCode) {
      const guideCircleIds = embeddedScopes
        .filter((scope: any) => scope?.scopeType === "circle" && typeof scope?.scopeId === "number")
        .map((scope: any) => scope.scopeId as number);
      const uniqueGuideCircleIds = Array.from(new Set(guideCircleIds));
      if (accessCode.maxUses !== 1 || uniqueGuideCircleIds.length === 0 || uniqueGuideCircleIds.length !== embeddedScopes.length) throw new Error("كود الموجّه غير صالح؛ يلزم حلقات محددة واستخدام واحد");
      const guideCircles = await tx.select({ id: circles.id, centerId: branches.centerId }).from(circles).innerJoin(branches, eq(circles.branchId, branches.id)).where(and(inArray(circles.id, uniqueGuideCircleIds), isNull(circles.deletedAt)));
      if (guideCircles.length !== uniqueGuideCircleIds.length || guideCircles.some((circle) => circle.centerId !== accessCode.centerId)) throw new Error("نطاق حلقات الموجّه غير صالح أو خارج المركز");
    }
    if (isReaderAccessCode) {
      if (!accessCode.studentId || accessCode.maxUses !== 1) throw new Error("كود الطالب أو ولي الأمر غير صالح؛ يلزم طالب واحد واستخدام واحد");
      const readerScopes = embeddedScopes.filter((scope: any) => scope?.scopeType === "student" && scope?.scopeId === accessCode.studentId);
      if (readerScopes.length !== 1 || embeddedScopes.length !== 1) throw new Error("كود الطالب أو ولي الأمر لا يمكن أن يمنح سوى طالب واحد");
      const [targetStudent] = await tx.select().from(students).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt))).limit(1);
      if (!targetStudent) throw new Error("الطالب المرتبط بالكود لم يعد متاحاً");
      if (accessCode.role === "student") {
        if (targetStudent.userId && targetStudent.userId !== input.userId) throw new Error("هذا الطالب مرتبط بحساب طالب آخر");
        const linkedStudents = await tx.select({ id: students.id }).from(students).where(and(eq(students.userId, input.userId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt)));
        if (linkedStudents.some((student) => student.id !== accessCode.studentId)) throw new Error("هذا الحساب مرتبط بطالب آخر ولا يمكن منحه طالباً إضافياً");
      } else {
        if (targetStudent.guardianUserId && targetStudent.guardianUserId !== input.userId) throw new Error("هذا الطالب مرتبط بولي أمر آخر");
        const [linkedParent] = await tx.select({ studentId: parentStudentLinks.studentId }).from(parentStudentLinks).where(and(eq(parentStudentLinks.guardianUserId, input.userId), eq(parentStudentLinks.centerId, accessCode.centerId))).limit(1);
        if (linkedParent && linkedParent.studentId !== accessCode.studentId) throw new Error("هذا الحساب مرتبط بابن آخر ولا يمكن منحه نطاقاً إضافياً");
        const linkedGuardianStudents = await tx.select({ id: students.id }).from(students).where(and(eq(students.guardianUserId, input.userId), eq(students.centerId, accessCode.centerId), isNull(students.deletedAt)));
        if (linkedGuardianStudents.some((student) => student.id !== accessCode.studentId)) throw new Error("هذا الحساب مرتبط بابن آخر ولا يمكن منحه نطاقاً إضافياً");
      }
    }
    const nextCount = accessCode.usedCount + 1;
    const claim = await tx.update(accessCodes).set({ usedCount: sql`${accessCodes.usedCount} + 1`, assignedUserId: input.userId, failedAttempts: 0, lockedUntil: null, lastUsedAt: now, status: nextCount >= accessCode.maxUses ? "used" : "active", updatedAt: now }).where(and(eq(accessCodes.id, accessCode.id), eq(accessCodes.status, "active"), lt(accessCodes.usedCount, accessCodes.maxUses)));
    if (!claim[0]?.affectedRows) throw new Error("تعذر استرداد الرمز؛ حاول مجدداً");

    await tx.update(users).set({ role: accessCode.role, isActive: true, accountStatus: "active", accessRevokedAt: null, lastActiveAt: now, updatedAt: now }).where(eq(users.id, input.userId));
    await tx.insert(centerMemberships).values({ userId: input.userId, centerId: accessCode.centerId, role: accessCode.role, status: "active", isOwner: false, grantedBy: accessCode.createdBy, grantedAt: now }).onDuplicateKeyUpdate({ set: { role: accessCode.role, status: "active", revokedAt: null, expiresAt: null, updatedAt: now } });

    const scopes: { scopeType: "center" | "circle" | "teacher" | "student"; scopeId?: number }[] = isTeacherAccessCode
      ? [{ scopeType: "circle", scopeId: accessCode.circleId! }]
      : isReaderAccessCode
        ? [{ scopeType: "student", scopeId: accessCode.studentId! }]
        : isGuideAccessCode
          ? (embeddedScopes as { scopeType: "circle"; scopeId: number }[])
          : [];
    if (!isTeacherAccessCode && !isReaderAccessCode && !isGuideAccessCode) {
      if (accessCode.circleId) scopes.push({ scopeType: "circle", scopeId: accessCode.circleId });
      if (accessCode.teacherId) scopes.push({ scopeType: "teacher", scopeId: accessCode.teacherId });
      if (accessCode.studentId) scopes.push({ scopeType: "student", scopeId: accessCode.studentId });
      try {
        const embedded = accessCode.scopeJson ? JSON.parse(accessCode.scopeJson) : [];
        if (Array.isArray(embedded)) for (const scope of embedded) if (["center", "circle", "teacher", "student"].includes(scope?.scopeType)) scopes.push({ scopeType: scope.scopeType, scopeId: scope.scopeId });
      } catch { /* مخطط النطاق غير صالح؛ يظل الرمز بنطاقه الصريح فقط. */ }
    }
    if (isTeacherAccessCode || isReaderAccessCode || isGuideAccessCode) await tx.update(userScopes).set({ revokedAt: now }).where(and(eq(userScopes.userId, input.userId), eq(userScopes.centerId, accessCode.centerId), isNull(userScopes.revokedAt)));
    if (scopes.length) await tx.insert(userScopes).values(scopes.map((scope) => ({ userId: input.userId, centerId: accessCode.centerId, scopeType: scope.scopeType, scopeId: scope.scopeId ?? null, grantedBy: accessCode.createdBy })));
    if (isTeacherAccessCode) {
      const [existingTeacher] = await tx.select().from(teachers).where(and(eq(teachers.userId, input.userId), eq(teachers.centerId, accessCode.centerId), isNull(teachers.deletedAt))).limit(1);
      const teacherId = existingTeacher?.id ?? Number((await tx.insert(teachers).values({ userId: input.userId, centerId: accessCode.centerId, name: "معلم جديد", isActive: true }))[0].insertId);
      await tx.update(teachers).set({ userId: input.userId, isActive: true, updatedAt: now }).where(eq(teachers.id, teacherId));
      await tx.update(circles).set(accessCode.role === "teacher" ? { teacherId } : { assistantTeacherId: teacherId }).where(eq(circles.id, accessCode.circleId!));
    }
    if (accessCode.studentId && accessCode.role === "student") await tx.update(students).set({ userId: input.userId, isActive: true, updatedAt: now }).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId)));
    if (accessCode.studentId && accessCode.role === "guardian") {
      await tx.update(students).set({ guardianUserId: input.userId, updatedAt: now }).where(and(eq(students.id, accessCode.studentId), eq(students.centerId, accessCode.centerId)));
      await tx.insert(parentStudentLinks).values({ guardianUserId: input.userId, studentId: accessCode.studentId, centerId: accessCode.centerId, linkedBy: accessCode.createdBy }).onDuplicateKeyUpdate({ set: { centerId: accessCode.centerId } });
    }
    const [center] = await tx.select({ managerId: centers.managerId, name: centers.name }).from(centers).where(eq(centers.id, accessCode.centerId)).limit(1);
    const managers = await tx.select({ userId: centerMemberships.userId }).from(centerMemberships).where(and(eq(centerMemberships.centerId, accessCode.centerId), eq(centerMemberships.status, "active"), isNull(centerMemberships.revokedAt), or(eq(centerMemberships.role, "center_manager"), eq(centerMemberships.isOwner, true))));
    const managerIds = Array.from(new Set([center?.managerId, ...managers.map((manager) => manager.userId)].filter((id): id is number => typeof id === "number")));
    const [redeemingUser] = await tx.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
    const roleLabel = ({ supervisor: "مشرف", guide: "موجّه", teacher: "معلم", assistant_teacher: "معلم مساعد", student: "طالب", guardian: "ولي أمر" } as Record<string, string>)[accessCode.role] ?? accessCode.role;
    if (managerIds.length) await tx.insert(notifications).values(managerIds.map((userId) => ({ userId, title: "تم استخدام كود دخول", message: `استرد ${redeemingUser?.name || redeemingUser?.email || "مستخدم"} كود دخول بدور ${roleLabel} في مركز ${center?.name || accessCode.centerId}.`, type: "success" as const, relatedId: accessCode.id, relatedType: "access_code_redeemed" })));
    await tx.insert(notifications).values({ userId: input.userId, title: "تم تفعيل الوصول", message: "تم تفعيل حسابك بالدور والنطاق الممنوحين من المركز.", type: "success", relatedId: accessCode.id, relatedType: "access_code" });
    await tx.insert(accessCodeAttempts).values({ accessCodeId: accessCode.id, codeFingerprint: input.codeHash, attemptedByUserId: input.userId, wasSuccessful: true, ipAddress: input.ipAddress, userAgent: input.userAgent });
    return { centerId: accessCode.centerId, role: accessCode.role, status: nextCount >= accessCode.maxUses ? "used" : "active" };
  });
}
