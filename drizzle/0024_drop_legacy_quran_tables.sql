-- نقل العلامات والمفضلة والملاحظات من قسم المصحف السابق إلى حالة القراءة الجديدة قبل حذف جدوليهما.
-- كل عنصر يحمل legacy=true: يكمل الجهاز نص الآية والجزء عند أول مزامنة، وتصير علامة الصفحة علامةً على أول آياتها.
INSERT INTO `quran_reading_states` (`userId`, `bookmarks`, `bookmarksAt`)
SELECT `userId`, JSON_ARRAYAGG(`item`), DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%s.000Z')
FROM (
  SELECT `userId`, JSON_OBJECT(
    'id', IF(`referenceType` = 'ayah', CONCAT(`surahNumber`, ':', `ayahNumber`), CONCAT('page:', `pageNumber`)),
    'surah', IFNULL(`surahNumber`, 0), 'ayah', IFNULL(`ayahNumber`, 0), 'page', `pageNumber`, 'juz', 0,
    'text', '', 'note', `label`, 'tag', 'tadabbur', 'createdAt', UNIX_TIMESTAMP(`createdAt`) * 1000, 'legacy', TRUE
  ) AS `item`
  FROM `quran_bookmarks`
  UNION ALL
  SELECT `userId`, JSON_OBJECT(
    'id', CONCAT(`surahNumber`, ':', `ayahNumber`),
    'surah', `surahNumber`, 'ayah', `ayahNumber`, 'page', `pageNumber`, 'juz', 0,
    'text', '', 'note', `note`, 'tag', 'tadabbur', 'createdAt', UNIX_TIMESTAMP(`createdAt`) * 1000, 'legacy', TRUE
  ) AS `item`
  FROM `quran_verse_preferences`
  WHERE `isFavorite` = TRUE OR (`note` IS NOT NULL AND `note` <> '')
) AS `legacy_items`
GROUP BY `userId`;
--> statement-breakpoint
DROP TABLE `quran_bookmarks`;--> statement-breakpoint
DROP TABLE `quran_verse_preferences`;