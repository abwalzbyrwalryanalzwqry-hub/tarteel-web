type DatedRecord = { createdAt: Date | string };

const RANGE_MS = { today: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };

export function filterNotifications<T extends DatedRecord & { title: string; message: string; isRead: boolean }>(items: T[], options: { search: string; readFilter: "all" | "unread" | "read"; dateRange: "all" | "today" | "week" | "month"; now?: number }): T[] {
  const needle = options.search.trim().toLowerCase();
  const now = options.now ?? Date.now();
  return items.filter((item) => {
    const matchesSearch = !needle || `${item.title} ${item.message}`.toLowerCase().includes(needle);
    const matchesRead = options.readFilter === "all" || (options.readFilter === "read" ? item.isRead : !item.isRead);
    const matchesDate = options.dateRange === "all" || now - new Date(item.createdAt).getTime() <= RANGE_MS[options.dateRange];
    return matchesSearch && matchesRead && matchesDate;
  });
}

export function filterAuditLogs<T extends DatedRecord & { action: string; entity: string; entityId: number | null }>(items: T[], options: { search: string; actionFilter: string; dateRange: "all" | "week" | "month"; now?: number }): T[] {
  const needle = options.search.trim().toLowerCase();
  const now = options.now ?? Date.now();
  return items.filter((item) => {
    const matchesSearch = !needle || `${item.action} ${item.entity} ${item.entityId ?? ""}`.toLowerCase().includes(needle);
    const matchesAction = options.actionFilter === "all" || item.action === options.actionFilter;
    const matchesDate = options.dateRange === "all" || now - new Date(item.createdAt).getTime() <= RANGE_MS[options.dateRange];
    return matchesSearch && matchesAction && matchesDate;
  });
}

export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")}`;
}
