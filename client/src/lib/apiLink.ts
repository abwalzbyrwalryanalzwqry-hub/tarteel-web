/**
 * روابط tRPC لنسخة الويب: طلبات HTTP إلى الخادم.
 * النسخة المحلية (أندرويد دون خادم) تستبدل هذا الملف عند البناء بـ client/src/local/apiLink.ts.
 */
import { httpBatchLink, type TRPCLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

export const API_MODE = "server" as "server" | "local";

export async function createApiLinks(getHeaders: () => Record<string, string>): Promise<TRPCLink<AppRouter>[]> {
  return [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers: getHeaders,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ];
}
