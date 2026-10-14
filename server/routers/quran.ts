/** موجّهات tRPC: حالة القراءة في المصحف والمراجعة المتباعدة وسجل الصفحة. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { QURAN_SURAHS } from "../../shared/types";

import { protectedProcedure, router } from "../_core/trpc";

import {
  applyQuranReview,
  getDueQuranReviews,
  getQuranRecordsInRange,
  InvalidReadingStateError,
  syncQuranReadingState,
} from "../db";
import { listReadableStudents } from "./_shared";

const isoTime = z.string().max(40).nullish();
const readingStateInput = z.object({
  bookmarks: z.array(z.unknown()).max(5000).optional(),
  bookmarksAt: isoTime,
  khatmah: z.record(z.string(), z.unknown()).optional(),
  khatmahAt: isoTime,
  history: z.record(z.string(), z.unknown()).optional(),
  historyAt: isoTime,
});

export const quranRouters = {

  // حالة القراءة في قسم المصحف (العلامات والختمة والسجل): «الأحدث يغلب» لكل حقل.
  quranReadingState: router({
    sync: protectedProcedure.input(readingStateInput).mutation(async ({ ctx, input }) => {
      try {
        return await syncQuranReadingState(ctx.user.id, input);
      } catch (error) {
        if (error instanceof InvalidReadingStateError) throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_STATE" });
        throw error;
      }
    }),
  }),

  // المراجعة المتباعدة لما أتقنه صاحب الحساب في وضع الحفظ (لنفسه فقط).
  quranReview: router({
    markMastered: protectedProcedure.input(z.object({ surahNumber: z.number().int().min(1).max(114), fromAyah: z.number().int().min(1), toAyah: z.number().int().min(1) })).mutation(({ ctx, input }) => {
      const surah = QURAN_SURAHS.find((item) => item.number === input.surahNumber);
      if (!surah || input.toAyah < input.fromAyah || input.toAyah > surah.ayahs) throw new TRPCError({ code: "BAD_REQUEST", message: "مقطع غير صحيح." });
      return applyQuranReview({ userId: ctx.user.id, ...input, score: 95 });
    }),
    due: protectedProcedure.query(({ ctx }) => getDueQuranReviews(ctx.user.id)),
  }),

  // سجل الصفحة: الحفظ والمراجعة في السجل اليومي التي تشمل صفحة المصحف، لمن يحق له قراءتها.
  quranRecords: router({
    byRange: protectedProcedure.input(z.object({ fromSurah: z.number().int().min(1).max(114), fromAyah: z.number().int().min(1), toSurah: z.number().int().min(1).max(114), toAyah: z.number().int().min(1) })).query(async ({ ctx, input }) => {
      const readable = await listReadableStudents(ctx.user, {});
      return getQuranRecordsInRange(readable.map((student) => student.id), input);
    }),
  }),

};
