-- إلغاء الفروع والمواسم: الحلقة ترتبط بالمركز مباشرة. يُنقل مركز كل حلقة من فرعها قبل حذف الفروع.
ALTER TABLE `circles` ADD `centerId` int NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `circles` INNER JOIN `branches` ON `circles`.`branchId` = `branches`.`id` SET `circles`.`centerId` = `branches`.`centerId`;--> statement-breakpoint
ALTER TABLE `circles` ALTER COLUMN `centerId` DROP DEFAULT;
