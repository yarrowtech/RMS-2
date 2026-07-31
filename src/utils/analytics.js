// Lightweight product-usage tracking: page views, feature usage, session
// duration, device type. Fires to POST /api/analytics/event and must NEVER
// throw into the caller — a tracking failure should be invisible to the
// person using the app.
import { API_BASE_URL } from "../config/api.js";

const SESSION_ID_KEY = "rms_analytics_session_id";
const SESSION_START_KEY = "rms_analytics_session_start";
const SESSION_ENDED_KEY = "rms_analytics_session_ended";

function getAuthToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("superadmin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function detectDeviceType() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function send(eventFields, { beacon = false } = {}) {
  const body = JSON.stringify({
    session_id: getSessionId(),
    device_type: detectDeviceType(),
    ...eventFields,
  });

  try {
    if (beacon && navigator.sendBeacon) {
      // sendBeacon can't carry an Authorization header — fine here, the
      // session_start event already captured whatever identity was known.
      navigator.sendBeacon(`${API_BASE_URL}/api/analytics/event`, new Blob([body], { type: "application/json" }));
      return;
    }
    const token = getAuthToken();
    fetch(`${API_BASE_URL}/api/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never break the page that triggered it.
  }
}

export function trackPageView(path) {
  send({ event_type: "page_view", path });
}

export function trackFeature(feature, meta) {
  send({ event_type: "feature_used", feature, meta });
}

function startSession() {
  if (sessionStorage.getItem(SESSION_START_KEY)) return; // already started for this browser tab session
  sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
  sessionStorage.removeItem(SESSION_ENDED_KEY);
  send({ event_type: "session_start" });
}

function endSessionOnce() {
  if (sessionStorage.getItem(SESSION_ENDED_KEY)) return;
  sessionStorage.setItem(SESSION_ENDED_KEY, "1");
  const startedAt = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
  const duration_ms = Math.max(0, Date.now() - startedAt);
  send({ event_type: "session_end", duration_ms }, { beacon: true });
}

let wired = false;

// Call once near the app root. Starts the session immediately and arranges
// to close it out (with a duration) the first time the tab is hidden or
// unloaded — the closest thing the browser gives us to "the user left".
export function initSessionTracking() {
  if (wired) return;
  wired = true;
  startSession();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") endSessionOnce();
  });
  window.addEventListener("pagehide", endSessionOnce);
}
