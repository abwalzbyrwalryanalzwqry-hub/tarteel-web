CREATE TABLE `quran_reading_states` (
	`userId` int NOT NULL,
	`bookmarks` mediumtext,
	`bookmarksAt` varchar(32),
	`khatmah` text,
	`khatmahAt` varchar(32),
	`history` mediumtext,
	`historyAt` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quran_reading_states_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `quran_review_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`surahNumber` int NOT NULL,
	`fromAyah` int NOT NULL,
	`toAyah` int NOT NULL,
	`easeHundredths` int NOT NULL DEFAULT 250,
	`intervalDays` int NOT NULL DEFAULT 0,
	`repetitions` int NOT NULL DEFAULT 0,
	`lapses` int NOT NULL DEFAULT 0,
	`lastScore` int,
	`lastReviewedAt` timestamp,
	`dueDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quran_review_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `quran_review_cards_user_range_unique` UNIQUE(`userId`,`surahNumber`,`fromAyah`,`toAyah`)
);
--> statement-breakpoint
CREATE INDEX `quran_review_cards_user_due_idx` ON `quran_review_cards` (`userId`,`dueDate`);