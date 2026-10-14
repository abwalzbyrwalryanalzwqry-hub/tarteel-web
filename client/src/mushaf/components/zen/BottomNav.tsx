import { Link, useRouterState } from "@/mushaf/compat/router";
import {
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Headphones,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/mushaf/lib/i18n";
import { STANDALONE_MUSHAF } from "@/mushaf/lib/standalone";

type NavItem = { key: string; to: string; label: string; icon: LucideIcon };

/**
 * الشريط السفلي لقسم المصحف في ترتيل، بشكل شريط زِن نفسه (glass-strong): أقسام المصحف الرئيسة،
 * وأولها العودة إلى لوحة ترتيل، فلا يحبس القسم المستخدم داخله.
 */
const ALL_ITEMS: NavItem[] = [
  { key: "home", to: "/today", label: "ترتيل", icon: LayoutDashboard },
  { key: "mushaf", to: "/mushaf", label: "المصحف", icon: BookOpen },
  { key: "read", to: "/mushaf/read", label: "القراءة", icon: BookOpenCheck },
  {
    key: "recitations",
    to: "/mushaf/recitations",
    label: "التلاوات",
    icon: Headphones,
  },
  {
    key: "bookmarks",
    to: "/mushaf/bookmarks",
    label: "العلامات",
    icon: Bookmark,
  },
];

/** في «المصحف المستقل» (تبويب أندرويد) شريط التطبيق الأصلي يوصل إلى المنصة، فلا يتكرر زرها هنا. */
const ITEMS = STANDALONE_MUSHAF
  ? ALL_ITEMS.filter(item => item.key !== "home")
  : ALL_ITEMS;

function activeKey(path: string): string {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/mushaf") return "mushaf";
  const hit = ITEMS.find(
    i => i.key !== "mushaf" && i.key !== "home" && p.startsWith(i.to)
  );
  return hit?.key ?? "mushaf";
}

export function BottomNav() {
  const path = useRouterState({ select: s => s.location.pathname });
  const t = useT();
  const active = activeKey(path);
  return (
    <nav
      aria-label={t("nav.aria")}
      className="glass-strong mx-3 mb-3 rounded-3xl px-1.5 py-2 flex items-center justify-around"
    >
      {ITEMS.map(({ key, to, label, icon: Icon }) => {
        const on = active === key;
        return (
          <Link
            key={key}
            to={to}
            aria-current={on ? "page" : undefined}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-0.5 rounded-2xl transition-all ${
              on
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`w-5 h-5 ${on ? "drop-shadow-[0_0_8px_var(--primary-glow)]" : ""}`}
            />
            <span className="text-[0.6875rem] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
