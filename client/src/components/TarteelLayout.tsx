import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getVisibleNavigationPaths } from "../../../shared/permissions";
import { hasActiveAccessMembership } from "../../../shared/accessMembership";
import { trpc } from "@/lib/trpc";
import { useRoleSimulation } from "@/contexts/RoleSimulationContext";
import {
  ArrowRight,
  ArchiveRestore,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenText,
  BookText,
  Building2,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  KeyRound,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, permission: "dashboard:view" as const },
  { path: "/centers", label: "المراكز", icon: Building2, permission: "centers:manage" as const },
  { path: "/branches", label: "الفروع", icon: Building2, permission: "branches:manage" as const },
  { path: "/seasons", label: "المواسم الدراسية", icon: BookText, permission: "seasons:manage" as const },
  { path: "/circles", label: "الحلقات", icon: BookOpen, permission: "circles:view" as const },
  { path: "/teachers", label: "المعلمون", icon: GraduationCap, permission: "teachers:manage" as const },
  { path: "/teacher-invites", label: "دعوات المعلمين", icon: KeyRound, permission: "teachers:manage" as const },
  { path: "/guide", label: "لوحة الموجه", icon: UserCog, permission: "circles:view" as const },
  { path: "/access-management", label: "المستخدمون والصلاحيات", icon: UserCog, permission: "settings:manage" as const },
  { path: "/students", label: "الطلاب", icon: Users, permission: "students:view" as const },
  { path: "/periods", label: "الفترات", icon: ClipboardList, permission: "sessions:view" as const },
  { path: "/quran", label: "القرآن الكريم", icon: BookOpenText, permission: "quran:view" as const },
  { path: "/parent-messages", label: "رسائل أولياء الأمور", icon: MessageSquareText, permission: "messages:manage" as const },
  { path: "/reports", label: "التقارير", icon: BarChart3, permission: "reports:view" as const },
  { path: "/assistant", label: "المرشد الذكي", icon: Sparkles, permission: "ai:use" as const },
  { path: "/notifications", label: "الإشعارات", icon: Bell, permission: "notifications:view" as const },
  { path: "/settings", label: "الإعدادات", icon: Settings, permission: "settings:view" as const },
  { path: "/trash", label: "سلة المحذوفات", icon: ArchiveRestore, permission: "trash:manage" as const },
  { path: "/audit-log", label: "سجل التدقيق", icon: ClipboardList, permission: "audit:view" as const },
];

interface TarteelLayoutProps {
  children: React.ReactNode;
}

export default function TarteelLayout({ children }: TarteelLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { can, role, roleLabel } = usePermissions();
  const { simulation, stopSimulation } = useRoleSimulation();
  const { data: memberships, isLoading: membershipsLoading } = trpc.access.mine.useQuery(undefined, { enabled: isAuthenticated });
  const needsAccessCode = isAuthenticated && !membershipsLoading && !hasActiveAccessMembership(memberships);
  const switchAccount = () => {
    try { sessionStorage.setItem("tarteel-switch-account", "1"); } catch {}
    void logout();
  };
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/dashboard");
  };
  const visibleNavItems = navItems.filter((item) => getVisibleNavigationPaths(role).includes(item.path));
  const currentNav = location === "/developer"
    ? navItems.find((item) => item.path === "/settings")
    : navItems.find((item) =>
      location === item.path || (item.path !== "/dashboard" && location.startsWith(`${item.path}/`))
    );
  const mayViewCurrentRoute = !currentNav || can(currentNav.permission);

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (needsAccessCode) navigate("/start");
  }, [navigate, needsAccessCode]);

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
          <button onClick={() => navigate("/login")} className="btn-gold w-full text-base">
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (needsAccessCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="glass-card max-w-md rounded-3xl p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient text-white shadow-lg"><KeyRound className="h-8 w-8" /></div>
          <h1 className="mt-5 font-display text-2xl font-bold text-foreground">ابدأ استخدام ترتيل</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">يمكنك الانضمام إلى مركز قائم بكود دخول، أو إنشاء مركز مستقل لتكون مديره الأول.</p>
          <button onClick={() => navigate("/start")} className="btn-gold mt-6 w-full py-3">اختيار طريقة البدء</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:flex" dir="rtl">
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
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            const label = item.path === "/students" && role === "student" ? "إنجازي" : item.path === "/students" && role === "guardian" ? "إنجازات الابن" : item.label;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`sidebar-nav-item ${isActive ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                  title={collapsed ? label : undefined}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.path === "/notifications" && unreadCount && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>{label}</span>}
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
                <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabel}</p>
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
              onClick={switchAccount}
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
      <div className="flex min-w-0 flex-col lg:flex-1">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-4 px-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={goBack}
            className="group flex items-center gap-1.5 rounded-xl border border-primary/15 bg-primary/5 px-2.5 py-1.5 text-sm font-semibold text-primary transition-all hover:-translate-x-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            title="العودة للشاشة السابقة"
            aria-label="العودة للشاشة السابقة"
          >
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            <span className="hidden sm:inline">رجوع</span>
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
          <button
            onClick={switchAccount}
            className="flex items-center gap-2 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-red-500/10"
            title="تسجيل الخروج وتبديل الحساب"
            aria-label="تسجيل الخروج وتبديل الحساب"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">تبديل الحساب</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {simulation && <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"><span><strong>وضع محاكاة: {roleLabel}.</strong> الواجهة مقيدة للدور المختار وجميع عمليات التعديل موقوفة.</span><button onClick={stopSimulation} className="font-semibold underline underline-offset-4">إنهاء المحاكاة</button></div>}
          {mayViewCurrentRoute ? children : (
            <section className="mx-auto mt-16 max-w-md rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <h1 className="font-display text-2xl font-bold text-foreground">ليس لديك صلاحية لعرض هذه الصفحة</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">تظهر لك الخدمات المتاحة وفق دورك داخل المركز أو الحلقة.</p>
              <button onClick={() => navigate("/dashboard")} className="btn-gold mt-6 px-5 py-2 text-sm">العودة للوحة المعلومات</button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
