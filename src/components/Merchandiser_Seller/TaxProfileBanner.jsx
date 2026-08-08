import React, { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

function getVendorToken() {
  return localStorage.getItem("vendor_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

/**
 * Small contextual reminder shown only where PAN/GST actually matters
 * (invoices, finance) — not spread across the whole portal. Renders
 * nothing while loading, on fetch failure, or once both fields are set.
 */
export default function TaxProfileBanner({ onNavigate, context = "these records" }) {
  const [complete, setComplete] = useState(null); // null = unknown/loading

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/vendors/me`, { headers: { Authorization: `Bearer ${getVendorToken()}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => { if (!cancelled) setComplete(me ? Boolean(me.pan && me.gstin) : null); })
      .catch(() => { if (!cancelled) setComplete(null); });
    return () => { cancelled = true; };
  }, []);

  if (complete !== false) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs font-semibold text-amber-800">Add your PAN &amp; GST so {context} show correct tax details.</p>
      </div>
      <button
        type="button"
        onClick={() => onNavigate?.("settings")}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
      >
        Complete now
      </button>
    </div>
  );
}
