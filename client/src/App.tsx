import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TarteelLayout from "./components/TarteelLayout";
import Dashboard from "./pages/Dashboard";
import Centers from "./pages/Centers";
import Branches from "./pages/Branches";
import Teachers from "./pages/Teachers";
import Students from "./pages/Students";
import Circles from "./pages/Circles";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Trash from "./pages/Trash";
import AuditLog from "./pages/AuditLog";
import AcademicSeasons from "./pages/AcademicSeasons";
import LoginPage from "./pages/LoginPage";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => <TarteelLayout><Dashboard /></TarteelLayout>} />
      <Route path="/centers" component={() => <TarteelLayout><Centers /></TarteelLayout>} />
      <Route path="/branches" component={() => <TarteelLayout><Branches /></TarteelLayout>} />
      <Route path="/seasons" component={() => <TarteelLayout><AcademicSeasons /></TarteelLayout>} />
      <Route path="/circles" component={() => <TarteelLayout><Circles /></TarteelLayout>} />
      <Route path="/teachers" component={() => <TarteelLayout><Teachers /></TarteelLayout>} />
      <Route path="/students" component={() => <TarteelLayout><Students /></TarteelLayout>} />
      <Route path="/sessions" component={() => <TarteelLayout><Sessions /></TarteelLayout>} />
      <Route path="/sessions/:id" component={(props: any) => <TarteelLayout><SessionDetail sessionId={Number(props.params?.id)} /></TarteelLayout>} />
      <Route path="/reports" component={() => <TarteelLayout><Reports /></TarteelLayout>} />
      <Route path="/notifications" component={() => <TarteelLayout><Notifications /></TarteelLayout>} />
      <Route path="/settings" component={() => <TarteelLayout><Settings /></TarteelLayout>} />
      <Route path="/trash" component={() => <TarteelLayout><Trash /></TarteelLayout>} />
      <Route path="/audit-log" component={() => <TarteelLayout><AuditLog /></TarteelLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
