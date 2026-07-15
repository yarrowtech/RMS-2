import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

const API_BASE = APP_API_URL;

export default function VendorRouteGuard({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("vendor_token") || "";
    if (!token) {
      setStatus("denied");
      return undefined;
    }

    fetch(`${API_BASE}/api/vendors/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(response => {
        if (!response.ok) throw new Error("Invalid vendor session");
        if (!cancelled) setStatus("allowed");
      })
      .catch(() => {
        localStorage.removeItem("vendor_token");
        if (!cancelled) setStatus("denied");
      });

    return () => { cancelled = true; };
  }, [location.pathname]);

  if (status === "checking") {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Verifying vendor session?</div>;
  }
  if (status === "denied") return <Navigate to="/merchandiser-seller/login" replace />;
  return children;
}
