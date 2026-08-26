CREATE TABLE `reporting_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`attendanceTarget` int,
	`memorizedPagesTarget` int,
	`reviewedPagesTarget` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reporting_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `reporting_goals_center_unique` UNIQUE(`centerId`)
);
