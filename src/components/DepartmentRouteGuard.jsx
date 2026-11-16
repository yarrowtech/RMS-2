import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearAuthData } from "../utils/authRedirect";

const API_BASE = APP_API_URL;

const DEPARTMENT_PATHS = {
  "HQ": "/admin",
  "HR": "/dashboard/hr",
  "Cashier": "/dashboard/cashier",
  "Finance": "/dashboard/finance",
  "IT": "/dashboard/it",
  "Logistics": "/dashboard/logistics",
  "Design & Pattern": "/dashboard/design",
  "Inventory": "/dashboard/inventory",
  "Forecast & Analytics": "/dashboard/forecast-analytics",
  "Third Party": "/dashboard/third-party",
  "Production & Job Work": "/dashboard/production",
  "Merchandiser Buyer": "/dashboard/merchandiser-buyer",
  "Marketing": "/dashboard/marketing",
  "Customer CRM": "/dashboard/customer-crm",
  "Store Owner": "/dashboard/store-owner",
  "Store Ops": "/citimart-store-ops",
  "Visual Merchandising": "/visual-merchandising",
};

function getToken() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

const LAST_AUTH_CHECK_KEY = "admin_last_auth_check_at";
// Bounds how long a device can keep working purely on a cached login once
// the server becomes unreachable — e.g. a lost/stolen device offline for
// days shouldn't stay usable indefinitely just because its token hasn't
// technically expired yet. A real shift-length window (not the token's own
// expiry) is what actually matters here.
const OFFLINE_FALLBACK_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Decodes a JWT's payload without verifying its signature — enough to read
 * its own `exp` claim locally, with no network. Returns null if it can't be
 * read, which the caller treats as "don't trust this token offline". */
function decodeJwtExpiryMs(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    return typeof data.exp === "number" ? data.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Only true when: the token itself (decoded locally) hasn't expired, AND
 * the server was successfully reached within the allowed offline window.
 * Both conditions matter — a technically-unexpired token from a device that
 * has been offline for a week is exactly the case this refuses. */
function canTrustCachedLoginOffline(token) {
  const exp = decodeJwtExpiryMs(token);
  if (!exp || exp <= Date.now()) return false;
  const lastCheck = Number(localStorage.getItem(LAST_AUTH_CHECK_KEY) || 0);
  if (!lastCheck) return false;
  return Date.now() - lastCheck <= OFFLINE_FALLBACK_MAX_AGE_MS;
}

export default function DepartmentRouteGuard({ department, children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, allowed: false, redirect: "/admin/login" });

  // A browser can restore a protected dashboard from its back-forward cache
  // after logout. Re-check local auth on pageshow so Back never reopens a
  // Store Owner or department workspace from an old visual snapshot.
  useEffect(() => {
    const redirectLoggedOutSession = () => {
      if (!getToken()) window.location.replace("/admin/login");
    };
    window.addEventListener("pageshow", redirectLoggedOutSession);
    return () => window.removeEventListener("pageshow", redirectLoggedOutSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setState({ loading: false, allowed: false, redirect: "/admin/login" });
      return undefined;
    }

    const verify = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          clearAuthData();
          if (!cancelled) setState({ loading: false, allowed: false, redirect: "/admin/login" });
          return;
        }

        const profile = await response.json();
        localStorage.setItem(LAST_AUTH_CHECK_KEY, String(Date.now()));
        const departments = Array.isArray(profile.managedDepartments)
          ? profile.managedDepartments.filter(Boolean)
          : profile.department ? [profile.department] : [];
        const activeDepartment = localStorage.getItem("admin_active_department") || "";
        const allowedDepartments = Array.isArray(department) ? department : [department];
        const assignedDepartment = departments.find(item => allowedDepartments.includes(item)) || "";
        const assigned = Boolean(assignedDepartment);
        const selected = allowedDepartments.includes(activeDepartment);

        localStorage.setItem("admin_login_data", JSON.stringify({
          ...(JSON.parse(localStorage.getItem("admin_login_data") || "{}")),
          name: profile.name || "",
          email: profile.email || "",
          departments,
          routes: Object.fromEntries(departments.map((item) => [item, DEPARTMENT_PATHS[item] || "/admin"])),
        }));

        if (!cancelled) {
          // "HQ" always skips department selection, same rule as the backend's
          // get_redirect_for_departments() and DepartmentSelector.jsx's own
          // HQ-skip branch — an admin with HQ + many other real departments
          // (e.g. the default for every tenant's primary admin) must not be
          // required to have "HQ" sitting in admin_active_department first,
          // or this guard and DepartmentSelector's own redirect bounce off
          // each other forever (selected stays false, length > 1 sends them
          // to the selector, the selector's HQ-skip sends them right back).
          if (departments.includes("HQ") && allowedDepartments.includes("HQ")) {
            localStorage.setItem("admin_active_department", "HQ");
            setState({ loading: false, allowed: true, redirect: "" });
          } else if (assigned && (selected || departments.length === 1)) {
            if (!selected) localStorage.setItem("admin_active_department", assignedDepartment);
            setState({ loading: false, allowed: true, redirect: "" });
          } else if (departments.length > 1) {
            setState({ loading: false, allowed: false, redirect: "/dashboard/select" });
          } else if (departments.length === 1) {
            const onlyDepartment = departments[0];
            localStorage.setItem("admin_active_department", onlyDepartment);
            setState({ loading: false, allowed: false, redirect: DEPARTMENT_PATHS[onlyDepartment] || "/admin" });
          } else {
            setState({ loading: false, allowed: false, redirect: "/admin/login" });
          }
        }
      } catch {
        // The server couldn't be reached at all (offline/outage) — distinct
        // from the response.ok branch above, which means the server WAS
        // reached and said the login is invalid. Only here is it safe to
        // fall back to the cached login instead of forcing a logout, and
        // only within the bounds canTrustCachedLoginOffline checks. This is
        // what lets a cashier already logged in before an outage keep using
        // offline billing without needing the tab to have stayed open.
        if (cancelled) return;
        // Scoped to Cashier only — it's the one department with an actual
        // offline-capable workflow (offline billing). Every other route
        // keeps today's behavior: a network failure here still forces a
        // real login, same as before this fallback existed.
        const allowedDepartmentsForOfflineCheck = Array.isArray(department) ? department : [department];
        if (!allowedDepartmentsForOfflineCheck.includes("Cashier") || !canTrustCachedLoginOffline(token)) {
          setState({ loading: false, allowed: false, redirect: "/admin/login" });
          return;
        }
        let cached = {};
        try { cached = JSON.parse(localStorage.getItem("admin_login_data") || "{}"); } catch { cached = {}; }
        const departments = Array.isArray(cached.departments) ? cached.departments.filter(Boolean) : [];
        const activeDepartment = localStorage.getItem("admin_active_department") || "";
        const allowedDepartments = Array.isArray(department) ? department : [department];
        const assignedDepartment = departments.find(item => allowedDepartments.includes(item)) || "";
        const assigned = Boolean(assignedDepartment);
        const selected = allowedDepartments.includes(activeDepartment);

        if (departments.includes("HQ") && allowedDepartments.includes("HQ")) {
          setState({ loading: false, allowed: true, redirect: "", offline: true });
        } else if (assigned && (selected || departments.length === 1)) {
          setState({ loading: false, allowed: true, redirect: "", offline: true });
        } else {
          // Ambiguous without the server (e.g. would need the selector) —
          // safer to require login/network here than to guess.
          setState({ loading: false, allowed: false, redirect: "/admin/login" });
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [JSON.stringify(department), location.pathname]);

  if (state.loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Verifying access…</div>;
  }
  if (!state.allowed) return <Navigate to={state.redirect} replace />;
  return (
    <>
      {state.offline && (
        <div className="fixed inset-x-0 top-0 z-[2000] bg-amber-500 px-4 py-1.5 text-center text-xs font-bold text-white shadow">
          Working offline — using your cached login. Reconnect when possible to confirm it's still valid.
        </div>
      )}
      {children}
    </>
  );
}
