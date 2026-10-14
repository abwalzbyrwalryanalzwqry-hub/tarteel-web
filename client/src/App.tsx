import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { Suspense, lazy, useEffect, type ComponentType } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleSimulationProvider } from "./contexts/RoleSimulationContext";
import TarteelLayout from "./components/TarteelLayout";
import { PageLoader } from "./components/PageLoader";
import { ConfirmProvider } from "./components/ConfirmProvider";

// كل صفحة في ملف مستقل يُحمَّل عند فتحها فقط؛ كانت كلها في حزمة واحدة (~2.1MB).
// الإطار (TarteelLayout) يبقى في الحزمة الرئيسية ليظهر الشريط الجانبي فوراً أثناء تحميل الصفحة.
const NotFound = lazy(() => import("@/pages/NotFound"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Centers = lazy(() => import("./pages/Centers"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Students = lazy(() => import("./pages/Students"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const Circles = lazy(() => import("./pages/Circles"));
const CircleDetail = lazy(() => import("./pages/CircleDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Trash = lazy(() => import("./pages/Trash"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const SplashScreen = lazy(() => import("./pages/SplashScreen"));
const DeveloperInfo = lazy(() => import("./pages/DeveloperInfo"));
/** قسم المصحف (منقول من زِن): شاشاته كلها تحت /quran بإطارها الخاص وملء الشاشة. */
const MushafApp = lazy(() => import("./mushaf/app/MushafApp"));
/** السجل اليومي للحلقة والتقارير (منقولان من زِن): /daily و/reports بإطارهما الخاص. */
const DailyApp = lazy(() => import("./mushaf/app/DailyApp"));
const ParentMessages = lazy(() => import("./pages/ParentMessages"));
const TeacherInvites = lazy(() => import("./pages/TeacherInvites"));
const RedeemTeacherInvite = lazy(() => import("./pages/RedeemTeacherInvite"));
const AccessManagement = lazy(() => import("./pages/AccessManagement"));
const RedeemAccessCode = lazy(() => import("./pages/RedeemAccessCode"));
const CenterOnboarding = lazy(() => import("./pages/CenterOnboarding"));
const GuideDashboard = lazy(() => import("./pages/GuideDashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const DeleteAccountInfo = lazy(() => import("./pages/DeleteAccountInfo"));

/** صفحة داخل الإطار، معرّفة مرة واحدة حتى لا يُعاد تركيب الإطار مع كل إعادة رسم للموجّه. */
function inLayout<P extends object>(
  Page: ComponentType<P>,
  mapProps?: (params: Record<string, string | undefined>) => P
) {
  return function LayoutRoute(props: {
    params?: Record<string, string | undefined>;
  }) {
    const pageProps = mapProps ? mapProps(props.params ?? {}) : ({} as P);
    return (
      <TarteelLayout>
        <Suspense fallback={<PageLoader />}>
          <Page {...pageProps} />
        </Suspense>
      </TarteelLayout>
    );
  };
}

const idParam = (params: Record<string, string | undefined>) =>
  Number(params.id);

const DashboardRoute = inLayout(Dashboard);
const CentersRoute = inLayout(Centers);
const CirclesRoute = inLayout(Circles);
const TeachersRoute = inLayout(Teachers);
const StudentsRoute = inLayout(Students);
const AIAssistantRoute = inLayout(AIAssistant);
const ParentMessagesRoute = inLayout(ParentMessages);
const TeacherInvitesRoute = inLayout(TeacherInvites);
const AccessManagementRoute = inLayout(AccessManagement);
const GuideDashboardRoute = inLayout(GuideDashboard);
const NotificationsRoute = inLayout(Notifications);
const SettingsRoute = inLayout(Settings);
const DeveloperInfoRoute = inLayout(DeveloperInfo);
const TrashRoute = inLayout(Trash);
const AuditLogRoute = inLayout(AuditLog);
const CircleDetailRoute = inLayout(CircleDetail, params => ({
  circleId: idParam(params),
}));
const StudentProfileRoute = inLayout(StudentProfile, params => ({
  studentId: idParam(params),
}));
/** روابط الفترات والجلسات القديمة تفتح السجل اليومي. */
function LegacyDailyRedirect() {
  return <Redirect to="/daily" replace />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader fullScreen />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfUse} />
        <Route path="/delete-account" component={DeleteAccountInfo} />
        <Route path="/dashboard" component={DashboardRoute} />
        <Route path="/centers" component={CentersRoute} />
        <Route path="/circles" component={CirclesRoute} />
        <Route path="/circles/:id" component={CircleDetailRoute} />
        <Route path="/teachers" component={TeachersRoute} />
        <Route path="/students/:id" component={StudentProfileRoute} />
        <Route path="/students" component={StudentsRoute} />
        <Route path="/daily" component={DailyApp} />
        <Route path="/periods/*?" component={LegacyDailyRedirect} />
        <Route path="/sessions/*?" component={LegacyDailyRedirect} />
        <Route path="/assistant">{__TARTEEL_DEVICE__ ? <Redirect to="/dashboard" /> : <AIAssistantRoute />}</Route>
        <Route path="/quran/*?" component={MushafApp} />
        <Route path="/parent-messages" component={ParentMessagesRoute} />
        <Route path="/teacher-invites" component={TeacherInvitesRoute} />
        <Route path="/access-management" component={AccessManagementRoute} />
        <Route path="/guide" component={GuideDashboardRoute} />
        <Route path="/redeem-teacher-invite" component={RedeemTeacherInvite} />
        <Route path="/start" component={CenterOnboarding} />
        <Route path="/redeem-access-code" component={RedeemAccessCode} />
        <Route path="/reports" component={DailyApp} />
        <Route path="/notifications" component={NotificationsRoute} />
        <Route path="/settings" component={SettingsRoute} />
        <Route path="/developer" component={DeveloperInfoRoute} />
        <Route path="/trash" component={TrashRoute} />
        <Route path="/audit-log" component={AuditLogRoute} />
        <Route path="/" component={SplashScreen} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <RoleSimulationProvider>
          <TooltipProvider>
            <ConfirmProvider>
              <Toaster position="top-center" richColors closeButton />
              <Router />
            </ConfirmProvider>
          </TooltipProvider>
        </RoleSimulationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
