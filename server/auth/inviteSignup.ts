/**
 * التسجيل برمز دعوة: حين يكون التسجيل العام مغلقاً (ALLOW_SIGNUP=false) يستطيع الشخص
 * إنشاء حساب فقط إن كان معه رمز دعوة معلم (TRTL-XXXXXXXX) أو كود دخول (TRT-…) صالح من المركز.
 *
 * التسلسل: نفحص الرمز دون استهلاكه → ننشئ الحساب → نسترد الرمز بحساب المستخدم الجديد.
 * إن فشل الاسترداد (سباق مع شخص آخر مثلاً) نلغي الحساب الجديد حتى لا يبقى حساب بلا دعوة.
 */
import { and, eq, isNull } from "drizzle-orm";
import { accessCodes, localCredentials, teacherInvites, users } from "../../drizzle/schema";
import { getTeacherInviteAvailability } from "../../shared/teacherInvites";
import { hashAccessCode, normalizeAccessCode } from "../accessCodeSecurity";
import { redeemAccessCodeSecure } from "../data/access-control";
import { getDb } from "../data/connection";
import { redeemTeacherInvite } from "../data/teacher-invites";

export type SignupInvite =
  | { kind: "teacher_invite"; code: string }
  | { kind: "access_code"; code: string; codeHash: string };

const TEACHER_INVITE_PATTERN = /^TRTL-[A-F0-9]{8}$/;

/** يحدد نوع الرمز من صيغته، أو null إن لم يكن رمزاً مقبولاً. */
export function classifyInviteCode(raw: string | undefined | null): SignupInvite | null {
  const code = normalizeAccessCode(raw ?? "");
  if (!code) return null;
  if (TEACHER_INVITE_PATTERN.test(code)) return { kind: "teacher_invite", code };
  if (code.length >= 8 && code.length <= 128 && /^[A-Z0-9-]+$/.test(code)) return { kind: "access_code", code, codeHash: hashAccessCode(code) };
  return null;
}

/** رسالة واحدة لكل أسباب الرفض قبل إنشاء الحساب، حتى لا يكشف التسجيل أي الرموز موجودة. */
export const INVALID_INVITE_MESSAGE = "رمز الدعوة أو كود الدخول غير صالح أو منتهٍ";

/** يتحقق أن الرمز صالح الآن دون أن يستهلكه. */
export async function isInviteUsable(invite: SignupInvite, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  if (invite.kind === "teacher_invite") {
    const [row] = await db.select().from(teacherInvites).where(eq(teacherInvites.code, invite.code)).limit(1);
    return Boolean(row) && getTeacherInviteAvailability(row, now) === "active";
  }
  const [row] = await db.select().from(accessCodes).where(eq(accessCodes.codeHash, invite.codeHash)).limit(1);
  if (!row || row.status !== "active") return false;
  if (row.lockedUntil && row.lockedUntil > now) return false;
  if (row.expiresAt && row.expiresAt <= now) return false;
  return row.usedCount < row.maxUses;
}

/** يسترد الرمز لحساب المستخدم الجديد، ويعيد الدور الممنوح. */
export async function redeemSignupInvite(invite: SignupInvite, userId: number, request: { ipAddress?: string; userAgent?: string }) {
  if (invite.kind === "teacher_invite") {
    const result = await redeemTeacherInvite(invite.code, userId);
    return { role: result.role as string, centerId: result.centerId as number | undefined };
  }
  const result = await redeemAccessCodeSecure({ codeHash: invite.codeHash, userId, ipAddress: request.ipAddress, userAgent: request.userAgent });
  return { role: result.role as string, centerId: result.centerId as number | undefined };
}

/** يلغي حساباً أُنشئ للتو ثم فشل ربطه بالدعوة: يحرر البريد ويمنع الدخول به. */
export async function discardNewAccount(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(localCredentials).where(eq(localCredentials.userId, userId));
  await db.update(users).set({ isActive: false, accountStatus: "disabled", deletedAt: new Date() }).where(and(eq(users.id, userId), isNull(users.deletedAt)));
}
