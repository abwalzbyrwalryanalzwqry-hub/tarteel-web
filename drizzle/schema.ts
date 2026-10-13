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
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ===================== USERS =====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["super_admin", "org_admin", "center_manager", "supervisor", "guide", "teacher", "assistant_teacher", "student", "guardian", "user", "admin"]).default("user").notNull(),
  phone: varchar("phone", { length: 32 }),
  avatar: text("avatar"),
  isActive: boolean("isActive").default(true).notNull(),
  accountStatus: mysqlEnum("accountStatus", ["pending", "active", "suspended", "disabled", "archived"]).default("active").notNull(),
  accessRevokedAt: timestamp("accessRevokedAt"),
  lastActiveAt: timestamp("lastActiveAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** يُرفع عند تغيير كلمة المرور أو «الخروج من كل الأجهزة» فتبطل كل الجلسات السابقة. */
  sessionVersion: int("sessionVersion").default(0).notNull(),
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
  logoUrl: text("logoUrl"),
  logoKey: text("logoKey"),
  managerId: int("managerId"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Center = typeof centers.$inferSelect;
export type InsertCenter = typeof centers.$inferInsert;

// أهداف إدارة المركز؛ تُحفظ اختيارياً حتى تقارن لوحة التحليلات الأداء الفعلي بالهدف الشهري المحدد من الإدارة.
export const reportingGoals = mysqlTable("reporting_goals", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
  attendanceTarget: int("attendanceTarget"),
  memorizedPagesTarget: int("memorizedPagesTarget"),
  reviewedPagesTarget: int("reviewedPagesTarget"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("reporting_goals_center_unique").on(table.centerId)]);
export type ReportingGoal = typeof reportingGoals.$inferSelect;
export type InsertReportingGoal = typeof reportingGoals.$inferInsert;

// إعدادات الهوية الخاصة بملفات التقارير ورسالة متابعة المعلم داخل كل مركز.
export const reportingPreferences = mysqlTable("reporting_preferences", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
  headerTitle: varchar("headerTitle", { length: 255 }),
  footerText: varchar("footerText", { length: 500 }),
  logoUrl: text("logoUrl"),
  logoKey: text("logoKey"),
  teacherMessageTemplate: text("teacherMessageTemplate"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("reporting_preferences_center_unique").on(table.centerId)]);
export type ReportingPreference = typeof reportingPreferences.$inferSelect;
export type InsertReportingPreference = typeof reportingPreferences.$inferInsert;

// ===================== ACCESS CONTROL =====================
// تفصل العضوية هوية الحساب العامة عن دوره وحالته داخل كل مركز.
export const centerMemberships = mysqlTable("center_memberships", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), centerId: int("centerId").notNull(),
  role: mysqlEnum("role", ["center_manager", "supervisor", "guide", "teacher", "assistant_teacher", "student", "guardian"]).notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended", "disabled", "archived"]).default("pending").notNull(),
  isOwner: boolean("isOwner").default(false).notNull(), grantedBy: int("grantedBy"), grantedAt: timestamp("grantedAt").defaultNow().notNull(), expiresAt: timestamp("expiresAt"), revokedAt: timestamp("revokedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("center_memberships_user_center_unique").on(table.userId, table.centerId), index("center_memberships_center_idx").on(table.centerId, table.status)]);
export type CenterMembership = typeof centerMemberships.$inferSelect;
export type InsertCenterMembership = typeof centerMemberships.$inferInsert;

// منح تفصيلي قابل للانتهاء والسحب، مع مرجع للمفوض لمنع التصعيد.
export const permissionGrants = mysqlTable("permission_grants", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), centerId: int("centerId").notNull(), permission: varchar("permission", { length: 96 }).notNull(), effect: mysqlEnum("effect", ["allow", "deny"]).default("allow").notNull(), grantedBy: int("grantedBy").notNull(), expiresAt: timestamp("expiresAt"), revokedAt: timestamp("revokedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("permission_grants_lookup_idx").on(table.userId, table.centerId, table.permission), index("permission_grants_center_idx").on(table.centerId, table.revokedAt)]);
export type PermissionGrant = typeof permissionGrants.$inferSelect;
export type InsertPermissionGrant = typeof permissionGrants.$inferInsert;

// نطاقات مستقلة لتدعم أكثر من حلقة أو معلم أو طالب للمستخدم الواحد.
export const userScopes = mysqlTable("user_scopes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), centerId: int("centerId").notNull(), scopeType: mysqlEnum("scopeType", ["center", "circle", "teacher", "student"]).notNull(), scopeId: int("scopeId"), grantedBy: int("grantedBy"), expiresAt: timestamp("expiresAt"), revokedAt: timestamp("revokedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("user_scopes_lookup_idx").on(table.userId, table.centerId, table.scopeType), index("user_scopes_resource_idx").on(table.centerId, table.scopeType, table.scopeId)]);
export type UserScope = typeof userScopes.$inferSelect;
export type InsertUserScope = typeof userScopes.$inferInsert;

// لا تخزن الأكواد نفسها؛ يحتفظ النظام بالـ hash والتلميح فقط بعد الإنشاء.
export const accessCodes = mysqlTable("access_codes", {
  id: int("id").autoincrement().primaryKey(), centerId: int("centerId").notNull(), codeHash: varchar("codeHash", { length: 128 }).notNull(), codeHint: varchar("codeHint", { length: 24 }).notNull(),
  role: mysqlEnum("role", ["center_manager", "supervisor", "guide", "teacher", "assistant_teacher", "student", "guardian"]).notNull(), scopeJson: text("scopeJson"), circleId: int("circleId"), teacherId: int("teacherId"), studentId: int("studentId"), guardianUserId: int("guardianUserId"), createdBy: int("createdBy").notNull(), assignedUserId: int("assignedUserId"),
  status: mysqlEnum("status", ["active", "used", "expired", "revoked", "disabled"]).default("active").notNull(), expiresAt: timestamp("expiresAt"), maxUses: int("maxUses").default(1).notNull(), usedCount: int("usedCount").default(0).notNull(), failedAttempts: int("failedAttempts").default(0).notNull(), lockedUntil: timestamp("lockedUntil"), lastUsedAt: timestamp("lastUsedAt"), revokedAt: timestamp("revokedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("access_codes_hash_unique").on(table.codeHash), index("access_codes_center_status_idx").on(table.centerId, table.status), index("access_codes_subject_idx").on(table.studentId, table.guardianUserId)]);
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = typeof accessCodes.$inferInsert;

export const accessCodeAttempts = mysqlTable("access_code_attempts", {
  id: int("id").autoincrement().primaryKey(), accessCodeId: int("accessCodeId"), attemptedByUserId: int("attemptedByUserId"), codeFingerprint: varchar("codeFingerprint", { length: 64 }).notNull(), wasSuccessful: boolean("wasSuccessful").default(false).notNull(), ipAddress: varchar("ipAddress", { length: 64 }), userAgent: varchar("userAgent", { length: 512 }), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("access_code_attempts_code_idx").on(table.accessCodeId, table.createdAt), index("access_code_attempts_fingerprint_idx").on(table.codeFingerprint, table.createdAt)]);

export const parentStudentLinks = mysqlTable("parent_student_links", {
  id: int("id").autoincrement().primaryKey(), guardianUserId: int("guardianUserId").notNull(), studentId: int("studentId").notNull(), centerId: int("centerId").notNull(), linkedBy: int("linkedBy"), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("parent_student_links_guardian_student_unique").on(table.guardianUserId, table.studentId), index("parent_student_links_guardian_center_idx").on(table.guardianUserId, table.centerId)]);

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

// ===================== CIRCLE PERIODS =====================
// فترات متكررة خاصة بالحَلَقة؛ لا تنشئ جلسات تلقائياً من دون إجراء معلم صريح.
export const circlePeriods = mysqlTable("circle_periods", {
  id: int("id").autoincrement().primaryKey(),
  circleId: int("circleId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sessionType: varchar("sessionType", { length: 64 }).notNull().default("جلسة يومية"),
  daysOfWeek: varchar("daysOfWeek", { length: 128 }).notNull(),
  startTime: varchar("startTime", { length: 8 }).notNull(),
  endTime: varchar("endTime", { length: 8 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CirclePeriod = typeof circlePeriods.$inferSelect;
export type InsertCirclePeriod = typeof circlePeriods.$inferInsert;

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

// ===================== TEACHER INVITES =====================
export const teacherInvites = mysqlTable("teacher_invites", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
  circleId: int("circleId").notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  role: mysqlEnum("role", ["teacher", "assistant_teacher"]).default("teacher").notNull(),
  expiresAt: timestamp("expiresAt"),
  usedAt: timestamp("usedAt"),
  usedByUserId: int("usedByUserId"),
  isRevoked: boolean("isRevoked").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeacherInvite = typeof teacherInvites.$inferSelect;
export type InsertTeacherInvite = typeof teacherInvites.$inferInsert;

// ===================== STUDENTS =====================
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  guardianUserId: int("guardianUserId"),
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
  status: mysqlEnum("status", ["draft", "scheduled", "open", "closed", "cancelled"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  startedAt: timestamp("startedAt"),
  closedAt: timestamp("closedAt"),
  notes: text("notes"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("sessions_circle_day_idx").on(table.circleId, table.dayKey), index("sessions_day_key_idx").on(table.dayKey)]);

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
}, (table) => [uniqueIndex("attendance_session_student_unique").on(table.sessionId, table.studentId), index("attendance_student_session_idx").on(table.studentId, table.sessionId)]);

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

// ===================== MEMORIZATION =====================
export const memorization = mysqlTable("memorization", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  surahNumber: int("surahNumber").notNull(),
  toSurahNumber: int("toSurahNumber"),
  fromAyah: int("fromAyah").notNull(),
  toAyah: int("toAyah").notNull(),
  pages: decimal("pages", { precision: 4, scale: 2 }),
  grade: mysqlEnum("grade", ["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).default("good"),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("memorization_session_student_unique").on(table.sessionId, table.studentId), index("memorization_student_session_idx").on(table.studentId, table.sessionId)]);

export type Memorization = typeof memorization.$inferSelect;
export type InsertMemorization = typeof memorization.$inferInsert;

// ===================== REVISION =====================
export const revision = mysqlTable("revision", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  surahNumber: int("surahNumber").notNull(),
  toSurahNumber: int("toSurahNumber"),
  fromAyah: int("fromAyah").notNull(),
  toAyah: int("toAyah").notNull(),
  pages: decimal("pages", { precision: 4, scale: 2 }),
  grade: mysqlEnum("grade", ["excellent", "very_good", "good", "acceptable", "weak", "not_done"]).default("good"),
  notes: text("notes"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("revision_session_student_unique").on(table.sessionId, table.studentId), index("revision_student_session_idx").on(table.studentId, table.sessionId)]);

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
}, (table) => [uniqueIndex("evaluation_session_student_unique").on(table.sessionId, table.studentId), index("evaluation_student_session_idx").on(table.studentId, table.sessionId)]);

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

// ===================== QURAN BOOKMARKS =====================
// علامات مرجعية شخصية؛ لا تحمل نصاً قرآنياً وتبقى معزولة بحسب صاحب الحساب.
export const quranBookmarks = mysqlTable("quran_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  referenceType: mysqlEnum("referenceType", ["page", "ayah"]).notNull(),
  referenceKey: varchar("referenceKey", { length: 32 }).notNull(),
  pageNumber: int("pageNumber").notNull(),
  surahNumber: int("surahNumber"),
  ayahNumber: int("ayahNumber"),
  label: varchar("label", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("quran_bookmarks_user_reference_unique").on(table.userId, table.referenceKey), index("quran_bookmarks_user_created_idx").on(table.userId, table.createdAt)]);

export type QuranBookmark = typeof quranBookmarks.$inferSelect;
export type InsertQuranBookmark = typeof quranBookmarks.$inferInsert;

// ===================== QURAN VERSE PREFERENCES =====================
// مفضلة وملاحظات شخصية؛ المرجع العددي فقط يحافظ على النص القرآني من مصدره الموثق.
export const quranVersePreferences = mysqlTable("quran_verse_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  verseKey: varchar("verseKey", { length: 32 }).notNull(),
  pageNumber: int("pageNumber").notNull(),
  surahNumber: int("surahNumber").notNull(),
  ayahNumber: int("ayahNumber").notNull(),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("quran_verse_preferences_user_verse_unique").on(table.userId, table.verseKey), index("quran_verse_preferences_user_favorite_idx").on(table.userId, table.isFavorite, table.updatedAt)]);

export type QuranVersePreference = typeof quranVersePreferences.$inferSelect;
export type InsertQuranVersePreference = typeof quranVersePreferences.$inferInsert;

// ===================== AUDIT LOG =====================
export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  centerId: int("centerId"),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: int("entityId"),
  oldData: text("oldData"),
  newData: text("newData"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ===================== LOCAL AUTH (بريد وكلمة مرور) =====================
/** بيانات الدخول المحلي: بريد + كلمة مرور مشفرة بـ scrypt. حساب واحد لكل مستخدم. */
export const localCredentials = mysqlTable("local_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  passwordChangedAt: timestamp("passwordChangedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("local_credentials_email_unique").on(table.email), uniqueIndex("local_credentials_user_unique").on(table.userId)]);

export type LocalCredential = typeof localCredentials.$inferSelect;

/** روابط تعيين كلمة المرور لمرة واحدة: ينشئها المدير لمستخدم موجود (مثل الحسابات القديمة بلا كلمة مرور). */
export const passwordSetupTokens = mysqlTable("password_setup_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  createdBy: int("createdBy"),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("password_setup_tokens_hash_unique").on(table.tokenHash), index("password_setup_tokens_user_idx").on(table.userId)]);

export type PasswordSetupToken = typeof passwordSetupTokens.$inferSelect;

// ===================== حدود الاستخدام (مشتركة بين نسخ الخادم وتبقى بعد إعادة التشغيل) =====================
/** نوافذ حد المحاولات لكل مفتاح (مثل login:IP). */
export const rateLimitBuckets = mysqlTable("rate_limit_buckets", {
  bucketKey: varchar("bucketKey", { length: 191 }).primaryKey(),
  count: int("count").default(0).notNull(),
  resetAt: timestamp("resetAt").notNull(),
}, (table) => [index("rate_limit_buckets_reset_idx").on(table.resetAt)]);

/** عدد رسائل المساعد الذكي لكل مستخدم في كل يوم (UTC). */
export const aiDailyUsage = mysqlTable("ai_daily_usage", {
  userId: int("userId").notNull(),
  day: varchar("day", { length: 10 }).notNull(),
  count: int("count").default(0).notNull(),
}, (table) => [uniqueIndex("ai_daily_usage_user_day_unique").on(table.userId, table.day), index("ai_daily_usage_day_idx").on(table.day)]);
