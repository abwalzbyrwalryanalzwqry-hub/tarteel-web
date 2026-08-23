export const PENDING_TEACHER_INVITE_KEY = "tarteel:pending-teacher-invite";

export function savePendingTeacherInvite(code: string): void {
  window.localStorage.setItem(PENDING_TEACHER_INVITE_KEY, code.trim().toUpperCase());
}

export function readPendingTeacherInvite(): string | null {
  return window.localStorage.getItem(PENDING_TEACHER_INVITE_KEY);
}

export function clearPendingTeacherInvite(): void {
  window.localStorage.removeItem(PENDING_TEACHER_INVITE_KEY);
}
