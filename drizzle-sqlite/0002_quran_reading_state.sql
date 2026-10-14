CREATE TABLE `quran_reading_states` (
	`userId` integer PRIMARY KEY NOT NULL,
	`bookmarks` text,
	`bookmarksAt` text,
	`khatmah` text,
	`khatmahAt` text,
	`history` text,
	`historyAt` text,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quran_review_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`surahNumber` integer NOT NULL,
	`fromAyah` integer NOT NULL,
	`toAyah` integer NOT NULL,
	`easeHundredths` integer DEFAULT 250 NOT NULL,
	`intervalDays` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`lastScore` integer,
	`lastReviewedAt` integer,
	`dueDate` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quran_review_cards_user_range_unique` ON `quran_review_cards` (`userId`,`surahNumber`,`fromAyah`,`toAyah`);--> statement-breakpoint
CREATE INDEX `quran_review_cards_user_due_idx` ON `quran_review_cards` (`userId`,`dueDate`);