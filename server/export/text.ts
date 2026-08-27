function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateCsv(headers: string[], rows: string[][]): Buffer {
  const table = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  return Buffer.from(`\uFEFF${table}`, "utf8");
}

export function generateWordDocument(title: string, metadata: string[], headers: string[], rows: string[][]): Buffer {
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? "—"))}</td>`).join("")}</tr>`).join("");
  const markup = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>@page{size:A4;margin:1.8cm}body{font-family:Arial,Tahoma,sans-serif;direction:rtl;text-align:right;color:#1d2b22;line-height:1.65}header{border-bottom:2px solid #0b4f39;padding-bottom:12px;margin-bottom:18px}h1{margin:0;color:#0b4f39;font-size:22pt}.meta{margin-top:8px;color:#52645c;font-size:10.5pt}.meta span{display:block;margin:2px 0}table{border-collapse:collapse;table-layout:fixed;width:100%;margin-top:18px;direction:rtl;font-size:10pt}thead{display:table-header-group}th{background:#0b4f39;color:#fff;font-weight:700}th,td{border:1px solid #d9e4db;padding:8px 9px;text-align:right;vertical-align:top;word-wrap:break-word}tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f8fbf8}</style></head><body><header><h1>${escapeHtml(title)}</h1><div class="meta">${metadata.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></header><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
  return Buffer.from(markup, "utf8");
}
