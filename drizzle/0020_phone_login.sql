ALTER TABLE `local_credentials` MODIFY COLUMN `email` varchar(320);--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `local_credentials` ADD CONSTRAINT `local_credentials_phone_unique` UNIQUE(`phone`);