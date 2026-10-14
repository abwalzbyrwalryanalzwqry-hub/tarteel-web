import { COOKIE_NAME } from "@shared/const";

import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { aiRouter } from "./routers/ai";
import { dailyRouter } from "./routers/daily";

import { localAuthRouter } from "./auth/localAuth";
import { accountDeletionRouter } from "./auth/accountDeletion";
import { quranRouters } from "./routers/quran";
import { centersRouters } from "./routers/centers";
import { circlesRouters } from "./routers/circles";
import { peopleRouters } from "./routers/people";
import { adminRouters } from "./routers/admin";
import { accessRouters } from "./routers/access";

/**
 * الموجّه الجذري. كل مجال في ملف مستقل داخل server/routers/ والمفاتيح كما هي،
 * فواجهة tRPC (ومسارات الطلبات من الواجهة) لم تتغير.
 */
export const appRouter = router({
  system: systemRouter,

  auth: router({
    ...localAuthRouter,
    ...accountDeletionRouter,
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===================== DAILY RECORD & REPORTS =====================
  daily: dailyRouter,

  // ===================== AI ASSISTANT =====================
  ai: aiRouter,

  ...quranRouters,
  ...centersRouters,
  ...circlesRouters,
  ...peopleRouters,
  ...adminRouters,
  ...accessRouters,
});

export type AppRouter = typeof appRouter;
