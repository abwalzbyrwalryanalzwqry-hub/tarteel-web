import { eq } from "drizzle-orm";
import {
  evaluation,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ===================== EVALUATION =====================
export async function getEvaluationBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluation).where(eq(evaluation.sessionId, sessionId));
}

export async function upsertEvaluation(data: typeof evaluation.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(evaluation).values(data).onDuplicateKeyUpdate({
    set: {
      tajweedScore: data.tajweedScore,
      pronunciationScore: data.pronunciationScore,
      memorizationScore: data.memorizationScore,
      behaviorScore: data.behaviorScore,
      totalScore: data.totalScore,
      points: data.points,
      notes: data.notes,
      updatedAt: new Date(),
    },
  });
}
