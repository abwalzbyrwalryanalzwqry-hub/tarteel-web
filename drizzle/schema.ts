import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  mediumtext,
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
  // هوية التقارير (الألوان والشعار والترويسة والتذييل) بصيغة JSON، حتى 400KB (reports/identity).
  reportIdentity: mediumtext("reportIdentity"),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Center = typeof centers.$inferSelect;
export type InsertCenter = typeof centers.$inferInsert;

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

// ===================== CIRCLES (HALAQAT) =====================
export const circles = mysqlTable("circles", {
  id: int("id").autoincrement().primaryKey(),
  centerId: int("centerId").notNull(),
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
  memorizeDir: varchar("memorizeDir", { length: 8 }).default("forward").notNull(),
  reviewDir: varchar("reviewDir", { length: 8 }).default("forward").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ===================== DAILY RECORD =====================
// السجل اليومي للحلقة (منقول من زِن، docs/DAILY_RECORD.md): سجل واحد لكل حلقة في كل يوم، يمرّ بـ
// مفتوح ← مكتمل ← معتمد. سطر كل طالب في daily_entries: الحضور والتقييم والملاحظة ومدى الحفظ والمراجعة
// (مدى واحد لكل نوع قد يمتد عبر سور، بأرقام السور). version في السجل والسطر يمنع الكتابة فوق تعديل غيرك.
export const dailyRecords = mysqlTable("daily_records", {
  id: int("id").autoincrement().primaryKey(),
  circleId: int("circleId").notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["open", "completed", "locked"]).default("open").notNull(),
  notes: text("notes"),
  version: int("version").default(1).notNull(),
  openedBy: int("openedBy"),
  completedBy: int("completedBy"),
  completedAt: timestamp("completedAt"),
  lockedBy: int("lockedBy"),
  lockedAt: timestamp("lockedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("daily_records_circle_date_unique").on(table.circleId, table.recordDate), index("daily_records_date_idx").on(table.recordDate)]);

export type DailyRecord = typeof dailyRecords.$inferSelect;
export type InsertDailyRecord = typeof dailyRecords.$inferInsert;

export const dailyEntries = mysqlTable("daily_entries", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("recordId").notNull(),
  circleId: int("circleId").notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["present", "late", "absent", "excused"]),
  reason: varchar("reason", { length: 300 }),
  note: text("note"),
  evalOverall: tinyint("evalOverall"),
  evalTajweed: tinyint("evalTajweed"),
  evalPronunciation: tinyint("evalPronunciation"),
  evalBehavior: tinyint("evalBehavior"),
  memFromSurah: int("memFromSurah"),
  memFromAyah: int("memFromAyah"),
  memToSurah: int("memToSurah"),
  memToAyah: int("memToAyah"),
  memGrade: tinyint("memGrade"),
  memError: varchar("memError", { length: 16 }),
  memNotes: text("memNotes"),
  revFromSurah: int("revFromSurah"),
  revFromAyah: int("revFromAyah"),
  revToSurah: int("revToSurah"),
  revToAyah: int("revToAyah"),
  revGrade: tinyint("revGrade"),
  revError: varchar("revError", { length: 16 }),
  revNotes: text("revNotes"),
  version: int("version").default(1).notNull(),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("daily_entries_record_student_unique").on(table.recordId, table.studentId), index("daily_entries_student_date_idx").on(table.studentId, table.recordDate), index("daily_entries_circle_date_idx").on(table.circleId, table.recordDate)]);

export type DailyEntry = typeof dailyEntries.$inferSelect;
export type InsertDailyEntry = typeof dailyEntries.$inferInsert;

// سلّة السجل اليومي: لقطة اليوم المحذوف (السجل وأسطر الطلاب) تبقى 30 يوماً ويُستعاد منها.
export const dailyRecordTrash = mysqlTable("daily_record_trash", {
  id: int("id").autoincrement().primaryKey(),
  circleId: int("circleId").notNull(),
  recordDate: varchar("recordDate", { length: 10 }).notNull(),
  snapshot: mediumtext("snapshot").notNull(),
  attendanceCount: int("attendanceCount").default(0).notNull(),
  workCount: int("workCount").default(0).notNull(),
  deletedBy: int("deletedBy"),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  restoredAt: timestamp("restoredAt"),
}, (table) => [index("daily_record_trash_circle_idx").on(table.circleId, table.deletedAt)]);

export type DailyRecordTrash = typeof dailyRecordTrash.$inferSelect;

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

// ===================== QURAN READING STATE =====================
// حالة القراءة في قسم المصحف (العلامات والختمة وسجل القراءة) لكل حساب: نسخة من ذاكرة الجهاز تُدمج
// «الأحدث يغلب» لكل حقل على حدة (quranReadingState.sync). القيم JSON كما يحفظها الجهاز، والأوقات ISO.
export const quranReadingStates = mysqlTable("quran_reading_states", {
  userId: int("userId").primaryKey(),
  bookmarks: mediumtext("bookmarks"),
  bookmarksAt: varchar("bookmarksAt", { length: 32 }),
  khatmah: text("khatmah"),
  khatmahAt: varchar("khatmahAt", { length: 32 }),
  history: mediumtext("history"),
  historyAt: varchar("historyAt", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuranReadingState = typeof quranReadingStates.$inferSelect;

// ===================== QURAN REVIEW CARDS =====================
// المراجعة المتباعدة (SM-2) للمقاطع التي أتقنها صاحب الحساب في وضع الحفظ. السهولة بالمئات (250 = 2.5)،
// وموعد المراجعة يوم بتوقيت المنصة (YYYY-MM-DD).
export const quranReviewCards = mysqlTable("quran_review_cards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  surahNumber: int("surahNumber").notNull(),
  fromAyah: int("fromAyah").notNull(),
  toAyah: int("toAyah").notNull(),
  easeHundredths: int("easeHundredths").default(250).notNull(),
  intervalDays: int("intervalDays").default(0).notNull(),
  repetitions: int("repetitions").default(0).notNull(),
  lapses: int("lapses").default(0).notNull(),
  lastScore: int("lastScore"),
  lastReviewedAt: timestamp("lastReviewedAt"),
  dueDate: varchar("dueDate", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("quran_review_cards_user_range_unique").on(table.userId, table.surahNumber, table.fromAyah, table.toAyah), index("quran_review_cards_user_due_idx").on(table.userId, table.dueDate)]);

export type QuranReviewCard = typeof quranReviewCards.$inferSelect;

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
  /** معرّف الدخول: بريد أو رقم هاتف أو كلاهما؛ يلزم واحد منهما على الأقل (يتحقق منه الخادم). */
  email: varchar("email", { length: 320 }),
  /** رقم الهاتف بصيغة E.164 الموحّدة (‎+967771234567)؛ انظر shared/phone.ts. */
  phone: varchar("phone", { length: 20 }),
  /** وقت تأكيد الرقم برمز SMS (Twilio Verify) عند التسجيل أو من الإعدادات أو باستعادة كلمة المرور. */
  phoneVerifiedAt: timestamp("phoneVerifiedAt"),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** وقت تأكيد البريد (برابط مرسل إليه أو بدخول Google ببريد مؤكد). */
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  failedAttempts: int("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  passwordChangedAt: timestamp("passwordChangedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("local_credentials_email_unique").on(table.email), uniqueIndex("local_credentials_phone_unique").on(table.phone), uniqueIndex("local_credentials_user_unique").on(table.userId)]);

export type LocalCredential = typeof localCredentials.$inferSelect;

/**
 * التحقق العكسي من رقم الهاتف عبر واتساب: يعرض ترتيل رمزاً قصيراً، فيرسله المستخدم من واتساب رقمه
 * إلى رقم المركز، ويصل إلى الخادم عبر Webhook من WhatsApp Cloud API مع رقم المرسل كما يعرفه واتساب.
 * لا يُرسل الخادم أي رسالة، فلا تكلفة. الرمز والتذكرة يُخزّنان مُجزّأين (sha256) فقط.
 * التذكرة سرّ يملكه المتصفح الذي بدأ التحقق، ويقدّمها لإكمال التسجيل أو الاستعادة بعد التأكيد.
 */
export const phoneVerifications = mysqlTable("phone_verifications", {
  id: int("id").autoincrement().primaryKey(),
  purpose: mysqlEnum("purpose", ["signup", "reset", "verify", "add_phone"]).notNull(),
  /** الرقم المطلوب تأكيده بصيغة E.164. */
  phone: varchar("phone", { length: 20 }).notNull(),
  /** صاحب الطلب عند التأكيد من داخل الحساب (verify وadd_phone). */
  userId: int("userId"),
  codeHash: varchar("codeHash", { length: 64 }).notNull(),
  ticketHash: varchar("ticketHash", { length: 64 }).notNull(),
  /** pending: بانتظار الرسالة. verified: وصلت من الرقم نفسه. mismatch: وصل الرمز من رقم آخر. consumed: استُخدمت التذكرة. */
  status: mysqlEnum("status", ["pending", "verified", "mismatch", "consumed"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("phone_verifications_ticket_unique").on(table.ticketHash), index("phone_verifications_code_idx").on(table.codeHash, table.status), index("phone_verifications_phone_idx").on(table.phone, table.createdAt)]);

export type PhoneVerification = typeof phoneVerifications.$inferSelect;

/** روابط تعيين كلمة المرور لمرة واحدة: ينشئها المدير لمستخدم موجود (مثل الحسابات القديمة بلا كلمة مرور). */
export const passwordSetupTokens = mysqlTable("password_setup_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  /** setup: رابط من المدير (72 ساعة). reset: استعادة بالبريد (30 دقيقة). verify_email: تأكيد البريد. */
  purpose: mysqlEnum("purpose", ["setup", "reset", "verify_email"]).default("setup").notNull(),
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

// ===================== الدخول بحسابات خارجية (Google) =====================
/** ربط حساب خارجي بمستخدم ترتيل. providerUserId هو sub الثابت من Google، لا البريد. */
export const oauthAccounts = mysqlTable("oauth_accounts", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerUserId: varchar("providerUserId", { length: 191 }).notNull(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
}, (table) => [uniqueIndex("oauth_accounts_provider_user_unique").on(table.provider, table.providerUserId), index("oauth_accounts_user_idx").on(table.userId)]);

export type OauthAccount = typeof oauthAccounts.$inferSelect;
