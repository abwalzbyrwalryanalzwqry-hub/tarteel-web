CREATE TABLE `access_code_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessCodeId` int,
	`attemptedByUserId` int,
	`codeFingerprint` varchar(64) NOT NULL,
	`wasSuccessful` boolean NOT NULL DEFAULT false,
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_code_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `access_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`codeHint` varchar(24) NOT NULL,
	`role` enum('center_manager','supervisor','guide','teacher','assistant_teacher','student','guardian') NOT NULL,
	`scopeJson` text,
	`circleId` int,
	`teacherId` int,
	`studentId` int,
	`guardianUserId` int,
	`createdBy` int NOT NULL,
	`assignedUserId` int,
	`status` enum('active','used','expired','revoked','disabled') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`maxUses` int NOT NULL DEFAULT 1,
	`usedCount` int NOT NULL DEFAULT 0,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_codes_hash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `center_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`centerId` int NOT NULL,
	`role` enum('center_manager','supervisor','guide','teacher','assistant_teacher','student','guardian') NOT NULL,
	`status` enum('pending','active','suspended','disabled','archived') NOT NULL DEFAULT 'pending',
	`isOwner` boolean NOT NULL DEFAULT false,
	`grantedBy` int,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `center_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `center_memberships_user_center_unique` UNIQUE(`userId`,`centerId`)
);
--> statement-breakpoint
CREATE TABLE `parent_student_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`guardianUserId` int NOT NULL,
	`studentId` int NOT NULL,
	`centerId` int NOT NULL,
	`linkedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parent_student_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `parent_student_links_guardian_student_unique` UNIQUE(`guardianUserId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `permission_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`centerId` int NOT NULL,
	`permission` varchar(96) NOT NULL,
	`effect` enum('allow','deny') NOT NULL DEFAULT 'allow',
	`grantedBy` int NOT NULL,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permission_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`centerId` int NOT NULL,
	`scopeType` enum('center','circle','teacher','student') NOT NULL,
	`scopeId` int,
	`grantedBy` int,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','org_admin','center_manager','supervisor','guide','teacher','assistant_teacher','student','guardian','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `audit_log` ADD `centerId` int;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `userAgent` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `accountStatus` enum('pending','active','suspended','disabled','archived') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accessRevokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastActiveAt` timestamp;--> statement-breakpoint
CREATE INDEX `access_code_attempts_code_idx` ON `access_code_attempts` (`accessCodeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `access_code_attempts_fingerprint_idx` ON `access_code_attempts` (`codeFingerprint`,`createdAt`);--> statement-breakpoint
CREATE INDEX `access_codes_center_status_idx` ON `access_codes` (`centerId`,`status`);--> statement-breakpoint
CREATE INDEX `access_codes_subject_idx` ON `access_codes` (`studentId`,`guardianUserId`);--> statement-breakpoint
CREATE INDEX `center_memberships_center_idx` ON `center_memberships` (`centerId`,`status`);--> statement-breakpoint
CREATE INDEX `parent_student_links_guardian_center_idx` ON `parent_student_links` (`guardianUserId`,`centerId`);--> statement-breakpoint
CREATE INDEX `permission_grants_lookup_idx` ON `permission_grants` (`userId`,`centerId`,`permission`);--> statement-breakpoint
CREATE INDEX `permission_grants_center_idx` ON `permission_grants` (`centerId`,`revokedAt`);--> statement-breakpoint
CREATE INDEX `user_scopes_lookup_idx` ON `user_scopes` (`userId`,`centerId`,`scopeType`);--> statement-breakpoint
CREATE INDEX `user_scopes_resource_idx` ON `user_scopes` (`centerId`,`scopeType`,`scopeId`);
--> statement-breakpoint
INSERT INTO `center_memberships` (`userId`, `centerId`, `role`, `status`, `isOwner`, `grantedBy`)
SELECT u.id, c.id, 'center_manager', 'active', true, u.id
FROM `users` u
INNER JOIN `centers` c ON c.deletedAt IS NULL
WHERE u.role IN ('super_admin', 'admin', 'org_admin', 'center_manager') AND u.isActive = true
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `status` = VALUES(`status`), `isOwner` = VALUES(`isOwner`), `revokedAt` = NULL;
--> statement-breakpoint
INSERT INTO `center_memberships` (`userId`, `centerId`, `role`, `status`, `isOwner`, `grantedBy`)
SELECT t.userId, t.centerId, IF(u.role = 'assistant_teacher', 'assistant_teacher', 'teacher'), 'active', false, t.userId
FROM `teachers` t
INNER JOIN `users` u ON u.id = t.userId
WHERE t.userId IS NOT NULL AND t.deletedAt IS NULL AND t.isActive = true
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `status` = VALUES(`status`), `revokedAt` = NULL;
--> statement-breakpoint
INSERT INTO `center_memberships` (`userId`, `centerId`, `role`, `status`, `isOwner`, `grantedBy`)
SELECT s.userId, s.centerId, 'student', 'active', false, s.userId
FROM `students` s
INNER JOIN `users` u ON u.id = s.userId
WHERE s.userId IS NOT NULL AND s.deletedAt IS NULL AND s.isActive = true
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `status` = VALUES(`status`), `revokedAt` = NULL;
--> statement-breakpoint
INSERT INTO `center_memberships` (`userId`, `centerId`, `role`, `status`, `isOwner`, `grantedBy`)
SELECT s.guardianUserId, s.centerId, 'guardian', 'active', false, s.guardianUserId
FROM `students` s
INNER JOIN `users` u ON u.id = s.guardianUserId
WHERE s.guardianUserId IS NOT NULL AND s.deletedAt IS NULL
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `status` = VALUES(`status`), `revokedAt` = NULL;
--> statement-breakpoint
INSERT INTO `parent_student_links` (`guardianUserId`, `studentId`, `centerId`, `linkedBy`)
SELECT s.guardianUserId, s.id, s.centerId, s.guardianUserId
FROM `students` s
WHERE s.guardianUserId IS NOT NULL AND s.deletedAt IS NULL
ON DUPLICATE KEY UPDATE `centerId` = VALUES(`centerId`);
