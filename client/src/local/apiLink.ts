/**
 * روابط tRPC للنسخة المحلية: تستدعي appRouter داخل التطبيق مباشرة (unstable_localLink) بدل HTTP.
 * الطلبات تُنفذ واحداً تلو الآخر: SQLite في الذاكرة يمثل اتصالاً واحداً، والمعاملات التي تنتظر
 * (await) لا يجوز أن تتداخل معها جمل طلب آخر.
 */
import "./env";
import { observable } from "@trpc/server/observable";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { unstable_localLink, type TRPCLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { initLocalDatabase, saveLocalDatabaseNow } from "./database";
import { createLocalContext, ROLE_SIMULATION_HEADER } from "./context";

export const API_MODE = "local" as const;

let queue: Promise<void> = Promise.resolve();
function acquire(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>(resolve => (release = resolve));
  const ready = queue.then(() => release);
  queue = queue.then(() => next);
  return ready;
}

function serialLink(inner: TRPCLink<AppRouter>): TRPCLink<AppRouter> {
  return runtime => {
    const handler = inner(runtime);
    return ({ op, next }) =>
      observable(observer => {
        let released = false;
        let releaseFn: (() => void) | null = null;
        let cancelled = false;
        let subscription: { unsubscribe: () => void } | null = null;
        const release = () => {
          if (released) return;
          released = true;
          releaseFn?.();
        };
        void acquire().then(fn => {
          releaseFn = fn;
          if (cancelled) return release();
          const isMutation = op.type === "mutation";
          const buffered: unknown[] = [];
          subscription = handler({ op, next }).subscribe({
            // نتيجة التعديل تُسلَّم بعد حفظه على الجهاز، فلا يظهر نجاحاً ثم يضيع إن أُغلق التطبيق فوراً.
            next: value =>
              isMutation ? buffered.push(value) : observer.next(value),
            error: error => {
              release();
              observer.error(error);
            },
            complete: () => {
              const durable = isMutation
                ? saveLocalDatabaseNow().catch(error =>
                    console.error("[Tarteel local] save failed", error)
                  )
                : Promise.resolve();
              void durable.then(() => {
                for (const value of buffered) observer.next(value as never);
                release();
                observer.complete();
              });
            },
          });
        });
        return () => {
          cancelled = true;
          subscription?.unsubscribe();
          release();
        };
      });
  };
}

/**
 * يخدم طلبات fetch("/api/trpc/...") داخل الصفحة نفسها، بنفس صيغة الخادم: تستخدمها اختبارات e2e
 * وأي كود قديم يستدعي الواجهة مباشرة. كل طلب يمر بالطابور نفسه، ودون تجميع (batch).
 */
function installFetchBridge(router: AppRouter) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), location.href), init);
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/trpc"))
      return originalFetch(input, init);
    const release = await acquire();
    try {
      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router,
        allowBatching: false,
        createContext: () => {
          const simulation = request.headers.get(ROLE_SIMULATION_HEADER);
          return createLocalContext(
            simulation ? { [ROLE_SIMULATION_HEADER]: simulation } : {}
          );
        },
      });
      if (request.method === "POST") await saveLocalDatabaseNow();
      return response;
    } finally {
      release();
    }
  };
}

export async function createApiLinks(
  getHeaders: () => Record<string, string>
): Promise<TRPCLink<AppRouter>[]> {
  await initLocalDatabase();
  const { appRouter } = await import("../../../server/routers");
  installFetchBridge(appRouter);
  // علامة جاهزية نسخة الجهاز (قاعدة البيانات محمّلة والجسر مثبّت): تنتظرها الاختبارات.
  (globalThis as { __tarteelLocalReady?: boolean }).__tarteelLocalReady = true;
  return [
    serialLink(
      unstable_localLink({
        router: appRouter,
        transformer: superjson,
        createContext: () => {
          const headers = getHeaders();
          return createLocalContext(
            headers[ROLE_SIMULATION_HEADER]
              ? { [ROLE_SIMULATION_HEADER]: headers[ROLE_SIMULATION_HEADER] }
              : {}
          );
        },
        onError: ({ error, path }) => {
          if (error.code === "INTERNAL_SERVER_ERROR")
            console.error(`[Tarteel local] ${path}`, error.cause ?? error);
        },
      })
    ),
  ];
}
