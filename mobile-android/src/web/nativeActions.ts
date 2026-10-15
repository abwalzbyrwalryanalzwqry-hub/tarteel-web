import { Linking, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { BridgeMessage } from "./bridge";
import { setAppDark } from "../ui/theme";

/** اسم ملف آمن في ذاكرة التطبيق المؤقتة، مع الإبقاء على العربية. */
export function safeFileName(name: string) {
  // eslint-disable-next-line no-control-regex -- محارف التحكم ممنوعة في أسماء الملفات
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return cleaned || `tarteel-${Date.now()}`;
}

/**
 * إبقاء الشاشة مضاءة لكل تبويب: الصفحة تطلبه وتلغيه (navigator.wakeLock)، ولا يسري إلا والتبويب
 * ظاهر؛ يُعلَّق عند مغادرته ويعود عند الرجوع إليه ما دامت الصفحة تطلبه.
 */
const keepAwake = new Map<string, { wanted: boolean; focused: boolean }>();

function applyKeepAwake(tag: string) {
  const state = keepAwake.get(tag);
  if (state?.wanted && state.focused) void activateKeepAwakeAsync(tag).catch(() => undefined);
  else deactivateKeepAwake(tag);
}

export function setKeepAwakeFocus(tag: string, focused: boolean) {
  keepAwake.set(tag, { wanted: keepAwake.get(tag)?.wanted ?? false, focused });
  applyKeepAwake(tag);
}

/**
 * طلبات الصفحة المشتركة بين تبويبي المنصة والمصحف: فتح رابط خارجي، وحفظ ملف أو مشاركته، ومشاركة نص،
 * وإبقاء الشاشة مضاءة. يعيد true إن عالج الرسالة. `keepAwakeTag` يميّز كل تبويب حتى لا يلغي أحدهما
 * طلب الآخر.
 */
export async function handleCommonBridgeMessage(
  message: BridgeMessage,
  keepAwakeTag: string,
): Promise<boolean> {
  switch (message.type) {
    case "open":
      void Linking.openURL(message.url).catch(() => undefined);
      return true;
    case "download":
      try {
        const uri = `${FileSystem.cacheDirectory}${safeFileName(message.filename)}`;
        await FileSystem.writeAsStringAsync(uri, message.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: message.mime,
            dialogTitle: "حفظ أو مشاركة الملف",
          });
        }
      } catch (error) {
        console.warn("[Tarteel] download failed", error);
      }
      return true;
    case "pdf":
      try {
        // A4 بنقاط الطباعة (72 لكل بوصة): 595×842، وتُقلب للعرضي.
        const [width, height] = message.landscape ? [842, 595] : [595, 842];
        const { uri } = await Print.printToFileAsync({ html: message.html, width, height });
        const name = safeFileName(/\.pdf$/i.test(message.filename) ? message.filename : `${message.filename}.pdf`);
        const target = `${FileSystem.cacheDirectory}${name}`;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: target });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(target, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
            dialogTitle: "حفظ أو مشاركة التقرير",
          });
        }
      } catch (error) {
        console.warn("[Tarteel] pdf failed", error);
      }
      return true;
    case "share":
      await Share.share(
        { message: message.text, title: message.title || "ترتيل" },
        { dialogTitle: message.title || "مشاركة" },
      ).catch(() => undefined);
      return true;
    case "theme":
      setAppDark(Boolean(message.dark));
      return true;
    case "keep-awake":
      keepAwake.set(keepAwakeTag, {
        wanted: message.on,
        focused: keepAwake.get(keepAwakeTag)?.focused ?? true,
      });
      applyKeepAwake(keepAwakeTag);
      return true;
    default:
      return false;
  }
}
