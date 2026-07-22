import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config/api.js";

const SUPERADMIN_LOGIN_PATH = "/signup";

function clearSuperAdminSession() {
  localStorage.removeItem("superadmin_token");
  localStorage.removeItem("auth_session");
}

export default function SuperAdminRouteGuard({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const redirectLoggedOutSession = () => {
      if (!localStorage.getItem("superadmin_token")) {
        window.location.replace(SUPERADMIN_LOGIN_PATH);
      }
    };

    window.addEventListener("pageshow", redirectLoggedOutSession);
    return () => window.removeEventListener("pageshow", redirectLoggedOutSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("superadmin_token") || "";

    if (!token) {
      setStatus("denied");
      return undefined;
    }

    fetch(`${API_BASE_URL}/auth/superadmin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Invalid Super Admin session");
        const profile = await response.json();
        if (profile.role !== "super_admin") throw new Error("Unauthorized role");
        if (!cancelled) setStatus("allowed");
      })
      .catch(() => {
        clearSuperAdminSession();
        if (!cancelled) setStatus("denied");
      });

    return () => { cancelled = true; };
  }, [location.pathname]);

  if (status === "checking") {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Verifying Super Admin access...</div>;
  }

  if (status === "denied") return <Navigate to={SUPERADMIN_LOGIN_PATH} replace />;
  return children;
}