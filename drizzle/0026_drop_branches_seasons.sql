DROP TABLE `academic_seasons`;--> statement-breakpoint
DROP TABLE `branches`;--> statement-breakpoint
ALTER TABLE `circles` DROP COLUMN `branchId`;--> statement-breakpoint
ALTER TABLE `circles` DROP COLUMN `seasonId`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `seasonId`;