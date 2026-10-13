import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DEFAULT_SERVER_URL, getServerUrl, normalizeServerUrl, probeServer, setServerUrl } from "../../src/config/server";
import { colors } from "../../src/ui/theme";

export default function SettingsScreen() {
  const [current, setCurrent] = useState("");
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useFocusEffect(useCallback(() => {
    void getServerUrl().then((url) => { setCurrent(url); setDraft(url); });
  }, []));

  const save = async () => {
    const url = normalizeServerUrl(draft);
    if (!url) { setStatus({ ok: false, text: "أدخل عنواناً صحيحاً يبدأ بـ https://" }); return; }
    setChecking(true); setStatus(null);
    const ok = await probeServer(url);
    setChecking(false);
    const apply = async () => {
      await setServerUrl(url === DEFAULT_SERVER_URL ? null : url);
      setCurrent(url); setDraft(url);
      setStatus({ ok: true, text: "تم الحفظ. ستُفتح المنصة من العنوان الجديد." });
    };
    if (ok) { await apply(); return; }
    Alert.alert("لم يستجب الخادم", "تعذر التحقق من أن هذا العنوان خادم ترتيل. هل تريد حفظه على أي حال؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حفظ", onPress: () => { void apply(); } },
    ]);
  };

  const reset = async () => {
    await setServerUrl(null);
    setCurrent(DEFAULT_SERVER_URL); setDraft(DEFAULT_SERVER_URL);
    setStatus({ ok: true, text: "أُعيد العنوان الافتراضي." });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>الإعدادات</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}><Ionicons name="server-outline" size={20} color={colors.primary} /><Text style={styles.cardTitle}>عنوان خادم ترتيل</Text></View>
          <Text style={styles.help}>عند نقل المنصة إلى نطاق جديد غيّر العنوان هنا دون الحاجة لتحديث التطبيق.</Text>
          <TextInput
            value={draft}
            onChangeText={(value) => { setDraft(value); setStatus(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://tarteel.example.org"
            placeholderTextColor={colors.subtle}
            style={styles.input}
          />
          {status ? <Text style={[styles.status, { color: status.ok ? colors.primary : colors.danger }]}>{status.text}</Text> : null}
          <Pressable disabled={checking || draft.trim() === current} onPress={save} style={({ pressed }) => [styles.primaryButton, (checking || draft.trim() === current) && styles.disabled, pressed && styles.pressed]}>
            {checking ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>تحقق واحفظ</Text>}
          </Pressable>
          {DEFAULT_SERVER_URL && current !== DEFAULT_SERVER_URL ? (
            <Pressable onPress={reset} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>استعادة العنوان الافتراضي</Text></Pressable>
          ) : null}
          {current ? <Pressable onPress={() => void Linking.openURL(current)} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
            <Ionicons name="open-outline" size={18} color={colors.primary} /><Text style={styles.linkText}>فتح المنصة في المتصفح</Text>
          </Pressable> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /><Text style={styles.cardTitle}>عن التطبيق</Text></View>
          <Row label="الإصدار" value={`${Constants.expoConfig?.version ?? "—"}`} />
          <Row label="المصحف" value="نص Tanzil (رواية حفص) — يعمل دون اتصال" />
          <Pressable onPress={() => void Linking.openURL("https://tanzil.net/docs/text_license")} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} /><Text style={styles.linkText}>ترخيص نص Tanzil</Text>
          </Pressable>
        </View>

        {current ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={styles.cardTitle}>الخصوصية والحساب</Text></View>
            <Text style={styles.help}>تحذف حسابك من «الإعدادات ← حذف الحساب» داخل المنصة بعد الدخول.</Text>
            {[
              { path: "/privacy", label: "سياسة الخصوصية", icon: "lock-closed-outline" as const },
              { path: "/terms", label: "شروط الاستخدام", icon: "document-text-outline" as const },
              { path: "/delete-account", label: "حذف الحساب", icon: "trash-outline" as const },
            ].map((link) => (
              <Pressable key={link.path} onPress={() => void Linking.openURL(`${current}${link.path}`)} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
                <Ionicons name={link.icon} size={18} color={colors.primary} /><Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "700", color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.primary },
  help: { fontSize: 13, lineHeight: 21, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.primary, backgroundColor: colors.background, textAlign: "left", writingDirection: "ltr" },
  status: { fontSize: 13 },
  primaryButton: { borderRadius: 14, backgroundColor: colors.gold, paddingVertical: 13, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  secondaryButton: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: colors.primary, fontWeight: "600" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  linkText: { color: colors.primary, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.primary, fontWeight: "600", flexShrink: 1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
