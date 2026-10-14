/**
 * قسم المصحف في ترتيل: شاشات «المصحف» من زِن كما هي، داخل حساب ترتيل وهويته.
 *
 * - يُفتح بحساب ترتيل فقط (من لم يدخل يُحوَّل إلى الدخول، ومن لا عضوية مفعّلة له إلى «طريقة البدء»
 *   كبقية المنصة)، وبصلاحية quran:view.
 * - يضبط عميل tRPC لوحدات المزامنة، ويبدأ مزامنة حالة القراءة (العلامات والختمة والسجل) وصندوق
 *   مراجعات «أتقنتُها» مع خادم ترتيل.
 * - مشغّل التلاوة في جذر القسم (RecitationPlayerProvider)، فتستمر التلاوة بين شاشاته.
 * - كل شاشة تُحمَّل كسولاً عند فتحها، وجذر القسم يحمل الصنف tq-mushaf الذي تُحصر فيه أنماط زِن.
 * - «المصحف المستقل» (StandaloneMushafApp، تبويب المصحف في أندرويد) يعرض الشاشات نفسها دون حساب ودون
 *   tRPC، بلا سجل الحفظ واختيار المقطع لأنهما من بيانات المنصة.
 */
import "@/mushaf/mushaf.css";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Redirect, Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { trpc } from "@/lib/trpc";
import { PageLoader } from "@/components/PageLoader";
import { setMushafApi } from "@/mushaf/compat/api";
import { startAccountSync } from "@/mushaf/lib/quran/account-sync";
import { startSelfReviewSync } from "@/mushaf/lib/quran/memorize-api";
import { RecitationPlayerProvider } from "@/mushaf/hooks/quran/recitation-host";
import { hasActiveAccessMembership } from "../../../../shared/accessMembership";

type RouteModule = { Route: { Component: ComponentType } };
const screen = (load: () => Promise<RouteModule>) =>
  lazy(() => load().then(m => ({ default: m.Route.Component })));

const Hub = screen(() => import("@/mushaf/routes/_authed.mushaf.index"));
const Read = screen(() => import("@/mushaf/routes/_authed.mushaf.read"));
const Bookmarks = screen(
  () => import("@/mushaf/routes/_authed.mushaf.bookmarks")
);
const Khatmah = screen(() => import("@/mushaf/routes/_authed.mushaf.khatmah"));
const LastRead = screen(
  () => import("@/mushaf/routes/_authed.mushaf.last-read")
);
const Memorize = screen(
  () => import("@/mushaf/routes/_authed.mushaf.memorize")
);
const ReaderSettings = screen(
  () => import("@/mushaf/routes/_authed.mushaf.reader-settings")
);
const Recitations = screen(
  () => import("@/mushaf/routes/_authed.mushaf.recitations")
);
const Records = screen(() => import("@/mushaf/routes/_authed.mushaf.records"));
const Search = screen(() => import("@/mushaf/routes/_authed.mushaf.search"));
const Share = screen(() => import("@/mushaf/routes/_authed.mushaf.share"));
const Sources = screen(() => import("@/mushaf/routes/_authed.mushaf.sources"));
const Tafsir = screen(() => import("@/mushaf/routes/_authed.mushaf.tafsir"));
const Picker = screen(() => import("@/mushaf/routes/_authed.mushaf.picker"));

function useMushafSync(userId: number | null) {
  const utils = trpc.useUtils();
  useEffect(() => {
    setMushafApi(utils.client);
    return () => setMushafApi(null);
  }, [utils]);
  useEffect(() => {
    if (!userId) return;
    const offAccount = startAccountSync(String(userId));
    const offReviews = startSelfReviewSync();
    return () => {
      offAccount();
      offReviews();
    };
  }, [userId]);
}

/** إطار القسم: الأنماط والخطوط ومشغّل التلاوة، ثم الشاشات. */
function MushafRoutes({ account }: { account: boolean }) {
  return (
    <div className="tq-mushaf" dir="rtl" lang="ar">
      {/* خطوط نص القرآن (أميري قرآن وشهرزاد ونسخ نوتو) مستضافة في public/fonts. */}
      <link
        rel="stylesheet"
        href="/fonts/quran-fonts.css"
        precedence="default"
      />
      <RecitationPlayerProvider>
        <Suspense fallback={<PageLoader fullScreen />}>
          <Switch>
            <Route path="/quran" component={Hub} />
            <Route path="/quran/read" component={Read} />
            <Route path="/quran/bookmarks" component={Bookmarks} />
            <Route path="/quran/khatmah" component={Khatmah} />
            <Route path="/quran/last-read" component={LastRead} />
            <Route path="/quran/memorize" component={Memorize} />
            <Route path="/quran/reader-settings" component={ReaderSettings} />
            <Route path="/quran/recitations" component={Recitations} />
            {account && <Route path="/quran/records" component={Records} />}
            <Route path="/quran/search" component={Search} />
            <Route path="/quran/share" component={Share} />
            <Route path="/quran/sources" component={Sources} />
            <Route path="/quran/tafsir" component={Tafsir} />
            {account && <Route path="/quran/picker" component={Picker} />}
            <Route>
              <Redirect to="/quran" replace />
            </Route>
          </Switch>
        </Suspense>
      </RecitationPlayerProvider>
    </div>
  );
}

export default function MushafApp() {
  const { user, loading, isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const { data: memberships, isLoading: membershipsLoading } =
    trpc.access.mine.useQuery(undefined, { enabled: isAuthenticated });
  const ready = isAuthenticated && !membershipsLoading;
  const allowed =
    ready && hasActiveAccessMembership(memberships) && can("quran:view");
  useMushafSync(allowed && user ? user.id : null);

  if (loading || (isAuthenticated && membershipsLoading))
    return <PageLoader fullScreen />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!hasActiveAccessMembership(memberships)) return <Redirect to="/start" />;
  if (!can("quran:view")) return <Redirect to="/dashboard" />;

  return <MushafRoutes account />;
}

/** «المصحف المستقل»: كل ما خارج /quran يعود إلى فهرس المصحف. */
export function StandaloneMushafApp() {
  return (
    <Switch>
      <Route path="/quran/*?">
        <MushafRoutes account={false} />
      </Route>
      <Route>
        <Redirect to="/quran" replace />
      </Route>
    </Switch>
  );
}
