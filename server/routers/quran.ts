/** موجّهات tRPC: المصحف والعلامات وميزان الحفظ. تُدمج في appRouter (server/routers.ts) بالمفاتيح نفسها. */
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { QURAN_SURAHS } from "../../shared/types";
import { getQuranBookmarkReferenceKey } from "../../shared/quranBookmarks";
import { normalizeQuranVersePreference } from "../../shared/quranVersePreferences";

import { protectedProcedure, router } from "../_core/trpc";

import {
  getCircleMonthlyRecord,
  deleteQuranBookmarkForUser,
  deleteQuranVersePreferenceForUser,
  getQuranBookmarksForUser,
  getQuranVersePreferencesForUser,
  saveQuranBookmark,
  saveQuranVersePreference,
  getStudentById,
} from "../db";
import { assertStudentReadAccess, assertTeacherCircleAccess, getStudentProfileForReader } from "./_shared";

export const quranRouters = {

  quranBookmarks: router({
    list: protectedProcedure.query(({ ctx }) => getQuranBookmarksForUser(ctx.user.id)),
    save: protectedProcedure.input(z.object({ referenceType: z.enum(["page", "ayah"]), pageNumber: z.number().int().min(1).max(604), surahNumber: z.number().int().min(1).max(114).optional(), ayahNumber: z.number().int().positive().optional(), label: z.string().trim().max(160).optional() })).mutation(async ({ ctx, input }) => {
      const surah = input.surahNumber ? QURAN_SURAHS.find((item) => item.number === input.surahNumber) : undefined;
      if (input.referenceType === "ayah" && (!surah || !input.ayahNumber || input.ayahNumber > surah.ayahs)) throw new TRPCError({ code: "BAD_REQUEST", message: "مرجع الآية غير صحيح." });
      const referenceKey = getQuranBookmarkReferenceKey(input);
      return saveQuranBookmark({ userId: ctx.user.id, referenceType: input.referenceType, referenceKey, pageNumber: input.pageNumber, surahNumber: input.referenceType === "ayah" ? input.surahNumber : null, ayahNumber: input.referenceType === "ayah" ? input.ayahNumber : null, label: input.label || null });
    }),
    remove: protectedProcedure.input(z.object({ referenceType: z.enum(["page", "ayah"]), pageNumber: z.number().int().min(1).max(604), surahNumber: z.number().int().min(1).max(114).optional(), ayahNumber: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      if (input.referenceType === "ayah" && (!input.surahNumber || !input.ayahNumber)) throw new TRPCError({ code: "BAD_REQUEST", message: "مرجع الآية غير صحيح." });
      const referenceKey = getQuranBookmarkReferenceKey(input);
      await deleteQuranBookmarkForUser(ctx.user.id, referenceKey);
      return { success: true } as const;
    }),
  }),

  quranVersePreferences: router({
    list: protectedProcedure.query(({ ctx }) => getQuranVersePreferencesForUser(ctx.user.id)),
    save: protectedProcedure.input(z.object({ pageNumber: z.number().int().min(1).max(604), surahNumber: z.number().int().min(1).max(114), ayahNumber: z.number().int().positive(), isFavorite: z.boolean(), note: z.string().trim().max(2400).nullable() })).mutation(async ({ ctx, input }) => {
      const surah = QURAN_SURAHS.find((item) => item.number === input.surahNumber);
      if (!surah || input.ayahNumber > surah.ayahs) throw new TRPCError({ code: "BAD_REQUEST", message: "مرجع الآية غير صحيح." });
      const preference = normalizeQuranVersePreference(input);
      if (!preference.shouldPersist) {
        await deleteQuranVersePreferenceForUser(ctx.user.id, preference.verseKey);
        return null;
      }
      return saveQuranVersePreference({ userId: ctx.user.id, verseKey: preference.verseKey, pageNumber: preference.pageNumber, surahNumber: preference.surahNumber, ayahNumber: preference.ayahNumber, isFavorite: preference.isFavorite, note: preference.note });
    }),
  }),

  mizan: router({
    monthlyRecord: protectedProcedure.input(z.object({ circleId: z.number(), startDate: z.date().optional(), endDate: z.date().optional() })).query(async ({ ctx, input }) => {
      await assertTeacherCircleAccess(ctx.user, input.circleId);
      return getCircleMonthlyRecord(input.circleId, input.startDate, input.endDate);
    }),
    studentProfile: protectedProcedure.input(z.object({ studentId: z.number(), startDate: z.date().optional(), endDate: z.date().optional() })).query(async ({ ctx, input }) => {
      const student = await getStudentById(input.studentId);
      await assertStudentReadAccess(ctx.user, student);
      return getStudentProfileForReader(ctx.user, input.studentId, input.startDate, input.endDate);
    }),
  }),
};
