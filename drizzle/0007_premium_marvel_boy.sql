ALTER TABLE `sessions` ADD `dayKey` varchar(10);--> statement-breakpoint
UPDATE `sessions` SET `dayKey` = DATE_FORMAT(CONVERT_TZ(`scheduledAt`, '+00:00', '+03:00'), '%Y-%m-%d') WHERE `dayKey` IS NULL;--> statement-breakpoint
ALTER TABLE `sessions` MODIFY `dayKey` varchar(10) NOT NULL;--> statement-breakpoint
DELETE older FROM `attendance` older INNER JOIN `attendance` newer ON older.`sessionId` = newer.`sessionId` AND older.`studentId` = newer.`studentId` AND (older.`updatedAt` < newer.`updatedAt` OR (older.`updatedAt` = newer.`updatedAt` AND older.`id` < newer.`id`));--> statement-breakpoint
DELETE older FROM `evaluation` older INNER JOIN `evaluation` newer ON older.`sessionId` = newer.`sessionId` AND older.`studentId` = newer.`studentId` AND (older.`updatedAt` < newer.`updatedAt` OR (older.`updatedAt` = newer.`updatedAt` AND older.`id` < newer.`id`));--> statement-breakpoint
DELETE older FROM `memorization` older INNER JOIN `memorization` newer ON older.`sessionId` = newer.`sessionId` AND older.`studentId` = newer.`studentId` AND (older.`updatedAt` < newer.`updatedAt` OR (older.`updatedAt` = newer.`updatedAt` AND older.`id` < newer.`id`));--> statement-breakpoint
DELETE older FROM `revision` older INNER JOIN `revision` newer ON older.`sessionId` = newer.`sessionId` AND older.`studentId` = newer.`studentId` AND (older.`updatedAt` < newer.`updatedAt` OR (older.`updatedAt` = newer.`updatedAt` AND older.`id` < newer.`id`));--> statement-breakpoint
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_session_student_unique` UNIQUE(`sessionId`,`studentId`);--> statement-breakpoint
ALTER TABLE `evaluation` ADD CONSTRAINT `evaluation_session_student_unique` UNIQUE(`sessionId`,`studentId`);--> statement-breakpoint
ALTER TABLE `memorization` ADD CONSTRAINT `memorization_session_student_unique` UNIQUE(`sessionId`,`studentId`);--> statement-breakpoint
ALTER TABLE `revision` ADD CONSTRAINT `revision_session_student_unique` UNIQUE(`sessionId`,`studentId`);--> statement-breakpoint
CREATE INDEX `attendance_student_session_idx` ON `attendance` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `evaluation_student_session_idx` ON `evaluation` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `memorization_student_session_idx` ON `memorization` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `revision_student_session_idx` ON `revision` (`studentId`,`sessionId`);--> statement-breakpoint
CREATE INDEX `sessions_circle_day_idx` ON `sessions` (`circleId`,`dayKey`);--> statement-breakpoint
CREATE INDEX `sessions_day_key_idx` ON `sessions` (`dayKey`);
