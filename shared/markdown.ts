/**
 * محلل Markdown صغير لردود المساعد الذكي. يحل محل streamdown الذي كان يجرّ mermaid
 * ومئات ملفات تلوين الشيفرة (نحو 400 ملف في البناء) لعرض نص عربي بسيط.
 *
 * يدعم ما تكتبه نماذج اللغة عادة: عناوين، فقرات، قوائم مرقمة ونقطية (متداخلة بمسافتين)،
 * اقتباس، فاصل، جداول بسيطة، كتل شيفرة، وداخل السطر: عريض، مائل، شيفرة، روابط http(s).
 * لا يُنتج HTML خاماً؛ العرض يبني عناصر React من الشجرة، فلا مجال لحقن سكربت.
 * يتحمل النص غير المكتمل أثناء البث (كتلة شيفرة لم تُغلق بعد مثلاً).
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "br" };

export type ListItem = { children: Inline[]; sublist?: Block };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "quote"; children: Block[] }
  | { type: "code"; lang: string; text: string }
  | { type: "hr" }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

// الأرقام العربية الهندية (١٢٣) شائعة في الردود العربية.
const ORDERED = /^(\s*)([0-9\u0660-\u0669]+)[.)\u066B]\s+(.*)$/;
const UNORDERED = /^(\s*)[-*+\u2022]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)\s*([\w-]*)\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const toNumber = (digits: string) => Number(digits.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)));

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => { if (buffer) { out.push({ type: "text", text: buffer }); buffer = ""; } };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const ch = source[i];
    if (ch === "\\" && i + 1 < source.length && /[\\`*_[\]()#|>-]/.test(source[i + 1])) { buffer += source[i + 1]; i += 2; continue; }
    if (ch === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i) { flush(); out.push({ type: "code", text: source.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const end = source.indexOf(marker, i + 2);
      if (end > i + 2) { flush(); out.push({ type: "strong", children: parseInline(source.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if ((ch === "*" || ch === "_") && source[i + 1] && source[i + 1] !== " ") {
      const end = source.indexOf(ch, i + 1);
      // "_" داخل كلمة (snake_case) ليس تشديداً.
      const wordBefore = ch === "_" && i > 0 && /\w/.test(source[i - 1]);
      if (end > i + 1 && source[end - 1] !== " " && !wordBefore) { flush(); out.push({ type: "em", children: parseInline(source.slice(i + 1, end)) }); i = end + 1; continue; }
    }
    if (ch === "[") {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
      if (match) {
        flush();
        const href = match[2];
        if (/^https?:\/\//i.test(href)) out.push({ type: "link", href, children: parseInline(match[1]) });
        else out.push(...parseInline(match[1])); // روابط javascript: وغيرها تُعرض نصاً فقط.
        i += match[0].length;
        continue;
      }
    }
    if (ch === "\n") { flush(); out.push({ type: "br" }); i += 1; continue; }
    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => parseInline(cell.trim()));

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const first = ORDERED.exec(lines[start]) ?? UNORDERED.exec(lines[start])!;
  const ordered = ORDERED.test(lines[start]);
  const indent = first[1].length;
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const match = ordered ? ORDERED.exec(line) : UNORDERED.exec(line);
    const lineIndent = (/^\s*/.exec(line)?.[0].length) ?? 0;
    if (match && match[1].length === indent) {
      items.push({ children: parseInline(ordered ? match[3] : match[2]) });
      i += 1;
      continue;
    }
    if ((ORDERED.test(line) || UNORDERED.test(line)) && lineIndent > indent && items.length) {
      const nested = parseList(lines, i);
      items[items.length - 1].sublist = nested.block;
      i = nested.next;
      continue;
    }
    // سطر تابع للعنصر السابق (التفاف نص).
    if (line.trim() && lineIndent > indent && items.length) {
      items[items.length - 1].children.push({ type: "br" }, ...parseInline(line.trim()));
      i += 1;
      continue;
    }
    break;
  }
  return { block: { type: "list", ordered, start: ordered ? toNumber(first[2]) : 1, items }, next: i };
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) { body.push(lines[i]); i += 1; }
      i += 1; // يتخطى السطر الختامي إن وُجد.
      blocks.push({ type: "code", lang: fence[2] ?? "", text: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length as 1, children: parseInline(heading[2]) }); i += 1; continue; }
    if (HR.test(line)) { blocks.push({ type: "hr" }); i += 1; continue; }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
      blocks.push({ type: "quote", children: parseMarkdown(body.join("\n")) });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const header = splitRow(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) { rows.push(splitRow(lines[i])); i += 1; }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    if (ORDERED.test(line) || UNORDERED.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length && lines[i].trim() && !FENCE.test(lines[i]) && !HEADING.test(lines[i]) && !HR.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) && !ORDERED.test(lines[i]) && !UNORDERED.test(lines[i])
    ) { body.push(lines[i].trim()); i += 1; }
    blocks.push({ type: "paragraph", children: parseInline(body.join("\n")) });
  }
  return blocks;
}
