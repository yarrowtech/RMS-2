import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearAuthData } from "../utils/authRedirect";

const API_BASE = APP_API_URL;

const DEPARTMENT_PATHS = {
  "HR": "/dashboard/hr",
  "Cashier": "/dashboard/cashier",
  "Finance": "/dashboard/finance",
  "IT": "/dashboard/it",
  "Logistics": "/dashboard/logistics",
  "Design & Pattern": "/dashboard/design",
  "Inventory": "/dashboard/inventory",
  "Stock Planning & Forecasting": "/dashboard/stock-planning",
  "Third Party": "/dashboard/third-party",
  "Production & Job Work": "/dashboard/production",
  "Merchandiser Buyer": "/dashboard/merchandiser-buyer",
  "Store Owner": "/dashboard/store-owner",
};

function getToken() {
  return localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

export default function DepartmentRouteGuard({ department, children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, allowed: false, redirect: "/admin/login" });

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
          if (assigned && (selected || departments.length === 1)) {
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
        if (!cancelled) setState({ loading: false, allowed: false, redirect: "/admin/login" });
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [JSON.stringify(department), location.pathname]);

  if (state.loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Verifying access…</div>;
  }
  if (!state.allowed) return <Navigate to={state.redirect} replace />;
  return children;
}
