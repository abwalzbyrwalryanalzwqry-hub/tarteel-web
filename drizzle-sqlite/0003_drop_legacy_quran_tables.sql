-- نقل العلامات والمفضلة والملاحظات من قسم المصحف السابق إلى حالة القراءة الجديدة قبل حذف جدوليهما.
-- كل عنصر يحمل legacy=true: يكمل الجهاز نص الآية والجزء عند أول مزامنة، وتصير علامة الصفحة علامةً على أول آياتها.
INSERT INTO `quran_reading_states` (`userId`, `bookmarks`, `bookmarksAt`, `updatedAt`)
SELECT `userId`, json_group_array(json(`item`)), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM (
  SELECT `userId`, json_object(
    'id', CASE WHEN `referenceType` = 'ayah' THEN `surahNumber` || ':' || `ayahNumber` ELSE 'page:' || `pageNumber` END,
    'surah', IFNULL(`surahNumber`, 0), 'ayah', IFNULL(`ayahNumber`, 0), 'page', `pageNumber`, 'juz', 0,
    'text', '', 'note', `label`, 'tag', 'tadabbur', 'createdAt', `createdAt`, 'legacy', json('true')
  ) AS `item`
  FROM `quran_bookmarks`
  UNION ALL
  SELECT `userId`, json_object(
    'id', `surahNumber` || ':' || `ayahNumber`,
    'surah', `surahNumber`, 'ayah', `ayahNumber`, 'page', `pageNumber`, 'juz', 0,
    'text', '', 'note', `note`, 'tag', 'tadabbur', 'createdAt', `createdAt`, 'legacy', json('true')
  ) AS `item`
  FROM `quran_verse_preferences`
  WHERE `isFavorite` = 1 OR (`note` IS NOT NULL AND `note` <> '')
)
GROUP BY `userId`;
--> statement-breakpoint
DROP TABLE `quran_bookmarks`;--> statement-breakpoint
DROP TABLE `quran_verse_preferences`;