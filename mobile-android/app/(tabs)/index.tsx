import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import Constants from "expo-constants";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getSavedServerUrl } from "../../src/config/server";
import { LOCAL_WEB_URL, isLocalWebUrl } from "../../src/config/localWeb";
import { readLocalDatabaseFile, saveLocalDatabaseFile } from "../../src/data/localDatabaseFile";
import { BRIDGE_SCRIPT, type BridgeMessage } from "../../src/web/bridge";
import { handleCommonBridgeMessage, setKeepAwakeFocus } from "../../src/web/nativeActions";
import { useNetworkStatus } from "../../src/network/useNetworkStatus";
import { colors } from "../../src/ui/theme";

const EXTERNAL_SCHEMES = /^(mailto:|tel:|sms:|whatsapp:|intent:|market:|geo:)/i;
const EXTERNAL_HOSTS = /(^|\.)(wa\.me|whatsapp\.com|play\.google\.com|maps\.google\.com)$/i;
const USER_AGENT_SUFFIX = `TarteelAndroid/${Constants.expoConfig?.version ?? "0"}`;

const KEEP_AWAKE_TAG = "tarteel-platform";

export default function PlatformScreen() {
  const webRef = useRef<WebView>(null);
  /** نسخة الجهاز افتراضياً؛ أو خادم مركز إن اختاره المستخدم من الإعدادات. */
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const isLocal = serverUrl !== null && isLocalWebUrl(serverUrl);
  /** صفحة داخل المنصة يطلبها تبويب آخر (مثل سياسة الخصوصية من الإعدادات). */
  const { path: requestedPath } = useLocalSearchParams<{ path?: string }>();
  const [startPath, setStartPath] = useState("");
  useEffect(() => {
    if (typeof requestedPath === "string" && requestedPath.startsWith("/")) {
      setStartPath(requestedPath);
      setWebKey((k) => k + 1);
    }
  }, [requestedPath]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [webKey, setWebKey] = useState(0);
  const network = useNetworkStatus();

  // نعيد قراءة العنوان عند العودة للتبويب (قد يكون تغيّر من الإعدادات).
  useFocusEffect(useCallback(() => {
    let active = true;
    void getSavedServerUrl().then((saved) => {
      if (!active) return;
      const url = saved || LOCAL_WEB_URL;
      setServerUrlState((current) => {
        if (current !== null && current !== url) { setFailed(false); setWebKey((k) => k + 1); }
        return url;
      });
    });
    return () => { active = false; };
  }, []));

  // إبقاء الشاشة مضاءة (إن طلبته الصفحة) يسري والتبويب ظاهر فقط.
  useFocusEffect(useCallback(() => {
    setKeepAwakeFocus(KEEP_AWAKE_TAG, true);
    return () => setKeepAwakeFocus(KEEP_AWAKE_TAG, false);
  }, []));

  // زر الرجوع في أندرويد يتنقل داخل المنصة أولاً.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]));

  // إعادة المحاولة تلقائياً عند عودة الاتصال.
  useEffect(() => {
    if (!isLocal && network.isConnected && failed) { setFailed(false); setWebKey((k) => k + 1); }
  }, [network.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: BridgeMessage;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "tarteel:db-save") {
      void saveLocalDatabaseFile(message.base64);
      return;
    }
    if (message.type === "tarteel:db-load") {
      const base64 = await readLocalDatabaseFile();
      const payload = JSON.stringify({ requestId: message.requestId, base64 });
      webRef.current?.injectJavaScript(`window.__tarteelNativeDb && window.__tarteelNativeDb(${payload}); true;`);
      return;
    }
    await handleCommonBridgeMessage(message, KEEP_AWAKE_TAG);
  }, []);

  const onShouldStartLoad = useCallback((request: WebViewNavigation) => {
    const url = request.url;
    if (EXTERNAL_SCHEMES.test(url)) { void Linking.openURL(url).catch(() => undefined); return false; }
    try {
      const parsed = new URL(url);
      if (EXTERNAL_HOSTS.test(parsed.hostname)) { void Linking.openURL(url).catch(() => undefined); return false; }
      // نسخة الجهاز: أي موقع خارجي يُفتح في المتصفح حتى لا يحل محل المنصة داخل التطبيق.
      if (isLocal && /^https?:$/.test(parsed.protocol) && !isLocalWebUrl(url)) { void Linking.openURL(url).catch(() => undefined); return false; }
    } catch { /* about:blank وما شابه */ }
    return true;
  }, [isLocal]);

  const retry = () => { setFailed(false); setLoading(true); setWebKey((k) => k + 1); };

  if (serverUrl === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      {failed ? (
        <View style={styles.center}>
          <Ionicons name={isLocal ? "alert-circle-outline" : network.isConnected ? "cloud-offline-outline" : "wifi-outline"} size={56} color={colors.primary} />
          <Text style={styles.title}>{isLocal ? "تعذر فتح ترتيل" : network.isConnected ? "تعذر الوصول إلى خادم ترتيل" : "لا يوجد اتصال بالإنترنت"}</Text>
          <Text style={styles.body}>
            {isLocal
              ? "حدث خطأ أثناء تشغيل المنصة على الجهاز. بياناتك محفوظة؛ أعد المحاولة."
              : network.isConnected
                ? `تحقق من عنوان الخادم في الإعدادات:\n${serverUrl}`
                : "المنصة تحتاج اتصالاً بخادم المركز. يمكنك قراءة المصحف دون اتصال، وستُحمَّل المنصة تلقائياً عند عودة الشبكة."}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.navigate("/quran")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>فتح المصحف دون اتصال</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: startPath ? `${serverUrl.replace(/\/+$/, "")}${startPath}` : serverUrl }}
          style={styles.web}
          originWhitelist={["https://*", "http://*", "about:*", "blob:*", "data:*"]}
          injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          // إعادة تحميل الصفحة تُسقط طلب إبقاء الشاشة مضاءة؛ تطلبه الصفحة من جديد إن احتاجته.
          onLoadStart={() => {
            setLoading(true);
            void handleCommonBridgeMessage({ type: "keep-awake", on: false }, KEEP_AWAKE_TAG);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          onHttpError={(event) => { if (event.nativeEvent.statusCode >= 500 && !event.nativeEvent.url.includes("/api/")) setFailed(true); }}
          onRenderProcessGone={() => retry()}
          applicationNameForUserAgent={USER_AGENT_SUFFIX}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          allowsBackForwardNavigationGestures
          allowFileAccess={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          textZoom={100}
          overScrollMode="never"
          pullToRefreshEnabled
          bounces={false}
          startInLoadingState
          renderLoading={() => <View style={styles.loadingOverlay}><ActivityIndicator color={colors.primary} size="large" /></View>}
        />
      )}
      {loading && !failed && <View style={styles.progress} />}
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
  secondaryButton: { minWidth: 220, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 13, paddingHorizontal: 22, alignItems: "center" },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.85 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  progress: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.gold },
});
