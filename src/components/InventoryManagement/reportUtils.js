import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

export const API = APP_API_URL;

// Same fallback order used across the rest of the authenticated app.
export function getAdminToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

export async function fetchReport(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed (${res.status}).`);
  return body;
}

// Validated default categorical order (see dataviz skill) — fixed order,
// never cycled/reassigned per filter change.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
export const INK = "#0b0b0b";
export const INK2 = "#52514e";
export const MUTED = "#898781";
export const GRID = "#e1e0d9";

export function fmtINR(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
export function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN");
}
