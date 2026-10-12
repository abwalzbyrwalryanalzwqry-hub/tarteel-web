-- توحيد روابط الملفات العامة على المسار /storage/ (كانت تحفظ بمسار الاستضافة السابقة).
UPDATE `centers` SET `logoUrl` = REPLACE(`logoUrl`, '/manus-storage/', '/storage/') WHERE `logoUrl` LIKE '%/manus-storage/%';
--> statement-breakpoint
UPDATE `reporting_preferences` SET `logoUrl` = REPLACE(`logoUrl`, '/manus-storage/', '/storage/') WHERE `logoUrl` LIKE '%/manus-storage/%';
