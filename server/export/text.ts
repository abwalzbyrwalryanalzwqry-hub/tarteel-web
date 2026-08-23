function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateCsv(headers: string[], rows: string[][]): Buffer {
  const table = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  return Buffer.from(`\uFEFF${table}`, "utf8");
}

export function generateWordDocument(title: string, metadata: string[], headers: string[], rows: string[][]): Buffer {
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const markup = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#173b2d}h1{color:#9b6a11}.meta{color:#52645c;font-size:12pt}table{border-collapse:collapse;width:100%;margin-top:18px}th{background:#173b2d;color:white}th,td{border:1px solid #c9b78c;padding:8px;text-align:right}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">${metadata.map(escapeHtml).join("<br>")}</div><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
  return Buffer.from(markup, "utf8");
}
