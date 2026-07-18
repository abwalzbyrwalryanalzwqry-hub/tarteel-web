import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  ArchiveRestore,
  BarChart3,
  Bell,
  BookOpen,
  BookText,
  Building2,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { path: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/centers", label: "المراكز", icon: Building2 },
  { path: "/branches", label: "الفروع", icon: Building2 },
  { path: "/seasons", label: "المواسم الدراسية", icon: BookText },
  { path: "/circles", label: "الحلقات", icon: BookOpen },
  { path: "/teachers", label: "المعلمون", icon: GraduationCap },
  { path: "/students", label: "الطلاب", icon: Users },
  { path: "/sessions", label: "الجلسات", icon: ClipboardList },
  { path: "/reports", label: "التقارير", icon: BarChart3 },
  { path: "/notifications", label: "الإشعارات", icon: Bell },
  { path: "/settings", label: "الإعدادات", icon: Settings },
  { path: "/trash", label: "سلة المحذوفات", icon: ArchiveRestore },
  { path: "/audit-log", label: "سجل التدقيق", icon: ClipboardList },
];

interface TarteelLayoutProps {
  children: React.ReactNode;
}

export default function TarteelLayout({ children }: TarteelLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      startLogin();
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full gold-gradient flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <p className="font-display text-xl text-foreground">ترتيل</p>
          <p className="text-sm text-muted-foreground mt-1">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background islamic-pattern">
        <div className="glass-card rounded-3xl p-10 text-center max-w-sm w-full mx-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full gold-gradient flex items-center justify-center shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">ترتيل</h1>
          <p className="text-muted-foreground mb-8 text-sm">منصة إدارة مراكز تحفيظ القرآن الكريم</p>
          <button onClick={() => startLogin()} className="btn-gold w-full text-base">
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 h-full z-50 flex flex-col
          transition-all duration-300 ease-out
          glass-sidebar
          ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          ${collapsed ? "w-16" : "w-64"}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-sidebar-border ${collapsed ? "justify-center" : ""}`}>
          <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center flex-shrink-0 shadow-md">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display text-xl font-bold text-sidebar-primary">ترتيل</h1>
              <p className="text-xs text-sidebar-foreground/60">إدارة مراكز القرآن</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="mr-auto text-sidebar-foreground/60 hover:text-sidebar-foreground lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`sidebar-nav-item ${isActive ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.path === "/notifications" && unreadCount && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-sidebar-accent/50">
              <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user?.name?.charAt(0) ?? "م"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? "مستخدم"}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email ?? ""}</p>
              </div>
            </div>
          )}
          <div className={`flex gap-2 ${collapsed ? "flex-col" : ""}`}>
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-sm"
              title="تبديل الثيم"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {!collapsed && <span>{theme === "dark" ? "نهاري" : "ليلي"}</span>}
            </button>
            <button
              onClick={() => logout()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>خروج</span>}
            </button>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors text-xs"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>طي القائمة</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-4 px-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link href="/notifications">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
