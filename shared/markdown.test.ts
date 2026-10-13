import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("محلل Markdown لردود المساعد", () => {
  it("عناوين وفقرات وقوائم بأرقام عربية هندية", () => {
    const blocks = parseMarkdown("## خطة المراجعة\n\nراجع **سورة البقرة** اليوم.\n\n١. الوجه الأول\n٢. الوجه الثاني");
    expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ type: "paragraph", children: [{ type: "text", text: "راجع " }, { type: "strong" }, { type: "text", text: " اليوم." }] });
    expect(blocks[2]).toMatchObject({ type: "list", ordered: true, start: 1 });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("قوائم متداخلة", () => {
    const [list] = parseMarkdown("- الحفظ\n  - صفحة جديدة\n  - تكرار\n- المراجعة");
    expect(list).toMatchObject({ type: "list", ordered: false });
    const items = (list as { items: { sublist?: { items: unknown[] } }[] }).items;
    expect(items).toHaveLength(2);
    expect(items[0].sublist?.items).toHaveLength(2);
  });

  it("الروابط: http(s) فقط، وغيرها نص عادي (لا javascript:)", () => {
    expect(parseInline("[الموقع](https://example.com)")).toEqual([{ type: "link", href: "https://example.com", children: [{ type: "text", text: "الموقع" }] }]);
    expect(parseInline("[اضغط](javascript:alert(1))")).toEqual([{ type: "text", text: "اضغط" }, { type: "text", text: ")" }]);
  });

  it("HTML يبقى نصاً ولا يُفسَّر", () => {
    expect(parseMarkdown("<img src=x onerror=alert(1)>")).toEqual([{ type: "paragraph", children: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }]);
  });

  it("جداول وكتل شيفرة، وكتلة غير مغلقة أثناء البث", () => {
    const [table] = parseMarkdown("| الطالب | الدرجة |\n|---|---|\n| أحمد | 95 |\n| علي | 88 |");
    expect(table).toMatchObject({ type: "table" });
    expect((table as { rows: unknown[] }).rows).toHaveLength(2);
    expect(parseMarkdown("```js\nconst a = 1;")).toEqual([{ type: "code", lang: "js", text: "const a = 1;" }]);
  });

  it("الشرطة السفلية داخل الكلمة ليست تشديداً، والمائل والشيفرة يعملان", () => {
    expect(parseInline("snake_case_name")).toEqual([{ type: "text", text: "snake_case_name" }]);
    expect(parseInline("*مهم* و `code`")).toEqual([{ type: "em", children: [{ type: "text", text: "مهم" }] }, { type: "text", text: " و " }, { type: "code", text: "code" }]);
  });
});
