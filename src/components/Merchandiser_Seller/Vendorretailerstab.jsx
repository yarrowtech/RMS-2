import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState, useEffect, useCallback } from "react";
import { Building2, CheckCircle2, Clock, XCircle, RefreshCw, Mail, Link2, User } from "lucide-react";

/**
 * VendorRetailersTab.jsx
 * ========================
 * Standalone component — NOT wired into any navigation shell yet, because
 * I don't have your vendor dashboard's shell/container file (the one with
 * the tab list a logged-in vendor sees). This component is self-contained
 * and ready to drop in once you can resend that file.
 *
 * HOW TO WIRE IT IN (once you send the shell file):
 *   1. import VendorRetailersTab from "./VendorRetailersTab";
 *   2. Add a nav entry, e.g. { id: "retailers", label: "Retailers", icon: Building2 }
 *   3. Render <VendorRetailersTab /> when that tab is active.
 * No other changes needed — it manages its own data fetching and state.
 *
 * DATA SOURCE: GET /api/vendors/my-tenant (vendor_routes.py) — returns
 * EVERY retailer relationship for the logged-in vendor identity, each
 * with its own independent status/vendor_code/source, per the identity/
 * tenant-link schema split. A vendor supplying both Citimart and Zudio
 * sees two cards here; a vendor with one relationship sees one.
 */

const API_BASE = APP_API_URL;

// Same fallback chain used in VendorPurchaseOrders.jsx — vendor tokens
// have been stored under a few different keys across this app's history.
function getVendorToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

const STATUS_STYLES = {
  Approved:     { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2, dot: "bg-emerald-500" },
  Pending:      { badge: "bg-amber-100 text-amber-700 border-amber-200",       icon: Clock,         dot: "bg-amber-500"  },
  Rejected:     { badge: "bg-rose-100 text-rose-700 border-rose-200",          icon: XCircle,       dot: "bg-rose-500"   },
  Deactivated:  { badge: "bg-slate-100 text-slate-500 border-slate-200",       icon: XCircle,       dot: "bg-slate-400"  },
};

const SOURCE_LABELS = {
  invite_link:              "Invited by this retailer",
  self_registration:        "You registered directly",
  walkin_po_self_register:  "Registered via a Purchase Order link",
};

function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

function RetailerCard({ retailer }) {
  const statusInfo = STATUS_STYLES[retailer.status] || STATUS_STYLES.Pending;
  const StatusIcon = statusInfo.icon;
  const approvedDate = formatDate(retailer.approved_at);
  const createdDate  = formatDate(retailer.created_at);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
            {(retailer.company_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{retailer.company_name}</p>
            <p className="text-xs text-slate-400 font-mono truncate">{retailer.tenant_id}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badge}`}>
          <StatusIcon className="w-3 h-3" />
          {retailer.status}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        {retailer.vendor_code && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Vendor Code</span>
            <span className="font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded">{retailer.vendor_code}</span>
          </div>
        )}

        {(retailer.division || retailer.section || retailer.department) && (
          <div className="flex flex-wrap gap-1.5">
            {[retailer.division, retailer.section, retailer.department].filter(Boolean).map((label, i) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold">
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          {SOURCE_LABELS[retailer.source] || retailer.source || "Unknown source"}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
          <span>Registered {createdDate || "—"}</span>
          {retailer.status === "Approved" && approvedDate && (
            <span className="text-emerald-600 font-semibold">Approved {approvedDate}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorRetailersTab() {
  const [retailers, setRetailers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetchRetailers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getVendorToken();
      if (!token) {
        setError("You're not logged in. Please log in again.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/vendors/my-tenant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to load your retailers.");
      }
      const json = await res.json();
      setRetailers(json.data || []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRetailers(); }, [fetchRetailers]);

  const approvedCount = retailers.filter(r => r.status === "Approved").length;
  const pendingCount  = retailers.filter(r => r.status === "Pending").length;

  return (
    <div className="min-h-full bg-[#F6F7FB] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">My Retailers</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? "Loading…" : `${retailers.length} retailer relationship${retailers.length !== 1 ? "s" : ""} · ${approvedCount} active`}
              </p>
            </div>
          </div>
          <button onClick={fetchRetailers} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats strip */}
        {!loading && retailers.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Total",    retailers.length,  "bg-slate-50 border-slate-200 text-slate-900"],
              ["Approved", approvedCount,      "bg-emerald-50 border-emerald-200 text-emerald-800"],
              ["Pending",  pendingCount,        "bg-amber-50 border-amber-200 text-amber-800"],
            ].map(([label, value, cls]) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${cls}`}>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-semibold opacity-70 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading your retailers…</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-rose-200">
            <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button onClick={fetchRetailers}
              className="mt-4 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-bold hover:bg-rose-100 transition">
              Try Again
            </button>
          </div>
        ) : retailers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No retailer relationships yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Once a retailer invites you or approves your registration, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {retailers.map((r) => (
              <RetailerCard key={r.tenant_id} retailer={r} />
            ))}
          </div>
        )}

        {/* Info footer */}
        <div className="flex items-start gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700">
          <Mail className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your login works across every retailer relationship shown here. Purchase orders and stock
            requests from all of them appear together in your Purchase Orders tab.
          </span>
        </div>
      </div>
    </div>
  );
}