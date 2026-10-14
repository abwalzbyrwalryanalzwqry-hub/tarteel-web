// ⚠️ ملف مولّد آلياً من drizzle/schema.ts بواسطة scripts/gen-sqlite-schema.ts — لا تعدّله يدوياً.
// يُستخدم في نسخة ترتيل المحلية (SQLite داخل التطبيق). بعد تعديل schema.ts شغّل: pnpm db:sqlite
import {
  index,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ===================== USERS =====================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", {
    enum: [
      "super_admin",
      "org_admin",
      "center_manager",
      "supervisor",
      "guide",
      "teacher",
      "assistant_teacher",
      "student",
      "guardian",
      "user",
      "admin",
    ],
  })
    .default("user")
    .notNull(),
  phone: text("phone"),
  avatar: text("avatar"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  accountStatus: text("accountStatus", {
    enum: ["pending", "active", "suspended", "disabled", "archived"],
  })
    .default("active")
    .notNull(),
  accessRevokedAt: integer("accessRevokedAt", { mode: "timestamp_ms" }),
  lastActiveAt: integer("lastActiveAt", { mode: "timestamp_ms" }),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  /** يُرفع عند تغيير كلمة المرور أو «الخروج من كل الأجهزة» فتبطل كل الجلسات السابقة. */
  sessionVersion: integer("sessionVersion").default(0).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===================== ORGANIZATIONS =====================
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("nameEn"),
  description: text("description"),
  logo: text("logo"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  country: text("country").default("SA"),
  adminId: integer("adminId"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ===================== CENTERS =====================
export const centers = sqliteTable("centers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organizationId").notNull(),
  name: text("name").notNull(),
  nameEn: text("nameEn"),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  logoUrl: text("logoUrl"),
  logoKey: text("logoKey"),
  managerId: integer("managerId"),
  // هوية التقارير (الألوان والشعار والترويسة والتذييل) بصيغة JSON، حتى 400KB (reports/identity).
  reportIdentity: text("reportIdentity"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Center = typeof centers.$inferSelect;
export type InsertCenter = typeof centers.$inferInsert;

// ===================== ACCESS CONTROL =====================
// تفصل العضوية هوية الحساب العامة عن دوره وحالته داخل كل مركز.
export const centerMemberships = sqliteTable(
  "center_memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    centerId: integer("centerId").notNull(),
    role: text("role", {
      enum: [
        "center_manager",
        "supervisor",
        "guide",
        "teacher",
        "assistant_teacher",
        "student",
        "guardian",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "active", "suspended", "disabled", "archived"],
    })
      .default("pending")
      .notNull(),
    isOwner: integer("isOwner", { mode: "boolean" }).default(false).notNull(),
    grantedBy: integer("grantedBy"),
    grantedAt: integer("grantedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("center_memberships_user_center_unique").on(
      table.userId,
      table.centerId
    ),
    index("center_memberships_center_idx").on(table.centerId, table.status),
  ]
);
export type CenterMembership = typeof centerMemberships.$inferSelect;
export type InsertCenterMembership = typeof centerMemberships.$inferInsert;

// منح تفصيلي قابل للانتهاء والسحب، مع مرجع للمفوض لمنع التصعيد.
export const permissionGrants = sqliteTable(
  "permission_grants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    centerId: integer("centerId").notNull(),
    permission: text("permission").notNull(),
    effect: text("effect", { enum: ["allow", "deny"] })
      .default("allow")
      .notNull(),
    grantedBy: integer("grantedBy").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    index("permission_grants_lookup_idx").on(
      table.userId,
      table.centerId,
      table.permission
    ),
    index("permission_grants_center_idx").on(table.centerId, table.revokedAt),
  ]
);
export type PermissionGrant = typeof permissionGrants.$inferSelect;
export type InsertPermissionGrant = typeof permissionGrants.$inferInsert;

// نطاقات مستقلة لتدعم أكثر من حلقة أو معلم أو طالب للمستخدم الواحد.
export const userScopes = sqliteTable(
  "user_scopes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    centerId: integer("centerId").notNull(),
    scopeType: text("scopeType", {
      enum: ["center", "circle", "teacher", "student"],
    }).notNull(),
    scopeId: integer("scopeId"),
    grantedBy: integer("grantedBy"),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("user_scopes_lookup_idx").on(
      table.userId,
      table.centerId,
      table.scopeType
    ),
    index("user_scopes_resource_idx").on(
      table.centerId,
      table.scopeType,
      table.scopeId
    ),
  ]
);
export type UserScope = typeof userScopes.$inferSelect;
export type InsertUserScope = typeof userScopes.$inferInsert;

// لا تخزن الأكواد نفسها؛ يحتفظ النظام بالـ hash والتلميح فقط بعد الإنشاء.
export const accessCodes = sqliteTable(
  "access_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("centerId").notNull(),
    codeHash: text("codeHash").notNull(),
    codeHint: text("codeHint").notNull(),
    role: text("role", {
      enum: [
        "center_manager",
        "supervisor",
        "guide",
        "teacher",
        "assistant_teacher",
        "student",
        "guardian",
      ],
    }).notNull(),
    scopeJson: text("scopeJson"),
    circleId: integer("circleId"),
    teacherId: integer("teacherId"),
    studentId: integer("studentId"),
    guardianUserId: integer("guardianUserId"),
    createdBy: integer("createdBy").notNull(),
    assignedUserId: integer("assignedUserId"),
    status: text("status", {
      enum: ["active", "used", "expired", "revoked", "disabled"],
    })
      .default("active")
      .notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    maxUses: integer("maxUses").default(1).notNull(),
    usedCount: integer("usedCount").default(0).notNull(),
    failedAttempts: integer("failedAttempts").default(0).notNull(),
    lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
    lastUsedAt: integer("lastUsedAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("access_codes_hash_unique").on(table.codeHash),
    index("access_codes_center_status_idx").on(table.centerId, table.status),
    index("access_codes_subject_idx").on(table.studentId, table.guardianUserId),
  ]
);
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = typeof accessCodes.$inferInsert;

export const accessCodeAttempts = sqliteTable(
  "access_code_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accessCodeId: integer("accessCodeId"),
    attemptedByUserId: integer("attemptedByUserId"),
    codeFingerprint: text("codeFingerprint").notNull(),
    wasSuccessful: integer("wasSuccessful", { mode: "boolean" })
      .default(false)
      .notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index("access_code_attempts_code_idx").on(
      table.accessCodeId,
      table.createdAt
    ),
    index("access_code_attempts_fingerprint_idx").on(
      table.codeFingerprint,
      table.createdAt
    ),
  ]
);

export const parentStudentLinks = sqliteTable(
  "parent_student_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guardianUserId: integer("guardianUserId").notNull(),
    studentId: integer("studentId").notNull(),
    centerId: integer("centerId").notNull(),
    linkedBy: integer("linkedBy"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("parent_student_links_guardian_student_unique").on(
      table.guardianUserId,
      table.studentId
    ),
    index("parent_student_links_guardian_center_idx").on(
      table.guardianUserId,
      table.centerId
    ),
  ]
);

// ===================== CIRCLES (HALAQAT) =====================
export const circles = sqliteTable("circles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  centerId: integer("centerId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  teacherId: integer("teacherId"),
  assistantTeacherId: integer("assistantTeacherId"),
  maxStudents: integer("maxStudents").default(20),
  schedule: text("schedule"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Circle = typeof circles.$inferSelect;
export type InsertCircle = typeof circles.$inferInsert;

// ===================== TEACHERS =====================
export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  centerId: integer("centerId").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  nationalId: text("nationalId"),
  specialization: text("specialization"),
  qualification: text("qualification"),
  hireDate: integer("hireDate", { mode: "timestamp_ms" }),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = typeof teachers.$inferInsert;

// ===================== TEACHER INVITES =====================
export const teacherInvites = sqliteTable("teacher_invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  centerId: integer("centerId").notNull(),
  circleId: integer("circleId").notNull(),
  code: text("code").notNull().unique(),
  role: text("role", { enum: ["teacher", "assistant_teacher"] })
    .default("teacher")
    .notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
  usedAt: integer("usedAt", { mode: "timestamp_ms" }),
  usedByUserId: integer("usedByUserId"),
  isRevoked: integer("isRevoked", { mode: "boolean" }).default(false).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type TeacherInvite = typeof teacherInvites.$inferSelect;
export type InsertTeacherInvite = typeof teacherInvites.$inferInsert;

// ===================== STUDENTS =====================
export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  guardianUserId: integer("guardianUserId"),
  centerId: integer("centerId").notNull(),
  circleId: integer("circleId"),
  name: text("name").notNull(),
  phone: text("phone"),
  guardianPhone: text("guardianPhone"),
  guardianName: text("guardianName"),
  nationalId: text("nationalId"),
  birthDate: integer("birthDate", { mode: "timestamp_ms" }),
  enrollmentDate: integer("enrollmentDate", {
    mode: "timestamp_ms",
  }).$defaultFn(() => new Date()),
  lastMemorizedSurah: integer("lastMemorizedSurah").default(1),
  lastMemorizedAyah: integer("lastMemorizedAyah").default(1),
  totalMemorizedJuz: numeric("totalMemorizedJuz").default("0"),
  memorizeDir: text("memorizeDir").default("forward").notNull(),
  reviewDir: text("reviewDir").default("forward").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ===================== DAILY RECORD =====================
// السجل اليومي للحلقة (منقول من زِن، docs/DAILY_RECORD.md): سجل واحد لكل حلقة في كل يوم، يمرّ بـ
// مفتوح ← مكتمل ← معتمد. سطر كل طالب في daily_entries: الحضور والتقييم والملاحظة ومدى الحفظ والمراجعة
// (مدى واحد لكل نوع قد يمتد عبر سور، بأرقام السور). version في السجل والسطر يمنع الكتابة فوق تعديل غيرك.
export const dailyRecords = sqliteTable(
  "daily_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    circleId: integer("circleId").notNull(),
    recordDate: text("recordDate").notNull(),
    status: text("status", { enum: ["open", "completed", "locked"] })
      .default("open")
      .notNull(),
    notes: text("notes"),
    version: integer("version").default(1).notNull(),
    openedBy: integer("openedBy"),
    completedBy: integer("completedBy"),
    completedAt: integer("completedAt", { mode: "timestamp_ms" }),
    lockedBy: integer("lockedBy"),
    lockedAt: integer("lockedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("daily_records_circle_date_unique").on(
      table.circleId,
      table.recordDate
    ),
    index("daily_records_date_idx").on(table.recordDate),
  ]
);

export type DailyRecord = typeof dailyRecords.$inferSelect;
export type InsertDailyRecord = typeof dailyRecords.$inferInsert;

export const dailyEntries = sqliteTable(
  "daily_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recordId: integer("recordId").notNull(),
    circleId: integer("circleId").notNull(),
    recordDate: text("recordDate").notNull(),
    studentId: integer("studentId").notNull(),
    status: text("status", { enum: ["present", "late", "absent", "excused"] }),
    reason: text("reason"),
    note: text("note"),
    evalOverall: integer("evalOverall"),
    evalTajweed: integer("evalTajweed"),
    evalPronunciation: integer("evalPronunciation"),
    evalBehavior: integer("evalBehavior"),
    memFromSurah: integer("memFromSurah"),
    memFromAyah: integer("memFromAyah"),
    memToSurah: integer("memToSurah"),
    memToAyah: integer("memToAyah"),
    memGrade: integer("memGrade"),
    memError: text("memError"),
    memNotes: text("memNotes"),
    revFromSurah: integer("revFromSurah"),
    revFromAyah: integer("revFromAyah"),
    revToSurah: integer("revToSurah"),
    revToAyah: integer("revToAyah"),
    revGrade: integer("revGrade"),
    revError: text("revError"),
    revNotes: text("revNotes"),
    version: integer("version").default(1).notNull(),
    recordedBy: integer("recordedBy"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("daily_entries_record_student_unique").on(
      table.recordId,
      table.studentId
    ),
    index("daily_entries_student_date_idx").on(
      table.studentId,
      table.recordDate
    ),
    index("daily_entries_circle_date_idx").on(table.circleId, table.recordDate),
  ]
);

export type DailyEntry = typeof dailyEntries.$inferSelect;
export type InsertDailyEntry = typeof dailyEntries.$inferInsert;

// سلّة السجل اليومي: لقطة اليوم المحذوف (السجل وأسطر الطلاب) تبقى 30 يوماً ويُستعاد منها.
export const dailyRecordTrash = sqliteTable(
  "daily_record_trash",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    circleId: integer("circleId").notNull(),
    recordDate: text("recordDate").notNull(),
    snapshot: text("snapshot").notNull(),
    attendanceCount: integer("attendanceCount").default(0).notNull(),
    workCount: integer("workCount").default(0).notNull(),
    deletedBy: integer("deletedBy"),
    deletedAt: integer("deletedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    restoredAt: integer("restoredAt", { mode: "timestamp_ms" }),
  },
  table => [
    index("daily_record_trash_circle_idx").on(table.circleId, table.deletedAt),
  ]
);

export type DailyRecordTrash = typeof dailyRecordTrash.$inferSelect;

// ===================== NOTIFICATIONS =====================
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: [
      "info",
      "warning",
      "success",
      "error",
      "attendance",
      "session",
      "memorization",
    ],
  })
    .default("info")
    .notNull(),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  relatedId: integer("relatedId"),
  relatedType: text("relatedType"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ===================== QURAN READING STATE =====================
// حالة القراءة في قسم المصحف (العلامات والختمة وسجل القراءة) لكل حساب: نسخة من ذاكرة الجهاز تُدمج
// «الأحدث يغلب» لكل حقل على حدة (quranReadingState.sync). القيم JSON كما يحفظها الجهاز، والأوقات ISO.
export const quranReadingStates = sqliteTable("quran_reading_states", {
  userId: integer("userId").primaryKey(),
  bookmarks: text("bookmarks"),
  bookmarksAt: text("bookmarksAt"),
  khatmah: text("khatmah"),
  khatmahAt: text("khatmahAt"),
  history: text("history"),
  historyAt: text("historyAt"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export type QuranReadingState = typeof quranReadingStates.$inferSelect;

// ===================== QURAN REVIEW CARDS =====================
// المراجعة المتباعدة (SM-2) للمقاطع التي أتقنها صاحب الحساب في وضع الحفظ. السهولة بالمئات (250 = 2.5)،
// وموعد المراجعة يوم بتوقيت المنصة (YYYY-MM-DD).
export const quranReviewCards = sqliteTable(
  "quran_review_cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    surahNumber: integer("surahNumber").notNull(),
    fromAyah: integer("fromAyah").notNull(),
    toAyah: integer("toAyah").notNull(),
    easeHundredths: integer("easeHundredths").default(250).notNull(),
    intervalDays: integer("intervalDays").default(0).notNull(),
    repetitions: integer("repetitions").default(0).notNull(),
    lapses: integer("lapses").default(0).notNull(),
    lastScore: integer("lastScore"),
    lastReviewedAt: integer("lastReviewedAt", { mode: "timestamp_ms" }),
    dueDate: text("dueDate").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("quran_review_cards_user_range_unique").on(
      table.userId,
      table.surahNumber,
      table.fromAyah,
      table.toAyah
    ),
    index("quran_review_cards_user_due_idx").on(table.userId, table.dueDate),
  ]
);

export type QuranReviewCard = typeof quranReviewCards.$inferSelect;

// ===================== AUDIT LOG =====================
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId"),
  centerId: integer("centerId"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entityId"),
  oldData: text("oldData"),
  newData: text("newData"),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ===================== LOCAL AUTH (بريد وكلمة مرور) =====================
/** بيانات الدخول المحلي: بريد + كلمة مرور مشفرة بـ scrypt. حساب واحد لكل مستخدم. */
export const localCredentials = sqliteTable(
  "local_credentials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    /** معرّف الدخول: بريد أو رقم هاتف أو كلاهما؛ يلزم واحد منهما على الأقل (يتحقق منه الخادم). */
    email: text("email"),
    /** رقم الهاتف بصيغة E.164 الموحّدة (‎+967771234567)؛ انظر shared/phone.ts. */
    phone: text("phone"),
    /** وقت تأكيد الرقم برمز SMS (Twilio Verify) عند التسجيل أو من الإعدادات أو باستعادة كلمة المرور. */
    phoneVerifiedAt: integer("phoneVerifiedAt", { mode: "timestamp_ms" }),
    passwordHash: text("passwordHash").notNull(),
    /** وقت تأكيد البريد (برابط مرسل إليه أو بدخول Google ببريد مؤكد). */
    emailVerifiedAt: integer("emailVerifiedAt", { mode: "timestamp_ms" }),
    failedAttempts: integer("failedAttempts").default(0).notNull(),
    lockedUntil: integer("lockedUntil", { mode: "timestamp_ms" }),
    passwordChangedAt: integer("passwordChangedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("local_credentials_email_unique").on(table.email),
    uniqueIndex("local_credentials_phone_unique").on(table.phone),
    uniqueIndex("local_credentials_user_unique").on(table.userId),
  ]
);

export type LocalCredential = typeof localCredentials.$inferSelect;

/**
 * التحقق العكسي من رقم الهاتف عبر واتساب: يعرض ترتيل رمزاً قصيراً، فيرسله المستخدم من واتساب رقمه
 * إلى رقم المركز، ويصل إلى الخادم عبر Webhook من WhatsApp Cloud API مع رقم المرسل كما يعرفه واتساب.
 * لا يُرسل الخادم أي رسالة، فلا تكلفة. الرمز والتذكرة يُخزّنان مُجزّأين (sha256) فقط.
 * التذكرة سرّ يملكه المتصفح الذي بدأ التحقق، ويقدّمها لإكمال التسجيل أو الاستعادة بعد التأكيد.
 */
export const phoneVerifications = sqliteTable(
  "phone_verifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purpose: text("purpose", {
      enum: ["signup", "reset", "verify", "add_phone"],
    }).notNull(),
    /** الرقم المطلوب تأكيده بصيغة E.164. */
    phone: text("phone").notNull(),
    /** صاحب الطلب عند التأكيد من داخل الحساب (verify وadd_phone). */
    userId: integer("userId"),
    codeHash: text("codeHash").notNull(),
    ticketHash: text("ticketHash").notNull(),
    /** pending: بانتظار الرسالة. verified: وصلت من الرقم نفسه. mismatch: وصل الرمز من رقم آخر. consumed: استُخدمت التذكرة. */
    status: text("status", {
      enum: ["pending", "verified", "mismatch", "consumed"],
    })
      .default("pending")
      .notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    verifiedAt: integer("verifiedAt", { mode: "timestamp_ms" }),
    consumedAt: integer("consumedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("phone_verifications_ticket_unique").on(table.ticketHash),
    index("phone_verifications_code_idx").on(table.codeHash, table.status),
    index("phone_verifications_phone_idx").on(table.phone, table.createdAt),
  ]
);

export type PhoneVerification = typeof phoneVerifications.$inferSelect;

/** روابط تعيين كلمة المرور لمرة واحدة: ينشئها المدير لمستخدم موجود (مثل الحسابات القديمة بلا كلمة مرور). */
export const passwordSetupTokens = sqliteTable(
  "password_setup_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    tokenHash: text("tokenHash").notNull(),
    /** setup: رابط من المدير (72 ساعة). reset: استعادة بالبريد (30 دقيقة). verify_email: تأكيد البريد. */
    purpose: text("purpose", { enum: ["setup", "reset", "verify_email"] })
      .default("setup")
      .notNull(),
    createdBy: integer("createdBy"),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("usedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("password_setup_tokens_hash_unique").on(table.tokenHash),
    index("password_setup_tokens_user_idx").on(table.userId),
  ]
);

export type PasswordSetupToken = typeof passwordSetupTokens.$inferSelect;

// ===================== حدود الاستخدام (مشتركة بين نسخ الخادم وتبقى بعد إعادة التشغيل) =====================
/** نوافذ حد المحاولات لكل مفتاح (مثل login:IP). */
export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    bucketKey: text("bucketKey").primaryKey(),
    count: integer("count").default(0).notNull(),
    resetAt: integer("resetAt", { mode: "timestamp_ms" }).notNull(),
  },
  table => [index("rate_limit_buckets_reset_idx").on(table.resetAt)]
);

/** عدد رسائل المساعد الذكي لكل مستخدم في كل يوم (UTC). */
export const aiDailyUsage = sqliteTable(
  "ai_daily_usage",
  {
    userId: integer("userId").notNull(),
    day: text("day").notNull(),
    count: integer("count").default(0).notNull(),
  },
  table => [
    uniqueIndex("ai_daily_usage_user_day_unique").on(table.userId, table.day),
    index("ai_daily_usage_day_idx").on(table.day),
  ]
);

// ===================== الدخول بحسابات خارجية (Google) =====================
/** ربط حساب خارجي بمستخدم ترتيل. providerUserId هو sub الثابت من Google، لا البريد. */
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    providerUserId: text("providerUserId").notNull(),
    userId: integer("userId").notNull(),
    email: text("email"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    lastUsedAt: integer("lastUsedAt", { mode: "timestamp_ms" }),
  },
  table => [
    uniqueIndex("oauth_accounts_provider_user_unique").on(
      table.provider,
      table.providerUserId
    ),
    index("oauth_accounts_user_idx").on(table.userId),
  ]
);

export type OauthAccount = typeof oauthAccounts.$inferSelect;
