CREATE TABLE `daily_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recordId` integer NOT NULL,
	`circleId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`studentId` integer NOT NULL,
	`status` text,
	`reason` text,
	`note` text,
	`evalOverall` integer,
	`evalTajweed` integer,
	`evalPronunciation` integer,
	`evalBehavior` integer,
	`memFromSurah` integer,
	`memFromAyah` integer,
	`memToSurah` integer,
	`memToAyah` integer,
	`memGrade` integer,
	`memError` text,
	`memNotes` text,
	`revFromSurah` integer,
	`revFromAyah` integer,
	`revToSurah` integer,
	`revToAyah` integer,
	`revGrade` integer,
	`revError` text,
	`revNotes` text,
	`version` integer DEFAULT 1 NOT NULL,
	`recordedBy` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_entries_record_student_unique` ON `daily_entries` (`recordId`,`studentId`);--> statement-breakpoint
CREATE INDEX `daily_entries_student_date_idx` ON `daily_entries` (`studentId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `daily_entries_circle_date_idx` ON `daily_entries` (`circleId`,`recordDate`);--> statement-breakpoint
CREATE TABLE `daily_record_trash` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`snapshot` text NOT NULL,
	`attendanceCount` integer DEFAULT 0 NOT NULL,
	`workCount` integer DEFAULT 0 NOT NULL,
	`deletedBy` integer,
	`deletedAt` integer NOT NULL,
	`restoredAt` integer
);
--> statement-breakpoint
CREATE INDEX `daily_record_trash_circle_idx` ON `daily_record_trash` (`circleId`,`deletedAt`);--> statement-breakpoint
CREATE TABLE `daily_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`circleId` integer NOT NULL,
	`recordDate` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text,
	`version` integer DEFAULT 1 NOT NULL,
	`openedBy` integer,
	`completedBy` integer,
	`completedAt` integer,
	`lockedBy` integer,
	`lockedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_records_circle_date_unique` ON `daily_records` (`circleId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `daily_records_date_idx` ON `daily_records` (`recordDate`);--> statement-breakpoint
ALTER TABLE `centers` ADD `reportIdentity` text;--> statement-breakpoint
ALTER TABLE `students` ADD `memorizeDir` text DEFAULT 'forward' NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `reviewDir` text DEFAULT 'forward' NOT NULL;--> statement-breakpoint
-- نقل الفترات والجلسات السابقة إلى السجل اليومي قبل حذف جداولها في الترحيل التالي: سجل لكل حلقة في كل يوم،
-- وسطر لكل طالب بحضوره وحفظه ومراجعته وتقييمه (الدرجات 0..100 تصير 1..5 كما في زِن).
INSERT INTO `daily_records` (`circleId`, `recordDate`, `status`, `notes`, `version`, `completedAt`, `createdAt`, `updatedAt`) SELECT s.`circleId`, s.`dayKey`, CASE WHEN s.`status` = 'closed' THEN 'completed' ELSE 'open' END, s.`notes`, 1, s.`closedAt`, s.`createdAt`, s.`updatedAt` FROM `sessions` s JOIN (SELECT MIN(`id`) AS `sid` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) k ON k.`sid` = s.`id`;--> statement-breakpoint
INSERT OR IGNORE INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `reason`, `recordedBy`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, x.`status`, substr(x.`notes`, 1, 300), x.`recordedBy` FROM `attendance` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey`;--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `memFromSurah`, `memFromAyah`, `memToSurah`, `memToAyah`, `memGrade`, `memError`, `memNotes`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, 'present', x.`surahNumber`, x.`fromAyah`, COALESCE(x.`toSurahNumber`, x.`surahNumber`), x.`toAyah`, CASE x.`grade` WHEN 'excellent' THEN 5 WHEN 'very_good' THEN 4 WHEN 'good' THEN 3 WHEN 'acceptable' THEN 2 ELSE 1 END, 'none', x.`notes` FROM `memorization` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` WHERE true ON CONFLICT(`recordId`, `studentId`) DO UPDATE SET `memFromSurah` = excluded.`memFromSurah`, `memFromAyah` = excluded.`memFromAyah`, `memToSurah` = excluded.`memToSurah`, `memToAyah` = excluded.`memToAyah`, `memGrade` = excluded.`memGrade`, `memError` = excluded.`memError`, `memNotes` = excluded.`memNotes`;--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `status`, `revFromSurah`, `revFromAyah`, `revToSurah`, `revToAyah`, `revGrade`, `revError`, `revNotes`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, 'present', x.`surahNumber`, x.`fromAyah`, COALESCE(x.`toSurahNumber`, x.`surahNumber`), x.`toAyah`, CASE x.`grade` WHEN 'excellent' THEN 5 WHEN 'very_good' THEN 4 WHEN 'good' THEN 3 WHEN 'acceptable' THEN 2 ELSE 1 END, 'none', x.`notes` FROM `revision` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` WHERE true ON CONFLICT(`recordId`, `studentId`) DO UPDATE SET `revFromSurah` = excluded.`revFromSurah`, `revFromAyah` = excluded.`revFromAyah`, `revToSurah` = excluded.`revToSurah`, `revToAyah` = excluded.`revToAyah`, `revGrade` = excluded.`revGrade`, `revError` = excluded.`revError`, `revNotes` = excluded.`revNotes`;--> statement-breakpoint
INSERT INTO `daily_entries` (`recordId`, `circleId`, `recordDate`, `studentId`, `createdAt`, `updatedAt`, `note`, `evalOverall`, `evalTajweed`, `evalPronunciation`, `evalBehavior`) SELECT r.`id`, r.`circleId`, r.`recordDate`, x.`studentId`, x.`createdAt`, x.`updatedAt`, x.`notes`, CASE WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) IS NULL OR COALESCE(x.`totalScore`, x.`memorizationScore`) <= 0 THEN NULL WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 95 THEN 5 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 85 THEN 4 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 70 THEN 3 WHEN COALESCE(x.`totalScore`, x.`memorizationScore`) >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`tajweedScore` IS NULL OR x.`tajweedScore` <= 0 THEN NULL WHEN x.`tajweedScore` >= 95 THEN 5 WHEN x.`tajweedScore` >= 85 THEN 4 WHEN x.`tajweedScore` >= 70 THEN 3 WHEN x.`tajweedScore` >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`pronunciationScore` IS NULL OR x.`pronunciationScore` <= 0 THEN NULL WHEN x.`pronunciationScore` >= 95 THEN 5 WHEN x.`pronunciationScore` >= 85 THEN 4 WHEN x.`pronunciationScore` >= 70 THEN 3 WHEN x.`pronunciationScore` >= 55 THEN 2 ELSE 1 END, CASE WHEN x.`behaviorScore` IS NULL OR x.`behaviorScore` <= 0 THEN NULL WHEN x.`behaviorScore` >= 95 THEN 5 WHEN x.`behaviorScore` >= 85 THEN 4 WHEN x.`behaviorScore` >= 70 THEN 3 WHEN x.`behaviorScore` >= 55 THEN 2 ELSE 1 END FROM `evaluation` x JOIN (SELECT MIN(`id`) AS `sid`, `circleId`, `dayKey` FROM `sessions` WHERE `deletedAt` IS NULL AND `status` <> 'cancelled' GROUP BY `circleId`, `dayKey`) m ON x.`sessionId` = m.`sid` JOIN `daily_records` r ON r.`circleId` = m.`circleId` AND r.`recordDate` = m.`dayKey` WHERE true ON CONFLICT(`recordId`, `studentId`) DO UPDATE SET `evalOverall` = excluded.`evalOverall`, `evalTajweed` = excluded.`evalTajweed`, `evalPronunciation` = excluded.`evalPronunciation`, `evalBehavior` = excluded.`evalBehavior`, `note` = excluded.`note`;
