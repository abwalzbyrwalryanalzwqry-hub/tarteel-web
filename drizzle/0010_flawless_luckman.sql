CREATE TABLE `reporting_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`headerTitle` varchar(255),
	`footerText` varchar(500),
	`logoUrl` text,
	`teacherMessageTemplate` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reporting_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `reporting_preferences_center_unique` UNIQUE(`centerId`)
);
