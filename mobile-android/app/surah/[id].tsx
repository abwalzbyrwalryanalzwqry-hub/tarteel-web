import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { versesOfSurah, type LocalQuranVerse } from "../../src/quran/localQuran";
import { stripBasmala, surahName, toArabicDigits } from "../../src/quran/surahs";
import { useLocalQuran } from "../../src/quran/useLocalQuran";
import { colors } from "../../src/ui/theme";

import { LAST_READ_KEY } from "../../src/quran/lastRead";
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"; // مطابق حرفياً لنص Tanzil

export default function SurahScreen() {
  const params = useLocalSearchParams<{ id: string; ayah?: string }>();
  const surah = Math.min(114, Math.max(1, Number(params.id) || 1));
  const targetAyah = Number(params.ayah) || 0;
  const { verses, loading, error } = useLocalQuran();
  const list = useMemo(() => versesOfSurah(verses, surah), [verses, surah]);
  const listRef = useRef<FlatList<LocalQuranVerse>>(null);

  useEffect(() => {
    if (!targetAyah || list.length === 0) return;
    const index = Math.min(list.length - 1, targetAyah - 1);
    const timer = setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.1 }), 150);
    return () => clearTimeout(timer);
  }, [targetAyah, list.length]);

  const remember = (ayah: number) => { void SecureStore.setItemAsync(LAST_READ_KEY, JSON.stringify({ surah, ayah })); };
  useEffect(() => { remember(targetAyah || 1); }, [surah]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => router.replace({ pathname: "/surah/[id]", params: { id: String(next) } });

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-forward" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>سورة {surahName(surah)}</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error ? (
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(item) => String(item.ayah)}
          contentContainerStyle={styles.list}
          initialNumToRender={Math.max(20, targetAyah + 5)}
          onScrollToIndexFailed={(info) => setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 300)}
          onViewableItemsChanged={({ viewableItems }) => { const first = viewableItems[0]?.item as LocalQuranVerse | undefined; if (first) remember(first.ayah); }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 800 }}
          ListHeaderComponent={surah !== 1 && surah !== 9 ? <Text style={styles.basmala}>{BASMALA}</Text> : null}
          renderItem={({ item }) => (
            <View style={[styles.ayah, item.ayah === targetAyah && styles.highlight]}>
              <Text style={styles.verse}>
                {stripBasmala(surah, item.ayah, item.text)}
                <Text style={styles.marker}>{"  ﴿"}{toArabicDigits(item.ayah)}{"﴾"}</Text>
              </Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              {surah < 114 ? <Pressable style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} onPress={() => go(surah + 1)}><Text style={styles.navText}>السورة التالية: {surahName(surah + 1)}</Text></Pressable> : null}
              {surah > 1 ? <Pressable style={({ pressed }) => [styles.navButtonLight, pressed && styles.pressed]} onPress={() => go(surah - 1)}><Text style={styles.navTextDark}>السورة السابقة: {surahName(surah - 1)}</Text></Pressable> : null}
            </View>
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: "700", color: colors.primary },
  list: { padding: 16, paddingBottom: 40, gap: 4 },
  basmala: { textAlign: "center", fontSize: 22, lineHeight: 42, color: colors.primary, marginBottom: 12 },
  ayah: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  highlight: { backgroundColor: "#FFF4D6" },
  verse: { fontSize: 22, lineHeight: 44, color: "#1F3527", writingDirection: "rtl" },
  marker: { fontSize: 18, color: colors.gold },
  footer: { gap: 10, marginTop: 20 },
  navButton: { borderRadius: 14, backgroundColor: colors.primary, padding: 14, alignItems: "center" },
  navButtonLight: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, alignItems: "center" },
  navText: { color: "#FFFFFF", fontWeight: "700" },
  navTextDark: { color: colors.primary, fontWeight: "600" },
  error: { textAlign: "center", color: colors.danger, marginTop: 24 },
  pressed: { opacity: 0.85 },
});
