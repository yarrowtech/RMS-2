import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
export const CASHIER_API_BASE = APP_API_URL;

export function getCashierToken() {
  return (
    localStorage.getItem("admin_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

export function cashierFetch(url, options = {}) {
  const token = getCashierToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}