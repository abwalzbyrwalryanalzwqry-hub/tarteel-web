CREATE TABLE `oauth_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerUserId` varchar(191) NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `oauth_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_accounts_provider_user_unique` UNIQUE(`provider`,`providerUserId`)
);
--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `password_setup_tokens` ADD `purpose` enum('setup','reset','verify_email') DEFAULT 'setup' NOT NULL;--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_idx` ON `oauth_accounts` (`userId`);