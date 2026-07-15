const defaultApiUrl = import.meta.env.DEV
  ? "http://localhost:8000"
  : "https://rms-2-458u.onrender.com";

const configuredApiUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  defaultApiUrl;

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "");

export const apiUrl = (path = "") => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

export const FRONTEND_BASE_URL = (
  import.meta.env.VITE_FRONTEND_URL || window.location.origin
).replace(/\/+$/, "");
