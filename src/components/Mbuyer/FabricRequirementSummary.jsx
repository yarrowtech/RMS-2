import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";

// Same fabric, requested across several draft Fabric Themes, collapsed into
// one line: total demand, what's already in stock (leftover called out
// separately), and the net still to buy — plus which vendors are already
// picked for it across those themes, so a buyer can decide whether to
// consolidate into one PO with one vendor or keep it split.
// Backend: GET /api/job-work/fabric-requirement-summary (job_work_routes.py).

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path) {
  const response = await fetch(`${API_BASE_URL}/api/job-work${path}`, { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load fabric requirement summary.");
  return data;
}

function fabricLabel(row) {
  return [row.fabric_type, row.gsm && `${row.gsm} GSM`, row.width, row.color].filter(Boolean).join(" · ") || "Unnamed fabric";
}

export default function FabricRequirementSummary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/fabric-requirement-summary");
      setRows(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">Fabric Requirement Summary</p>
          <p className="text-xs text-slate-500 mt-0.5">Same fabric pooled across all your open (draft) themes — total needed, what's in stock, and the real net to buy.</p>
        </div>
        <button type="button" onClick={reload} disabled={loading} className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="mx-5 mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-slate-600">
        <p className="font-black text-indigo-900 mb-1">How this works</p>
        <p>Whenever the same fabric (same type, GSM, width and colour) appears in more than one draft theme, it's grouped into one row below instead of showing separately per theme.</p>
        <ul className="mt-2 space-y-1">
          <li><b className="text-slate-800">Required</b> — the total quantity added across every draft theme's line for this fabric, added together.</li>
          <li><b className="text-slate-800">In stock</b> — what you already have on hand right now (leftover remnants from job work are shown in brackets — they're already counted in this total, not extra).</li>
          <li><b className="text-slate-800">Net to buy</b> — Required minus In stock. This is what's actually left to purchase; shows "Covered" once stock alone meets the requirement.</li>
        </ul>
        <p className="mt-2">Click a row to see exactly which theme and vendor each part of the requirement came from. If a fabric is split across more than one vendor and still needs buying, that's flagged so you can decide whether to consolidate it into one PO.</p>
        <p className="mt-2 text-slate-400">Only draft themes count here — once a theme is finalized into a PO, its fabric is already ordered and drops out of this list. Style BOM material plans aren't included since they don't carry structured GSM/width/colour to match against.</p>
      </div>

      {error && <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-black text-slate-700">No open fabric requirements</p>
          <p className="mt-1 text-xs text-slate-500">Add fabric to a draft theme to see the pooled requirement here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const key = fabricLabel(row);
            const isOpen = expanded === key;
            const needsBuying = row.net_to_buy > 0;
            return (
              <div key={key}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : key)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{fabricLabel(row)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.theme_count} theme{row.theme_count === 1 ? "" : "s"} · {row.vendor_count} vendor{row.vendor_count === 1 ? "" : "s"}: {row.vendors.join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-right">
                    <div title="Total quantity added across every draft theme's line for this fabric">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Required</p>
                      <p className="font-bold text-slate-800">{row.total_required} {row.unit}</p>
                    </div>
                    <div title="What you already have on hand — leftover job-work remnants are included, shown separately in brackets">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">In stock</p>
                      <p className="font-bold text-slate-800">{row.available_stock} {row.unit}{row.leftover_stock > 0 ? <span className="ml-1 text-emerald-600">({row.leftover_stock} leftover)</span> : null}</p>
                    </div>
                    <div title="Required minus In stock — what's actually left to purchase">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Net to buy</p>
                      <p className={`font-black ${needsBuying ? "text-amber-700" : "text-emerald-600"}`}>{needsBuying ? `${row.net_to_buy} ${row.unit}` : "Covered"}</p>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="bg-slate-50/70 px-5 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-2">Where this demand comes from</p>
                    <div className="space-y-1.5">
                      {row.contributions.map((c) => (
                        <div key={`${c.theme_id}-${c.line_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                          <span className="font-bold text-slate-800">{c.theme_name}</span>
                          <span className="text-slate-500">{c.vendor_name}</span>
                          <span className="font-bold text-slate-700">{c.quantity} {c.unit}{c.rate ? ` · ₹${c.rate}` : ""}</span>
                        </div>
                      ))}
                    </div>
                    {row.vendor_count > 1 && needsBuying && (
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        This fabric is already split across {row.vendor_count} vendors in your draft themes. Consolidating the net {row.net_to_buy} {row.unit} into one vendor may get better pricing/MOQ — check rates before finalizing each theme.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
