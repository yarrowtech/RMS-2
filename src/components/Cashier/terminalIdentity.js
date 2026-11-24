// Per-machine POS terminal identity — deliberately independent of the
// cashier login. HQ gives a store one shared login used across several
// physical POS machines there, so the login itself can never tell two
// terminals apart. This lives in THIS device's own localStorage instead,
// set once per machine and carried silently on every bill/shift from then
// on, regardless of which shared credential is used to sign in on it.

const TERMINAL_ID_KEY = "rms_pos_terminal_id_v1";
const TERMINAL_NAME_KEY = "rms_pos_terminal_name_v1";

function generateTerminalId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `term_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getTerminalId() {
  try {
    let id = localStorage.getItem(TERMINAL_ID_KEY);
    if (!id) {
      id = generateTerminalId();
      localStorage.setItem(TERMINAL_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable — fall back to a per-session id so the rest of
    // the app still has something consistent to send, even though it
    // won't survive a reload.
    if (!window.__rmsFallbackTerminalId) window.__rmsFallbackTerminalId = generateTerminalId();
    return window.__rmsFallbackTerminalId;
  }
}

export function getTerminalName() {
  try {
    return localStorage.getItem(TERMINAL_NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function hasTerminalName() {
  return Boolean(getTerminalName().trim());
}

export function setTerminalName(name) {
  const clean = String(name || "").trim().slice(0, 40);
  try {
    localStorage.setItem(TERMINAL_NAME_KEY, clean);
  } catch {
    // If storage is blocked there's nowhere durable to put this — the
    // one-time prompt will simply reappear next load, which is safe.
  }
  return clean;
}

// ── Tab-access role, assigned per-terminal by a store/HQ admin ──────────
// Cached in localStorage so the sidebar can render immediately on load
// without waiting on a network round trip; refreshed from the server
// (the source of truth) in the background on every POS mount.
const TERMINAL_ROLE_KEY = "rms_pos_terminal_role_v1";
export const DEFAULT_TERMINAL_ROLE = "cashier";

export function getCachedTerminalRole() {
  try {
    return localStorage.getItem(TERMINAL_ROLE_KEY) || DEFAULT_TERMINAL_ROLE;
  } catch {
    return DEFAULT_TERMINAL_ROLE;
  }
}

function cacheTerminalRole(role) {
  try {
    localStorage.setItem(TERMINAL_ROLE_KEY, role || DEFAULT_TERMINAL_ROLE);
  } catch {
    // Non-fatal — just means the next load re-fetches before rendering tabs.
  }
}

function authToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

// Registers/renames this device on the server so an admin can see and
// assign it a role; returns the role currently on record (unchanged if
// this terminal already exists).
export async function registerTerminal(apiBase) {
  try {
    const res = await fetch(`${apiBase}/cashier/terminals/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
      body: JSON.stringify({ terminal_id: getTerminalId(), terminal_name: getTerminalName() }),
    });
    if (!res.ok) return getCachedTerminalRole();
    const json = await res.json();
    const role = json?.role || DEFAULT_TERMINAL_ROLE;
    cacheTerminalRole(role);
    return role;
  } catch {
    return getCachedTerminalRole();
  }
}

export async function fetchTerminalRole(apiBase) {
  try {
    const res = await fetch(
      `${apiBase}/cashier/terminals/role?terminal_id=${encodeURIComponent(getTerminalId())}`,
      { headers: { Authorization: `Bearer ${authToken()}` } }
    );
    if (!res.ok) return getCachedTerminalRole();
    const json = await res.json();
    const role = json?.role || DEFAULT_TERMINAL_ROLE;
    cacheTerminalRole(role);
    return role;
  } catch {
    return getCachedTerminalRole();
  }
}
