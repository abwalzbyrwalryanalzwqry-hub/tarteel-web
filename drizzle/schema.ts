import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  tinyint,
} from "drizzle-orm/mysql-core";

// ===================== USERS =====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["super_admin", "org_admin", "center_manager", "supervisor", "teacher", "assistant_teacher", "student", "guardian", "user", "admin"]).default("user").notNull(),
  phone: varchar("phone", { length: 32 }),
  avatar: text("avatar"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===================== ORGANIZATIONS =====================
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  logo: text("logo"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("SA"),
  adminId: int("adminId"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ===================== CENTERS =====================
export const centers = mysqlTable("centers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  managerId: int("managerId"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Center = typeof centers.$inferSelect;
export type InsertCenter = typeof centers.$inferInsert;

// ===================== BRANCHES =====================
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  supervisorId: int("supervisorId"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

// ===================== ACADEMIC SEASONS =====================
export const academicSeasons = mysqlTable("academic_seasons", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["academic_year", "semester", "summer", "ramadan", "custom"]).default("academic_year").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AcademicSeason = typeof academicSeasons.$inferSelect;
export type InsertAcademicSeason = typeof academicSeasons.$inferInsert;

// ===================== CIRCLES (HALAQAT) =====================
export const circles = mysqlTable("circles", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull(),
  seasonId: int("seasonId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  teacherId: int("teacherId"),
  assistantTeacherId: int("assistantTeacherId"),
  maxStudents: int("maxStudents").default(20),
  schedule: text("schedule"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Circle = typeof circles.$inferSelect;
export type InsertCircle = typeof circles.$inferInsert;

// ===================== TEACHERS =====================
export const teachers = mysqlTable("teachers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  centerId: int("centerId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  nationalId: varchar("nationalId", { length: 32 }),
  specialization: varchar("specialization", { length: 255 }),
  qualification: varchar("qualification", { length: 255 }),
  hireDate: timestamp("hireDate"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = typeof teachers.$inferInsert;

// ===================== STUDENTS =====================
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  centerId: int("centerId").notNull(),
  circleId: int("circleId"),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  guardianPhone: varchar("guardianPhone", { length: 32 }),
  guardianName: varchar("guardianName", { length: 255 }),
  nationalId: varchar("nationalId", { length: 32 }),
  birthDate: timestamp("birthDate"),
  enrollmentDate: timestamp("enrollmentDate").defaultNow(),
  lastMemorizedSurah: int("lastMemorizedSurah").default(1),
  lastMemorizedAyah: int("lastMemorizedAyah").default(1),
  totalMemorizedJuz: decimal("totalMemorizedJuz", { precision: 5, scale: 2 }).default("0"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ===================== SESSIONS =====================
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  circleId: int("circleId").notNull(),
  teacherId: int("teacherId").notNull(),
  seasonId: int("seasonId").notNull(),
  title: varchar("title", { length: 255 }),
  type: mysqlEnum("type", ["regular", "exam", "review", "special"]).default("regular").notNull(),
  status: mysqlEnum("status", ["scheduled", "open", "closed", "cancelled"]).default("scheduled").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  startedAt: timestamp("startedAt"),
  closedAt: timestamp("closedAt"),
  notes: text("notes"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// ===================== ATTENDANCE =====================
export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "excused"]).default("present").notNull(),
  arrivalTime: timestamp("arrivalTime"),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

// ===================== MEMORIZATION =====================
export const memorization = mysqlTable("memorization", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  surahNumber: int("surahNumber").notNull(),
  fromAyah: int("fromAyah").notNull(),
  toAyah: int("toAyah").notNull(),
  pages: decimal("pages", { precision: 4, scale: 2 }),
  grade: mysqlEnum("grade", ["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).default("good"),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Memorization = typeof memorization.$inferSelect;
export type InsertMemorization = typeof memorization.$inferInsert;

// ===================== REVISION =====================
export const revision = mysqlTable("revision", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  surahNumber: int("surahNumber").notNull(),
  fromAyah: int("fromAyah").notNull(),
  toAyah: int("toAyah").notNull(),
  pages: decimal("pages", { precision: 4, scale: 2 }),
  grade: mysqlEnum("grade", ["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).default("good"),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Revision = typeof revision.$inferSelect;
export type InsertRevision = typeof revision.$inferInsert;

// ===================== EVALUATION =====================
export const evaluation = mysqlTable("evaluation", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  tajweedScore: tinyint("tajweedScore"),
  pronunciationScore: tinyint("pronunciationScore"),
  memorizationScore: tinyint("memorizationScore"),
  behaviorScore: tinyint("behaviorScore"),
  totalScore: tinyint("totalScore"),
  points: int("points").default(0),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Evaluation = typeof evaluation.$inferSelect;
export type InsertEvaluation = typeof evaluation.$inferInsert;

// ===================== NOTIFICATIONS =====================
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "warning", "success", "error", "attendance", "session", "memorization"]).default("info").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  relatedId: int("relatedId"),
  relatedType: varchar("relatedType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ===================== AUDIT LOG =====================
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: int("entityId"),
  oldData: text("oldData"),
  newData: text("newData"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
