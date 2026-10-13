import { memo, useMemo, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@shared/markdown";

/** يعرض Markdown الردود عناصرَ React (بلا HTML خام). انظر shared/markdown.ts. */

function renderInline(nodes: Inline[], keyPrefix = "i"): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text": return node.text;
      case "br": return <br key={key} />;
      case "code": return <code key={key} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]" dir="ltr">{node.text}</code>;
      case "strong": return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em": return <em key={key}>{renderInline(node.children, key)}</em>;
      case "link": return <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">{renderInline(node.children, key)}</a>;
    }
  });
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(block.level + 1, 6)}` as "h2";
      return <Tag key={key} className="mt-3 mb-1.5 font-bold first:mt-0">{renderInline(block.children, key)}</Tag>;
    }
    case "paragraph": return <p key={key} className="my-1.5 leading-7">{renderInline(block.children, key)}</p>;
    case "hr": return <hr key={key} className="my-3 border-border" />;
    case "code": return <pre key={key} dir="ltr" className="my-2 overflow-x-auto rounded-md bg-background/70 p-3 text-left font-mono text-xs leading-5"><code>{block.text}</code></pre>;
    case "quote": return <blockquote key={key} className="my-2 border-s-4 border-primary/40 ps-3 text-muted-foreground">{block.children.map((child, i) => renderBlock(child, `${key}-${i}`))}</blockquote>;
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={`${key}-${i}`} className="my-0.5 leading-7">
          {renderInline(item.children, `${key}-${i}`)}
          {item.sublist && renderBlock(item.sublist, `${key}-${i}-s`)}
        </li>
      ));
      return block.ordered
        ? <ol key={key} start={block.start} className="my-1.5 list-decimal ps-6">{items}</ol>
        : <ul key={key} className="my-1.5 list-disc ps-6">{items}</ul>;
    }
    case "table": return (
      <div key={key} className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr>{block.header.map((cell, i) => <th key={i} className="border border-border bg-background/60 px-2 py-1 text-start font-semibold">{renderInline(cell, `${key}-h${i}`)}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="border border-border px-2 py-1 align-top">{renderInline(cell, `${key}-${r}-${c}`)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
}

export const MarkdownText = memo(function MarkdownText({ children, className }: { children: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(children ?? ""), [children]);
  return <div className={className} dir="auto">{blocks.map((block, i) => renderBlock(block, `b${i}`))}</div>;
});
