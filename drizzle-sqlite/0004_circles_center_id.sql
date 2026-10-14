-- إلغاء الفروع والمواسم: الحلقة ترتبط بالمركز مباشرة. يُنقل مركز كل حلقة من فرعها قبل حذف الفروع.
-- SQLite يشترط قيمة افتراضية لإضافة عمود NOT NULL.
ALTER TABLE `circles` ADD `centerId` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `circles` SET `centerId` = IFNULL((SELECT `centerId` FROM `branches` WHERE `branches`.`id` = `circles`.`branchId`), 0);
