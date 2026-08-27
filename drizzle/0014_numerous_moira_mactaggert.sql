CREATE TABLE `quran_verse_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`verseKey` varchar(32) NOT NULL,
	`pageNumber` int NOT NULL,
	`surahNumber` int NOT NULL,
	`ayahNumber` int NOT NULL,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quran_verse_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `quran_verse_preferences_user_verse_unique` UNIQUE(`userId`,`verseKey`)
);
--> statement-breakpoint
CREATE INDEX `quran_verse_preferences_user_favorite_idx` ON `quran_verse_preferences` (`userId`,`isFavorite`,`updatedAt`);