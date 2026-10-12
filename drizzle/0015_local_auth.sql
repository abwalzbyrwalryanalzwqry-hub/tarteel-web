CREATE TABLE `local_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`passwordChangedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_credentials_email_unique` UNIQUE(`email`),
	CONSTRAINT `local_credentials_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `password_setup_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`createdBy` int,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_setup_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_setup_tokens_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `password_setup_tokens_user_idx` ON `password_setup_tokens` (`userId`);