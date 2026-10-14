/**
 * جذر «المصحف المستقل» (تبويب المصحف في تطبيق أندرويد): قسم المصحف وحده بسمة ترتيل، دون حساب.
 *
 * الشاشات المنقولة تستعمل خطافات tRPC (مثل المراجعات المستحقة) معطّلةً في وضع الضيف، لكنها تحتاج
 * المزوّد نفسه؛ فيُعطى عميلاً لا يصل إلى أي خادم: كل طلب يُرفض فوراً دون فتح قاعدة بيانات الجهاز.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../../server/routers";
import { StandaloneMushafApp } from "./MushafApp";

const offlineLink: TRPCLink<AppRouter> = () => () =>
  observable(observer => {
    observer.error(new TRPCClientError("المصحف المستقل لا يتصل بالمنصة"));
  });

const trpcClient = trpc.createClient({ links: [offlineLink] });

export default function StandaloneRoot({
  queryClient,
}: {
  queryClient: QueryClient;
}) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="light" switchable>
            <Toaster position="top-center" richColors />
            <StandaloneMushafApp />
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
