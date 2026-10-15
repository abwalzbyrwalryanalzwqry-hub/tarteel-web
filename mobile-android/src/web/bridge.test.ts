import { describe, expect, it } from "vitest";
import { BRIDGE_SCRIPT } from "./bridge";

/** يشغّل سكربت الجسر في صفحة مصطنعة ويعيد الرسائل التي أرسلها إلى التطبيق. */
function runBridge(navigatorInit: Record<string, unknown> = {}, rootClasses: string[] = []) {
  const messages: Array<Record<string, unknown>> = [];
  const window: Record<string, unknown> = {
    ReactNativeWebView: { postMessage: (data: string) => messages.push(JSON.parse(data)) },
  };
  const navigator: Record<string, unknown> = { ...navigatorInit };
  const classes = new Set(rootClasses);
  const listeners: Record<string, Array<() => void>> = {};
  const document = {
    documentElement: { classList: { contains: (name: string) => classes.has(name) } },
    addEventListener: (type: string, listener: () => void) => {
      (listeners[type] ??= []).push(listener);
    },
  };
  function HTMLAnchorElement() {}
  HTMLAnchorElement.prototype.click = () => undefined;
  class FileReader {
    result = "";
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(file: { content: string }) {
      this.result = `data:image/png;base64,${file.content}`;
      this.onloadend?.();
    }
  }
  const URLStub = Object.assign(function () {}, { revokeObjectURL: () => undefined });
  new Function("window", "document", "navigator", "HTMLAnchorElement", "URL", "FileReader", BRIDGE_SCRIPT)(
    window,
    document,
    navigator,
    HTMLAnchorElement,
    URLStub,
    FileReader,
  );
  const fire = (type: string) => listeners[type]?.forEach((listener) => listener());
  return { messages, navigator: navigator as Record<string, any>, classes, fire };
}

describe("جسر WebView", () => {
  it("يرسل سمة الصفحة (داكن/فاتح) إلى التطبيق عند تحميلها، دون تكرار القيمة نفسها", () => {
    const { messages, fire } = runBridge({}, ["dark"]);
    fire("DOMContentLoaded");
    fire("DOMContentLoaded");
    expect(messages).toEqual([{ type: "theme", dark: true }]);
  });

  it("يشارك النص عبر مربع المشاركة الأصلي", async () => {
    const { messages, navigator } = runBridge();
    expect(navigator.canShare({ text: "آية" })).toBe(true);
    await navigator.share({ title: "ترتيل", text: "آية", url: "https://example.org" });
    expect(messages).toEqual([{ type: "share", title: "ترتيل", text: "آية\nhttps://example.org" }]);
  });

  it("يشارك الملف (بطاقة الآية) عبر مسار التنزيل", async () => {
    const { messages, navigator } = runBridge();
    await navigator.share({ files: [{ name: "ayah.png", type: "image/png", content: "QUJD" }] });
    expect(messages).toEqual([{ type: "download", filename: "ayah.png", mime: "image/png", data: "QUJD" }]);
  });

  it("يطلب إبقاء الشاشة مضاءة ويلغيه بعد آخر تحرير", async () => {
    const { messages, navigator } = runBridge();
    const first = await navigator.wakeLock.request("screen");
    const second = await navigator.wakeLock.request("screen");
    await first.release();
    await first.release();
    expect(messages.at(-1)).toEqual({ type: "keep-awake", on: true });
    await second.release();
    expect(messages.at(-1)).toEqual({ type: "keep-awake", on: false });
    expect(second.released).toBe(true);
  });

  it("لا يستبدل واجهة المشاركة إن كانت موجودة", () => {
    const share = () => Promise.resolve();
    const { navigator } = runBridge({ share });
    expect(navigator.share).toBe(share);
  });
});
