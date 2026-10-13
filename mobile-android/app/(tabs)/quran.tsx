import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { searchLocalQuran } from "../../src/quran/localQuran";
import { SURAH_NAMES, surahName, toArabicDigits } from "../../src/quran/surahs";
import { useLocalQuran } from "../../src/quran/useLocalQuran";
import { colors } from "../../src/ui/theme";
import { LAST_READ_KEY } from "../../src/quran/lastRead";


export default function QuranScreen() {
  const { verses, loading, error } = useLocalQuran();
  const [query, setQuery] = useState("");
  const [lastRead, setLastRead] = useState<{ surah: number; ayah: number } | null>(null);

  useFocusEffect(useCallback(() => {
    void SecureStore.getItemAsync(LAST_READ_KEY).then((raw) => { try { setLastRead(raw ? JSON.parse(raw) : null); } catch { setLastRead(null); } });
  }, []));

  const counts = useMemo(() => {
    const map = new Array<number>(115).fill(0);
    for (const verse of verses) map[verse.surah] += 1;
    return map;
  }, [verses]);

  const results = useMemo(() => (query.trim().length >= 2 ? searchLocalQuran(verses, query, 100) : []), [query, verses]);
  const searching = query.trim().length >= 2;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>المصحف</Text>
        <Text style={styles.subtitle}>رواية حفص · نص Tanzil · يعمل دون اتصال</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.subtle} />
          <TextInput
            accessibilityLabel="البحث في المصحف"
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث في الآيات (حرفان على الأقل)"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? <Pressable accessibilityLabel="مسح البحث" onPress={() => setQuery("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={colors.subtle} /></Pressable> : null}
        </View>
        {lastRead && !searching ? (
          <Pressable style={({ pressed }) => [styles.resume, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/surah/[id]", params: { id: String(lastRead.surah), ayah: String(lastRead.ayah) } })}>
            <Ionicons name="bookmark" size={18} color={colors.gold} />
            <Text style={styles.resumeText}>متابعة القراءة: سورة {surahName(lastRead.surah)} · آية {toArabicDigits(lastRead.ayah)}</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error && (searching ? (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.surah}:${item.ayah}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={styles.count}>{toArabicDigits(results.length)} نتيجة{results.length === 100 ? " (أول ١٠٠)" : ""}</Text>}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/surah/[id]", params: { id: String(item.surah), ayah: String(item.ayah) } })}>
              <Text style={styles.verse}>{item.text}</Text>
              <Text style={styles.meta}>سورة {surahName(item.surah)} · آية {toArabicDigits(item.ayah)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>لا توجد نتائج</Text>}
        />
      ) : (
        <FlatList
          data={SURAH_NAMES.map((name, index) => ({ name, number: index + 1 }))}
          keyExtractor={(item) => String(item.number)}
          contentContainerStyle={styles.list}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.surahRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: "/surah/[id]", params: { id: String(item.number) } })}>
              <View style={styles.badge}><Text style={styles.badgeText}>{toArabicDigits(item.number)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.surahName}>سورة {item.name}</Text>
                <Text style={styles.meta}>{toArabicDigits(counts[item.number])} آية</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.subtle} />
            </Pressable>
          )}
        />
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  title: { fontSize: 26, fontWeight: "700", color: colors.primary },
  subtitle: { fontSize: 13, color: colors.muted },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.primary, writingDirection: "rtl" },
  resume: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, padding: 12 },
  resumeText: { flex: 1, color: colors.primary, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  surahRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14 },
  badge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.primary, fontWeight: "700" },
  surahName: { fontSize: 17, fontWeight: "700", color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  verse: { fontSize: 20, lineHeight: 38, color: "#233D2D", writingDirection: "rtl" },
  meta: { fontSize: 12, color: colors.subtle },
  count: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 24 },
  error: { textAlign: "center", color: colors.danger, marginTop: 24 },
  pressed: { opacity: 0.8 },
});
