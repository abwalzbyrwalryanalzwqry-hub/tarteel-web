CREATE TABLE `ai_daily_usage` (
	`userId` int NOT NULL,
	`day` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `ai_daily_usage_user_day_unique` UNIQUE(`userId`,`day`)
);
--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`bucketKey` varchar(191) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`resetAt` timestamp NOT NULL,
	CONSTRAINT `rate_limit_buckets_bucketKey` PRIMARY KEY(`bucketKey`)
);
--> statement-breakpoint
CREATE INDEX `ai_daily_usage_day_idx` ON `ai_daily_usage` (`day`);--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_reset_idx` ON `rate_limit_buckets` (`resetAt`);