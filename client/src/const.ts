export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// صفحة الدخول الموحدة لترتيل (بريد وكلمة مرور).
export const LOGIN_PATH = "/login";
export const startLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === LOGIN_PATH) return;
  window.location.href = LOGIN_PATH;
};
