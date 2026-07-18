CREATE TABLE `academic_seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('academic_year','semester','summer','ramadan','custom') NOT NULL DEFAULT 'academic_year',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academic_seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`arrivalTime` timestamp,
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(64) NOT NULL,
	`entity` varchar(64) NOT NULL,
	`entityId` int,
	`oldData` text,
	`newData` text,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`centerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`phone` varchar(32),
	`address` text,
	`supervisorId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`phone` varchar(32),
	`email` varchar(320),
	`address` text,
	`city` varchar(100),
	`managerId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `centers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `circles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`seasonId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`teacherId` int,
	`assistantTeacherId` int,
	`maxStudents` int DEFAULT 20,
	`schedule` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `circles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`tajweedScore` tinyint,
	`pronunciationScore` tinyint,
	`memorizationScore` tinyint,
	`behaviorScore` tinyint,
	`totalScore` tinyint,
	`points` int DEFAULT 0,
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memorization` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`surahNumber` int NOT NULL,
	`fromAyah` int NOT NULL,
	`toAyah` int NOT NULL,
	`pages` decimal(4,2),
	`grade` enum('excellent','very_good','good','acceptable','weak','not_done') DEFAULT 'good',
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memorization_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','warning','success','error','attendance','session','memorization') NOT NULL DEFAULT 'info',
	`isRead` boolean NOT NULL DEFAULT false,
	`relatedId` int,
	`relatedType` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`logo` text,
	`phone` varchar(32),
	`email` varchar(320),
	`address` text,
	`city` varchar(100),
	`country` varchar(100) DEFAULT 'SA',
	`adminId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revision` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`surahNumber` int NOT NULL,
	`fromAyah` int NOT NULL,
	`toAyah` int NOT NULL,
	`pages` decimal(4,2),
	`grade` enum('excellent','very_good','good','acceptable','weak','not_done') DEFAULT 'good',
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revision_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`circleId` int NOT NULL,
	`teacherId` int NOT NULL,
	`seasonId` int NOT NULL,
	`title` varchar(255),
	`type` enum('regular','exam','review','special') NOT NULL DEFAULT 'regular',
	`status` enum('scheduled','open','closed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scheduledAt` timestamp NOT NULL,
	`startedAt` timestamp,
	`closedAt` timestamp,
	`notes` text,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`centerId` int NOT NULL,
	`circleId` int,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32),
	`guardianPhone` varchar(32),
	`guardianName` varchar(255),
	`nationalId` varchar(32),
	`birthDate` timestamp,
	`enrollmentDate` timestamp DEFAULT (now()),
	`lastMemorizedSurah` int DEFAULT 1,
	`lastMemorizedAyah` int DEFAULT 1,
	`totalMemorizedJuz` decimal(5,2) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`centerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32),
	`email` varchar(320),
	`nationalId` varchar(32),
	`specialization` varchar(255),
	`qualification` varchar(255),
	`hireDate` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','org_admin','center_manager','supervisor','teacher','assistant_teacher','student','guardian','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deletedAt` timestamp;