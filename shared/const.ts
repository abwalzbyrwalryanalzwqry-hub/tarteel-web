export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/** مدة الجلسة: 30 يوماً، وتتجدد تلقائياً عند الاستخدام بعد مرور نصفها. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const SESSION_RENEW_AFTER_MS = SESSION_TTL_MS / 2;
/** ترويسة الاستجابة التي تحمل رمز الجلسة المجدَّد لعملاء Bearer. */
export const SESSION_RENEWAL_HEADER = "X-Session-Token";
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

