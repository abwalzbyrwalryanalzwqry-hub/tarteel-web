CREATE TABLE `quran_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`referenceType` enum('page','ayah') NOT NULL,
	`referenceKey` varchar(32) NOT NULL,
	`pageNumber` int NOT NULL,
	`surahNumber` int,
	`ayahNumber` int,
	`label` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quran_bookmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `quran_bookmarks_user_reference_unique` UNIQUE(`userId`,`referenceKey`)
);
--> statement-breakpoint
CREATE INDEX `quran_bookmarks_user_created_idx` ON `quran_bookmarks` (`userId`,`createdAt`);