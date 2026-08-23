import { and, desc, eq, gt, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  academicSeasons,
  attendance,
  auditLog,
  branches,
  centers,
  circles,
  evaluation,
  memorization,
  notifications,
  organizations,
  revision,
  sessions,
  students,
  teacherInvites,
  teachers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getTeacherInviteAvailability } from "../shared/teacherInvites";

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
  return db.select().from(attendance).where(eq(attendance.sessionId, sessionId));
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

export async function createMemorization(data: typeof memorization.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(memorization).values(data);
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
  await db.insert(revision).values(data);
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

export async function getRecentSessions(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(isNull(sessions.deletedAt)).orderBy(desc(sessions.createdAt)).limit(limit);
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
