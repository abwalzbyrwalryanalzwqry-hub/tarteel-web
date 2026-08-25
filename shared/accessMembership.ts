export type AccessMembershipState = {
  status?: string | null;
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

/** يحدد إن كان الحساب مهيأً للدخول إلى أي مركز دون الاعتماد على دور الواجهة. */
export function hasActiveAccessMembership(memberships: readonly AccessMembershipState[] | null | undefined, now = Date.now()) {
  return Boolean(memberships?.some((membership) => {
    if (membership.status !== "active" || membership.revokedAt) return false;
    if (!membership.expiresAt) return true;
    const expiresAt = new Date(membership.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  }));
}
