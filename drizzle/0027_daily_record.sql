CREATE TABLE `daily_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`circleId` int NOT NULL,
	`recordDate` varchar(10) NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('present','late','absent','excused'),
	`reason` varchar(300),
	`note` text,
	`evalOverall` tinyint,
	`evalTajweed` tinyint,
	`evalPronunciation` tinyint,
	`evalBehavior` tinyint,
	`memFromSurah` int,
	`memFromAyah` int,
	`memToSurah` int,
	`memToAyah` int,
	`memGrade` tinyint,
	`memError` varchar(16),
	`memNotes` text,
	`revFromSurah` int,
	`revFromAyah` int,
	`revToSurah` int,
	`revToAyah` int,
	`revGrade` tinyint,
	`revError` varchar(16),
	`revNotes` text,
	`version` int NOT NULL DEFAULT 1,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_entries_record_student_unique` UNIQUE(`recordId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `daily_record_trash` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`recordDate` varchar(10) NOT NULL,
	`snapshot` mediumtext NOT NULL,
	`attendanceCount` int NOT NULL DEFAULT 0,
	`workCount` int NOT NULL DEFAULT 0,
	`deletedBy` int,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	`restoredAt` timestamp,
	CONSTRAINT `daily_record_trash_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`recordDate` varchar(10) NOT NULL,
	`status` enum('open','completed','locked') NOT NULL DEFAULT 'open',
	`notes` text,
	`version` int NOT NULL DEFAULT 1,
	`openedBy` int,
	`completedBy` int,
	`completedAt` timestamp,
	`lockedBy` int,
	`lockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_records_circle_date_unique` UNIQUE(`circleId`,`recordDate`)
);
--> statement-breakpoint
ALTER TABLE `centers` ADD `reportIdentity` mediumtext;--> statement-breakpoint
ALTER TABLE `students` ADD `memorizeDir` varchar(8) DEFAULT 'forward' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `reviewDir` varchar(8) DEFAULT 'forward' NOT NULL;--> statement-breakpoint
CREATE INDEX `daily_entries_student_date_idx` ON `daily_entries` (`studentId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `daily_entries_circle_date_idx` ON `daily_entries` (`circleId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `daily_record_trash_circle_idx` ON `daily_record_trash` (`circleId`,`deletedAt`);--> statement-breakpoint
CREATE INDEX `daily_records_date_idx` ON `daily_records` (`recordDate`);--> statement-breakpoint
-- نقل الفترات والجلسات السابقة إلى السجل اليومي قبل حذف جداولها في الترحيل التالي: سجل لكل حلقة في كل يوم،
-- وسطر لكل طالب بحضوره وحفظه ومراجعته وتقييمه (الدرجات 0..100 تصير 1..5 كما في زِن).
INSERT INTO `daily_records` (`circleId`, `recordDate`, `status`, `notes`, `version`, `completedAt`, `createdAt`, `updatedAt`) SELECT s.`circleId`, s.`dayKey`, CASE WHEN s.`status` = 'closed' THEN 'completed' ELSE 'open' END, s.`notes`, 1, s.`closedAt`, s.`createdAt`, s.`updatedAt` FROM `sessions` s JOIN (SELECT MIN(`id`) AS `sid` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) k ON k.`sid` = s.`id`;--> statement-breakpoint
INSERT IGNORE INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `reason`, `recordedBy`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, x.`status`, substr(x.`notes`, 1, 300), x.`recordedBy` FROM `attendance` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey`;--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `memFromSurah`, `memFromAyah`, `memToSurah`, `memToAyah`, `memGrade`, `memError`, `memNotes`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, 'present', x.`surahNumber`, x.`fromAyah`, COALESCE(x.`toSurahNumber`, x.`surahNumber`), x.`toAyah`, CASE x.`grade` WHEN 'excellent' THEN 5 WHEN 'very_good' THEN 4 WHEN 'good' THEN 3 WHEN 'acceptable' THEN 2 ELSE 1 END, 'none', x.`notes` FROM `memorization` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` ON DUPLICATE KEY UPDATE `memFromSurah` = VALUES(`memFromSurah`), `memFromAyah` = VALUES(`memFromAyah`), `memToSurah` = VALUES(`memToSurah`), `memToAyah` = VALUES(`memToAyah`), `memGrade` = VALUES(`memGrade`), `memError` = VALUES(`memError`), `memNotes` = VALUES(`memNotes`);--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `revFromSurah`, `revFromAyah`, `revToSurah`, `revToAyah`, `revGrade`, `revError`, `revNotes`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, 'present', x.`surahNumber`, x.`fromAyah`, COALESCE(x.`toSurahNumber`, x.`surahNumber`), x.`toAyah`, CASE x.`grade` WHEN 'excellent' THEN 5 WHEN 'very_good' THEN 4 WHEN 'good' THEN 3 WHEN 'acceptable' THEN 2 ELSE 1 END, 'none', x.`notes` FROM `revision` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` ON DUPLICATE KEY UPDATE `revFromSurah` = VALUES(`revFromSurah`), `revFromAyah` = VALUES(`revFromAyah`), `revToSurah` = VALUES(`revToSurah`), `revToAyah` = VALUES(`revToAyah`), `revGrade` = VALUES(`revGrade`), `revError` = VALUES(`revError`), `revNotes` = VALUES(`revNotes`);--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `note`, `evalOverall`, `evalTajweed`, `evalPronunciation`, `evalBehavior`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, x.`notes`, CASE WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) IS NULL OR COALESCE(x.`totalScore`, x.`memorizationScore`) <= 0 THEN NULL WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 95 THEN 5 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 85 THEN 4 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 70 THEN 3 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`tajweedScore` IS NULL OR x.`tajweedScore` <= 0 THEN NULL WHEN x.`tajweedScore` >= 95 THEN 5 WHEN x.`tajweedScore` >= 85 THEN 4 WHEN x.`tajweedScore` >= 70 THEN 3 WHEN x.`tajweedScore` >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`pronunciationScore` IS NULL OR x.`pronunciationScore` <= 0 THEN NULL WHEN x.`pronunciationScore` >= 95 THEN 5 WHEN x.`pronunciationScore` >= 85 THEN 4 WHEN x.`pronunciationScore` >= 70 THEN 3 WHEN x.`pronunciationScore` >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`behaviorScore` IS NULL OR x.`behaviorScore` <= 0 THEN NULL WHEN x.`behaviorScore` >= 95 THEN 5 WHEN x.`behaviorScore` >= 85 THEN 4 WHEN x.`behaviorScore` >= 70 THEN 3 WHEN x.`behaviorScore` >= 55 THEN 2 ELSE 1 END FROM `evaluation` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` ON DUPLICATE KEY UPDATE `evalOverall` = VALUES(`evalOverall`), `evalTajweed` = VALUES(`evalTajweed`), `evalPronunciation` = VALUES(`evalPronunciation`), `evalBehavior` = VALUES(`evalBehavior`), `note` = VALUES(`note`);
