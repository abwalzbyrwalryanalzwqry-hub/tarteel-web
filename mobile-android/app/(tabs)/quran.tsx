import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "../../src/ui/Pressable";
import { isLocalWebUrl } from "../../src/config/localWeb";
import { BRIDGE_SCRIPT, type BridgeMessage } from "../../src/web/bridge";
import { handleCommonBridgeMessage, setKeepAwakeFocus } from "../../src/web/nativeActions";
import { LEGACY_LAST_READ_KEY, mushafStartUrl, parseLegacyLastRead } from "../../src/web/mushaf";
import { colors } from "../../src/ui/theme";

const KEEP_AWAKE_TAG = "tarteel-mushaf";
const USER_AGENT_SUFFIX = `TarteelAndroid/${Constants.expoConfig?.version ?? "0"}`;
const EXTERNAL_SCHEMES = /^(mailto:|tel:|sms:|whatsapp:|intent:|market:|geo:)/i;

/**
 * تبويب المصحف: قسم المصحف في ترتيل (المنقول من زِن) من نسخة الجهاز المضمّنة في التطبيق، بوضع
 * «المصحف المستقل» — يعمل دون اتصال ودون حساب، ولا يفتح قاعدة بيانات المنصة (انظر
 * client/src/mushaf/lib/standalone.ts). المصحف المرتبط بالحساب (سجل الحفظ والمراجعة) في تبويب المنصة.
 */
export default function MushafScreen() {
  const webRef = useRef<WebView>(null);
  const [startUrl, setStartUrl] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webKey, setWebKey] = useState(0);

  // آخر موضع من قارئ المصحف السابق (الأصلي) يُفتح مرة واحدة ثم يُنسى؛ المصحف الجديد يحفظ موضعه بنفسه.
  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LEGACY_LAST_READ_KEY)
      .catch(() => null)
      .then((raw) => {
        if (!active) return;
        const legacy = parseLegacyLastRead(raw);
        setStartUrl(mushafStartUrl(legacy));
        if (raw !== null) void SecureStore.deleteItemAsync(LEGACY_LAST_READ_KEY).catch(() => undefined);
      });
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    setKeepAwakeFocus(KEEP_AWAKE_TAG, true);
    return () => setKeepAwakeFocus(KEEP_AWAKE_TAG, false);
  }, []));

  // زر الرجوع في أندرويد يتنقل داخل المصحف أولاً.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]));

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let message: BridgeMessage;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    // لا قاعدة بيانات في هذا التبويب: طلبات db-load/db-save (لا ترسلها الصفحة هنا) تُتجاهل.
    void handleCommonBridgeMessage(message, KEEP_AWAKE_TAG);
  }, []);

  // روابط المصادر والتراخيص وغيرها تُفتح في المتصفح، ويبقى التبويب على المصحف.
  const onShouldStartLoad = useCallback((request: WebViewNavigation) => {
    const url = request.url;
    if (EXTERNAL_SCHEMES.test(url)) { void Linking.openURL(url).catch(() => undefined); return false; }
    if (/^https?:/i.test(url) && !isLocalWebUrl(url)) { void Linking.openURL(url).catch(() => undefined); return false; }
    return true;
  }, []);

  const retry = () => { setFailed(false); setWebKey((k) => k + 1); };

  if (startUrl === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      {failed ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.primary} />
          <Text style={styles.title}>تعذر فتح المصحف</Text>
          <Text style={styles.body}>المصحف مضمّن في التطبيق ويعمل دون اتصال؛ أعد المحاولة.</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: startUrl }}
          style={styles.web}
          originWhitelist={["https://*", "about:*", "blob:*", "data:*"]}
          injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
          onMessage={onMessage}
          // إعادة تحميل الصفحة تُسقط طلب إبقاء الشاشة مضاءة؛ تطلبه الصفحة من جديد إن احتاجته.
          onLoadStart={() => void handleCommonBridgeMessage({ type: "keep-awake", on: false }, KEEP_AWAKE_TAG)}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          onError={() => setFailed(true)}
          onRenderProcessGone={() => retry()}
          applicationNameForUserAgent={USER_AGENT_SUFFIX}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          allowFileAccess={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          textZoom={100}
          overScrollMode="never"
          bounces={false}
          startInLoadingState
          renderLoading={() => <View style={styles.loadingOverlay}><ActivityIndicator color={colors.primary} size="large" /></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.primary, textAlign: "center" },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted, textAlign: "center" },
  primaryButton: { marginTop: 8, minWidth: 220, borderRadius: 16, backgroundColor: colors.gold, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
