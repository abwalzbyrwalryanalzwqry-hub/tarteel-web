ALTER TABLE `sessions` MODIFY COLUMN `status` enum('draft','scheduled','open','closed','cancelled') NOT NULL DEFAULT 'draft';
ALTER TABLE `sessions` MODIFY `status` enum('draft','scheduled','open','closed','cancelled') NOT NULL DEFAULT 'draft';
