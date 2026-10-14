import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import App from "./App";
import { API_MODE, createApiLinks } from "@/lib/apiLink";
import { setupServiceWorker } from "./serviceWorker";
import { ROLE_SIMULATION_STORAGE_KEY } from "./contexts/RoleSimulationContext";
import { STANDALONE_MUSHAF } from "./mushaf/lib/standalone";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  },
});
let dataSyncTimer: number | undefined;

const scheduleSharedDataRefresh = () => {
  if (typeof window === "undefined") return;
  window.clearTimeout(dataSyncTimer);
  dataSyncTimer = window.setTimeout(() => {
    void queryClient.invalidateQueries();
  }, 120);
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (window.location.pathname !== "/login") window.location.replace("/login");
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
  if (event.type === "updated" && event.action.type === "success") {
    scheduleSharedDataRefresh();
  }
});

const roleSimulationHeaders = (): Record<string, string> => {
  try {
    if (sessionStorage.getItem(ROLE_SIMULATION_STORAGE_KEY)) return { "x-tarteel-role-simulation": "1" };
  } catch {}
  return {};
};

const root = createRoot(document.getElementById("root")!);

function renderStartupError(error: unknown) {
  console.error("[Tarteel] startup failed", error);
  const message = error instanceof Error ? error.message : String(error);
  root.render(
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>تعذر تشغيل ترتيل</h1>
        <p style={{ color: "#5D665E", marginBottom: 16 }}>{message}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 12, background: "#123D2A", color: "#fff" }}>إعادة المحاولة</button>
      </div>
    </div>
  );
}

if (STANDALONE_MUSHAF) {
  // «المصحف المستقل» (تبويب المصحف في أندرويد): لا يفتح قاعدة بيانات الجهاز ولا يحمّل منطق الخادم،
  // حتى لا تتنافس نسختان من القاعدة مع تبويب المنصة (انظر mushaf/lib/standalone.ts).
  import("./mushaf/app/StandaloneRoot")
    .then(({ default: StandaloneRoot }) => {
      root.render(<StandaloneRoot queryClient={queryClient} />);
    })
    .catch(renderStartupError);
} else {
  createApiLinks(roleSimulationHeaders)
    .then((links) => {
      const trpcClient = trpc.createClient({ links });
      root.render(
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </trpc.Provider>
      );
    })
    .catch(renderStartupError);
}

// النسخة المحلية تعمل داخل التطبيق دون شبكة؛ عامل الخدمة (التخزين المؤقت للويب) لا حاجة له فيها.
if (API_MODE === "server") setupServiceWorker();
