import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "./MarkdownText";

describe("عرض ردود المساعد", () => {
  it("يبني عناصر HTML آمنة من Markdown", () => {
    const html = renderToStaticMarkup(<MarkdownText>{"## خطة\n\n**راجع** سورة الملك\n\n- وجه\n- وجهان\n\n[المصدر](https://quran.com)"}</MarkdownText>);
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>راجع</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain('href="https://quran.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("لا يحقن HTML ولا روابط javascript:", () => {
    const html = renderToStaticMarkup(<MarkdownText>{'<script>alert(1)</script> [x](javascript:alert(1))'}</MarkdownText>);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });
});
