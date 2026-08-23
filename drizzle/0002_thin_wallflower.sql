CREATE TABLE `teacher_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`circleId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`role` enum('teacher','assistant_teacher') NOT NULL DEFAULT 'teacher',
	`expiresAt` timestamp,
	`usedAt` timestamp,
	`usedByUserId` int,
	`isRevoked` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacher_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_invites_code_unique` UNIQUE(`code`)
);
