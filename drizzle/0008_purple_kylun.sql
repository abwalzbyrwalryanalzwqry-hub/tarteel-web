ALTER TABLE `sessions` MODIFY COLUMN `status` enum('draft','scheduled','open','closed','cancelled') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `sessions` MODIFY `status` enum('draft','scheduled','open','closed','cancelled') NOT NULL DEFAULT 'draft';
