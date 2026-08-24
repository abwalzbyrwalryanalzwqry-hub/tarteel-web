CREATE TABLE `circle_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sessionType` varchar(64) NOT NULL DEFAULT 'جلسة يومية',
	`daysOfWeek` varchar(128) NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `circle_periods_id` PRIMARY KEY(`id`)
);
