/**
 * السجل اليومي للحلقة والتقارير في ترتيل: شاشتا زِن (/teacher/register و/teacher/reports) كما هما، داخل
 * حساب ترتيل وهويته، على /daily و/reports.
 *
 * - يُفتحان بحساب ترتيل وعضوية مفعّلة (كبقية المنصة)، وبصلاحية daily:view (والتقارير reports:view).
 * - يضبط عميل tRPC لنداءات السجل (lib/daily-record-api.ts وlib/reports/api.ts).
 * - رابط الإشعار /daily?record=ID يُحوَّل إلى حلقة السجل ويومه (daily.locate).
 * - جذر القسم يحمل الصنف tq-mushaf الذي تُحصر فيه أنماط زِن بألوان ترتيل وخطوطه.
 */
import "@/mushaf/mushaf.css";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Redirect, Route, Switch, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { trpc } from "@/lib/trpc";
import { PageLoader } from "@/components/PageLoader";
import { setMushafApi } from "@/mushaf/compat/api";
import { MushafScope } from "@/mushaf/compat/scope";
import { hasActiveAccessMembership } from "../../../../shared/accessMembership";

type RouteModule = { Route: { Component: ComponentType } };
const screen = (load: () => Promise<RouteModule>) =>
  lazy(() => load().then(m => ({ default: m.Route.Component })));

const Register = screen(
  () => import("@/mushaf/routes/_authed.teacher_.register")
);
const Reports = screen(
  () => import("@/mushaf/routes/_authed.teacher_.reports")
);

/** /daily?record=ID (من الإشعارات): يحدد الحلقة واليوم ثم يفتح السجل. */
function RecordLink({ record }: { record: string }) {
  const located = trpc.daily.locate.useQuery({ record }, { retry: false });
  if (located.isPending) return <PageLoader fullScreen />;
  if (!located.data) return <Redirect to="/daily" replace />;
  return (
    <Redirect
      to={`/daily?halaqa=${located.data.halaqa}&date=${located.data.date}`}
      replace
    />
  );
}

function DailyScreen() {
  const record = new URLSearchParams(useSearch()).get("record");
  if (record && /^\d+$/.test(record)) return <RecordLink record={record} />;
  return <Register />;
}

const SCOPE = "tq-mushaf tq-daily";

export default function DailyApp() {
  const { loading, isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const utils = trpc.useUtils();
  const { data: memberships, isLoading: membershipsLoading } =
    trpc.access.mine.useQuery(undefined, { enabled: isAuthenticated });
  useEffect(() => {
    setMushafApi(utils.client);
  }, [utils]);

  if (loading || (isAuthenticated && membershipsLoading))
    return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!hasActiveAccessMembership(memberships)) return <Redirect to="/start" />;
  if (!can("daily:view")) return <Redirect to="/dashboard" />;

  return (
    <MushafScope.Provider value={SCOPE}>
      <div className={SCOPE} dir="rtl" lang="ar">
        <Suspense fallback={<PageLoader fullScreen />}>
          <Switch>
            <Route path="/daily" component={DailyScreen} />
            <Route path="/reports">
              {can("reports:view") ? <Reports /> : <Redirect to="/daily" />}
            </Route>
          </Switch>
        </Suspense>
      </div>
    </MushafScope.Provider>
  );
}
