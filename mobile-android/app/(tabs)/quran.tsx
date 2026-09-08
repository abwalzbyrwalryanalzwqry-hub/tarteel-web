import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "../../components/screen-container";
import { loadLocalQuran, searchLocalQuran, type LocalQuranVerse } from "../../src/quran/localQuran";

export default function LocalQuranScreen() {
  const [verses, setVerses] = useState<LocalQuranVerse[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadLocalQuran()
      .then((value) => { if (mounted) setVerses(value); })
      .catch(() => { if (mounted) setError("تعذر فتح أصل المصحف المحلي"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const visibleVerses = useMemo(() => {
    if (!query.trim()) return verses.slice(0, 80);
    return searchLocalQuran(verses, query, 80);
  }, [query, verses]);

  return (
    <ScreenContainer className="px-4 pt-4" containerClassName="bg-[#F6F3EA]">
      <View className="flex-1 gap-4">
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="العودة" onPress={() => router.back()}>
            <Text className="text-base font-bold text-[#123D2A]">رجوع</Text>
          </Pressable>
          <Text className="text-right text-2xl font-bold text-[#123D2A]">المصحف</Text>
        </View>
        <TextInput
          accessibilityLabel="البحث في المصحف"
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في الآيات"
          placeholderTextColor="#7B847C"
          textAlign="right"
          style={{ borderColor: "#D7DDCF", borderRadius: 14, borderWidth: 1, backgroundColor: "#FFFFFF", color: "#123D2A", padding: 14 }}
        />
        {loading && <ActivityIndicator color="#123D2A" />}
        {error && <Text className="text-right text-red-700">{error}</Text>}
        {!loading && !error && !query && <Text className="text-right text-sm text-[#5D665E]">يعرض التطبيق أول الآيات محلياً. استخدم البحث للوصول إلى مواضع أخرى.</Text>}
        <FlatList
          data={visibleVerses}
          keyExtractor={(item) => `${item.surah}:${item.ayah}`}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-[#D7DDCF] bg-white p-4">
              <Text className="text-right text-xl leading-9 text-[#233D2D]">{item.text}</Text>
              <Text className="mt-2 text-right text-xs text-[#7B847C]">سورة {item.surah} — آية {item.ayah}</Text>
            </View>
          )}
          ListEmptyComponent={!loading ? <Text className="text-center text-[#5D665E]">لا توجد نتائج</Text> : null}
        />
      </View>
    </ScreenContainer>
  );
}
