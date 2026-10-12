import { OAUTH_STATE_COOKIE, encodeOAuthState, isOAuthLoginAttemptLocked } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// صفحة الدخول الموحدة لترتيل (بريد وكلمة مرور، وزر Manus اختياري أثناء الانتقال).
export const LOGIN_PATH = "/login";
export const startLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === LOGIN_PATH) return;
  window.location.href = LOGIN_PATH;
};

// Start the Manus OAuth login (transition mode only). Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startManusLogin = () => {
  // Several unauthenticated queries can fail together on mobile. Keep the first
  // navigation authoritative so a second call cannot overwrite its nonce cookie.
  try {
    const startedAt = sessionStorage.getItem("tarteel:oauth-login-started-at");
    if (isOAuthLoginAttemptLocked(startedAt)) return;
    sessionStorage.setItem("tarteel:oauth-login-started-at", String(Date.now()));
  } catch {
    // Storage may be blocked; the nonce guard on the server still fails closed.
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};

export const clearPendingOAuthLoginAttempt = () => {
  try {
    sessionStorage.removeItem("tarteel:oauth-login-started-at");
  } catch {
    // Storage may be unavailable; a later attempt simply waits for the lock.
  }
};
