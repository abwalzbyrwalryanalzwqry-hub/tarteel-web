/**
 * نسخة الجهاز المحلية من منصة ترتيل: الواجهة ومنطق الخادم مضمّنان في التطبيق (assets/web)
 * ويُخدمان من هذا الأصل داخل WebView (انظر patches/react-native-webview@13.15.0.patch).
 * البيانات في SQLite داخل التطبيق، ولا يحتاج أي خادم أو اتصال.
 */
export const LOCAL_WEB_ORIGIN = "https://appassets.androidplatform.net";
export const LOCAL_WEB_URL = `${LOCAL_WEB_ORIGIN}/`;

export const isLocalWebUrl = (url: string) => url === LOCAL_WEB_ORIGIN || url.startsWith(`${LOCAL_WEB_ORIGIN}/`);
