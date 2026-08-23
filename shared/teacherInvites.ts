export type TeacherInviteAvailability = "active" | "used" | "revoked" | "expired";

export function getTeacherInviteAvailability(invite: { isRevoked: boolean; usedAt: Date | null; expiresAt: Date | null }, now = new Date()): TeacherInviteAvailability {
  if (invite.isRevoked) return "revoked";
  if (invite.usedAt) return "used";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}
