import { z } from "zod";
import { assertCanAccessResource } from "../auth/authorization";
import { upsertLocalEntity } from "./localRepository";
import type { LocalSession } from "../auth/localSession";

const attendanceSchema = z.enum(["present", "absent", "excused", "late"]);
const quranRangeSchema = z.object({
  fromSurah: z.number().int().min(1).max(114),
  fromAyah: z.number().int().min(1),
  toSurah: z.number().int().min(1).max(114),
  toAyah: z.number().int().min(1),
});

export type EducationActor = {
  session: LocalSession;
  deviceId: string;
};

export async function saveLocalSessionRecord(
  actor: EducationActor,
  input: { id: string; circleId: string; centerId: string; sessionDate: string; payload: Record<string, unknown> },
): Promise<void> {
  assertCanAccessResource(actor.session, { centerId: input.centerId, circleId: input.circleId }, "create");
  await upsertLocalEntity("session", {
    id: input.id,
    name: String(input.payload.title ?? "جلسة"),
    payload: { ...input.payload, circleId: input.circleId, centerId: input.centerId, sessionDate: input.sessionDate },
  }, { userId: actor.session.userId, deviceId: actor.deviceId }, "CREATE");
}

export async function saveLocalAttendance(
  actor: EducationActor,
  input: { id: string; sessionId: string; studentId: string; circleId: string; status: z.infer<typeof attendanceSchema>; note?: string },
): Promise<void> {
  assertCanAccessResource(actor.session, { circleId: input.circleId, studentId: input.studentId }, "update");
  const status = attendanceSchema.parse(input.status);
  await upsertLocalEntity("attendance", {
    id: input.id,
    payload: { sessionId: input.sessionId, studentId: input.studentId, status, note: input.note ?? null },
  }, { userId: actor.session.userId, deviceId: actor.deviceId }, "UPDATE");
}

export async function saveLocalMemorization(
  actor: EducationActor,
  input: { id: string; sessionId: string; studentId: string; circleId: string; range: z.input<typeof quranRangeSchema>; grade?: string },
): Promise<void> {
  assertCanAccessResource(actor.session, { circleId: input.circleId, studentId: input.studentId }, "update");
  const range = quranRangeSchema.parse(input.range);
  await upsertLocalEntity("memorization", {
    id: input.id,
    payload: { sessionId: input.sessionId, studentId: input.studentId, range, grade: input.grade ?? null },
  }, { userId: actor.session.userId, deviceId: actor.deviceId }, "UPDATE");
}

export async function saveLocalRevision(
  actor: EducationActor,
  input: { id: string; sessionId: string; studentId: string; circleId: string; range: z.input<typeof quranRangeSchema>; grade?: string },
): Promise<void> {
  assertCanAccessResource(actor.session, { circleId: input.circleId, studentId: input.studentId }, "update");
  const range = quranRangeSchema.parse(input.range);
  await upsertLocalEntity("revision", {
    id: input.id,
    payload: { sessionId: input.sessionId, studentId: input.studentId, range, grade: input.grade ?? null },
  }, { userId: actor.session.userId, deviceId: actor.deviceId }, "UPDATE");
}
