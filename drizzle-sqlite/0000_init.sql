CREATE TABLE `academic_seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'academic_year' NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `access_code_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accessCodeId` integer,
	`attemptedByUserId` integer,
	`codeFingerprint` text NOT NULL,
	`wasSuccessful` integer DEFAULT false NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_code_attempts_code_idx` ON `access_code_attempts` (`accessCodeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `access_code_attempts_fingerprint_idx` ON `access_code_attempts` (`codeFingerprint`,`createdAt`);--> statement-breakpoint
CREATE TABLE `access_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`codeHash` text NOT NULL,
	`codeHint` text NOT NULL,
	`role` text NOT NULL,
	`scopeJson` text,
	`circleId` integer,
	`teacherId` integer,
	`studentId` integer,
	`guardianUserId` integer,
	`createdBy` integer NOT NULL,
	`assignedUserId` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`expiresAt` integer,
	`maxUses` integer DEFAULT 1 NOT NULL,
	`usedCount` integer DEFAULT 0 NOT NULL,
	`failedAttempts` integer DEFAULT 0 NOT NULL,
	`lockedUntil` integer,
	`lastUsedAt` integer,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_codes_hash_unique` ON `access_codes` (`codeHash`);--> statement-breakpoint
CREATE INDEX `access_codes_center_status_idx` ON `access_codes` (`centerId`,`status`);--> statement-breakpoint
CREATE INDEX `access_codes_subject_idx` ON `access_codes` (`studentId`,`guardianUserId`);--> statement-breakpoint
CREATE TABLE `ai_daily_usage` (
	`userId` integer NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_daily_usage_user_day_unique` ON `ai_daily_usage` (`userId`,`day`);--> statement-breakpoint
CREATE INDEX `ai_daily_usage_day_idx` ON `ai_daily_usage` (`day`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`studentId` integer NOT NULL,
	`status` text DEFAULT 'present' NOT NULL,
	`arrivalTime` integer,
	`notes` text,
	`recordedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_session_student_unique` ON `attendance` (`sessionId`,`studentId`);--> statement-breakpoint
CREATE INDEX `attendance_student_session_idx` ON `attendance` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`centerId` integer,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entityId` integer,
	`oldData` text,
	`newData` text,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`phone` text,
	`address` text,
	`supervisorId` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `center_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`centerId` integer NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`isOwner` integer DEFAULT false NOT NULL,
	`grantedBy` integer,
	`grantedAt` integer NOT NULL,
	`expiresAt` integer,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `center_memberships_user_center_unique` ON `center_memberships` (`userId`,`centerId`);--> statement-breakpoint
CREATE INDEX `center_memberships_center_idx` ON `center_memberships` (`centerId`,`status`);--> statement-breakpoint
CREATE TABLE `centers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organizationId` integer NOT NULL,
	`name` text NOT NULL,
	`nameEn` text,
	`description` text,
	`phone` text,
	`email` text,
	`address` text,
	`city` text,
	`logoUrl` text,
	`logoKey` text,
	`managerId` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `circle_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`name` text NOT NULL,
	`sessionType` text DEFAULT 'جلسة يومية' NOT NULL,
	`daysOfWeek` text NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdBy` integer,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `circles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branchId` integer NOT NULL,
	`seasonId` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`teacherId` integer,
	`assistantTeacherId` integer,
	`maxStudents` integer DEFAULT 20,
	`schedule` text,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evaluation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`studentId` integer NOT NULL,
	`tajweedScore` integer,
	`pronunciationScore` integer,
	`memorizationScore` integer,
	`behaviorScore` integer,
	`totalScore` integer,
	`points` integer DEFAULT 0,
	`notes` text,
	`recordedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_session_student_unique` ON `evaluation` (`sessionId`,`studentId`);--> statement-breakpoint
CREATE INDEX `evaluation_student_session_idx` ON `evaluation` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE TABLE `local_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`email` text,
	`phone` text,
	`phoneVerifiedAt` integer,
	`passwordHash` text NOT NULL,
	`emailVerifiedAt` integer,
	`failedAttempts` integer DEFAULT 0 NOT NULL,
	`lockedUntil` integer,
	`passwordChangedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_credentials_email_unique` ON `local_credentials` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `local_credentials_phone_unique` ON `local_credentials` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `local_credentials_user_unique` ON `local_credentials` (`userId`);--> statement-breakpoint
CREATE TABLE `memorization` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`studentId` integer NOT NULL,
	`surahNumber` integer NOT NULL,
	`toSurahNumber` integer,
	`fromAyah` integer NOT NULL,
	`toAyah` integer NOT NULL,
	`pages` numeric,
	`grade` text DEFAULT 'good',
	`notes` text,
	`recordedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memorization_session_student_unique` ON `memorization` (`sessionId`,`studentId`);--> statement-breakpoint
CREATE INDEX `memorization_student_session_idx` ON `memorization` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`relatedId` integer,
	`relatedType` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`providerUserId` text NOT NULL,
	`userId` integer NOT NULL,
	`email` text,
	`createdAt` integer NOT NULL,
	`lastUsedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_user_unique` ON `oauth_accounts` (`provider`,`providerUserId`);--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_idx` ON `oauth_accounts` (`userId`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`nameEn` text,
	`description` text,
	`logo` text,
	`phone` text,
	`email` text,
	`address` text,
	`city` text,
	`country` text DEFAULT 'SA',
	`adminId` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parent_student_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guardianUserId` integer NOT NULL,
	`studentId` integer NOT NULL,
	`centerId` integer NOT NULL,
	`linkedBy` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_student_links_guardian_student_unique` ON `parent_student_links` (`guardianUserId`,`studentId`);--> statement-breakpoint
CREATE INDEX `parent_student_links_guardian_center_idx` ON `parent_student_links` (`guardianUserId`,`centerId`);--> statement-breakpoint
CREATE TABLE `password_setup_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`tokenHash` text NOT NULL,
	`purpose` text DEFAULT 'setup' NOT NULL,
	`createdBy` integer,
	`expiresAt` integer NOT NULL,
	`usedAt` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_setup_tokens_hash_unique` ON `password_setup_tokens` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `password_setup_tokens_user_idx` ON `password_setup_tokens` (`userId`);--> statement-breakpoint
CREATE TABLE `permission_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`centerId` integer NOT NULL,
	`permission` text NOT NULL,
	`effect` text DEFAULT 'allow' NOT NULL,
	`grantedBy` integer NOT NULL,
	`expiresAt` integer,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `permission_grants_lookup_idx` ON `permission_grants` (`userId`,`centerId`,`permission`);--> statement-breakpoint
CREATE INDEX `permission_grants_center_idx` ON `permission_grants` (`centerId`,`revokedAt`);--> statement-breakpoint
CREATE TABLE `quran_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`referenceType` text NOT NULL,
	`referenceKey` text NOT NULL,
	`pageNumber` integer NOT NULL,
	`surahNumber` integer,
	`ayahNumber` integer,
	`label` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quran_bookmarks_user_reference_unique` ON `quran_bookmarks` (`userId`,`referenceKey`);--> statement-breakpoint
CREATE INDEX `quran_bookmarks_user_created_idx` ON `quran_bookmarks` (`userId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `quran_verse_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`verseKey` text NOT NULL,
	`pageNumber` integer NOT NULL,
	`surahNumber` integer NOT NULL,
	`ayahNumber` integer NOT NULL,
	`isFavorite` integer DEFAULT false NOT NULL,
	`note` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quran_verse_preferences_user_verse_unique` ON `quran_verse_preferences` (`userId`,`verseKey`);--> statement-breakpoint
CREATE INDEX `quran_verse_preferences_user_favorite_idx` ON `quran_verse_preferences` (`userId`,`isFavorite`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`bucketKey` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`resetAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_reset_idx` ON `rate_limit_buckets` (`resetAt`);--> statement-breakpoint
CREATE TABLE `reporting_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`attendanceTarget` integer,
	`memorizedPagesTarget` integer,
	`reviewedPagesTarget` integer,
	`updatedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reporting_goals_center_unique` ON `reporting_goals` (`centerId`);--> statement-breakpoint
CREATE TABLE `reporting_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`headerTitle` text,
	`footerText` text,
	`logoUrl` text,
	`logoKey` text,
	`teacherMessageTemplate` text,
	`updatedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reporting_preferences_center_unique` ON `reporting_preferences` (`centerId`);--> statement-breakpoint
CREATE TABLE `revision` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`studentId` integer NOT NULL,
	`surahNumber` integer NOT NULL,
	`toSurahNumber` integer,
	`fromAyah` integer NOT NULL,
	`toAyah` integer NOT NULL,
	`pages` numeric,
	`grade` text DEFAULT 'good',
	`notes` text,
	`recordedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_session_student_unique` ON `revision` (`sessionId`,`studentId`);--> statement-breakpoint
CREATE INDEX `revision_student_session_idx` ON `revision` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`teacherId` integer NOT NULL,
	`seasonId` integer NOT NULL,
	`title` text,
	`type` text DEFAULT 'regular' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduledAt` integer NOT NULL,
	`dayKey` text NOT NULL,
	`startedAt` integer,
	`closedAt` integer,
	`notes` text,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_circle_day_idx` ON `sessions` (`circleId`,`dayKey`);--> statement-breakpoint
CREATE INDEX `sessions_day_key_idx` ON `sessions` (`dayKey`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`guardianUserId` integer,
	`centerId` integer NOT NULL,
	`circleId` integer,
	`name` text NOT NULL,
	`phone` text,
	`guardianPhone` text,
	`guardianName` text,
	`nationalId` text,
	`birthDate` integer,
	`enrollmentDate` integer,
	`lastMemorizedSurah` integer DEFAULT 1,
	`lastMemorizedAyah` integer DEFAULT 1,
	`totalMemorizedJuz` numeric DEFAULT '0',
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacher_invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`centerId` integer NOT NULL,
	`circleId` integer NOT NULL,
	`code` text NOT NULL,
	`role` text DEFAULT 'teacher' NOT NULL,
	`expiresAt` integer,
	`usedAt` integer,
	`usedByUserId` integer,
	`isRevoked` integer DEFAULT false NOT NULL,
	`createdBy` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_invites_code_unique` ON `teacher_invites` (`code`);--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`centerId` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`nationalId` text,
	`specialization` text,
	`qualification` text,
	`hireDate` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_scopes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`centerId` integer NOT NULL,
	`scopeType` text NOT NULL,
	`scopeId` integer,
	`grantedBy` integer,
	`expiresAt` integer,
	`revokedAt` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_scopes_lookup_idx` ON `user_scopes` (`userId`,`centerId`,`scopeType`);--> statement-breakpoint
CREATE INDEX `user_scopes_resource_idx` ON `user_scopes` (`centerId`,`scopeType`,`scopeId`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`phone` text,
	`avatar` text,
	`isActive` integer DEFAULT true NOT NULL,
	`accountStatus` text DEFAULT 'active' NOT NULL,
	`accessRevokedAt` integer,
	`lastActiveAt` integer,
	`deletedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL,
	`sessionVersion` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);