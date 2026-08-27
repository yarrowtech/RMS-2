import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "../../config/api.js";
import { CreateFabricPOModal } from "../shared/FabricBuyingCart.jsx";
import FabricThemesSection from "./FabricThemes.jsx";
import { downloadFabricSheetCsv, downloadFabricSheetExcel, downloadFabricSheetPdf } from "../../utils/fabricSheetExport.js";

function authHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/job-work${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to complete this fabric purchasing action.");
  return data;
}

async function requestPO(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/purchaseorders${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Unable to load purchase orders.");
  return data;
}

const statusTone = {
  Pending: "bg-slate-100 text-slate-700",
  SentToVendor: "bg-amber-50 text-amber-700",
  VendorSubmitted: "bg-indigo-50 text-indigo-700",
  Approved: "bg-emerald-50 text-emerald-700",
};

function DownloadModal({ po, onClose }) {
  const [busy, setBusy] = useState("");
  const meta = {
    purchase_order_no: po.orderNo, vendor_name: po.vendorName, order_date: po.orderDate, sheet: po.fabric_po_sheet || [],
    expected_delivery_date: po.expectedDeliveryDate, payment_terms: po.paymentTerms,
    vendor_gstin: po.vendorGstin, vendor_mobile: po.vendorMobile, vendor_address: po.vendorAddress,
    company_name: po.ownerSite, company_gstin: po.ownerGstin, company_address: po.ownerAddress,
    subtotal_amount: po.basicValue, tax_amount: po.taxAmount, net_amount: po.netAmount,
  };
  const options = [
    { label: "PDF", hint: "Best for sharing or printing — includes fabric photos", run: () => downloadFabricSheetPdf(meta) },
    { label: "Excel (.xlsx)", hint: "Best for editing rates before sending", run: () => downloadFabricSheetExcel(meta) },
    { label: "CSV", hint: "Best for importing elsewhere", run: () => downloadFabricSheetCsv(meta) },
  ];
  const runOption = async (option) => { setBusy(option.label); try { await option.run(); } finally { setBusy(""); } };
  // Portalled to document.body — this page's shell wraps content in a
  // backdrop-blur/overflow-hidden container, which traps a plain `fixed`
  // overlay inside the content area instead of covering the real viewport.
  return createPortal(
    <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4" style={{ background: "linear-gradient(135deg,#0891b2,#0e7490)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-cyan-200 uppercase tracking-widest mb-1">Download Fabric PO Sheet</p>
              <p className="text-xl font-black text-white">{po.orderNo}</p>
              <p className="text-xs text-cyan-100 mt-1">{po.vendorName} · {po.orderDate}</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition text-xl font-bold">×</button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {options.map((option) => (
            <button key={option.label} type="button" disabled={Boolean(busy)} onClick={() => runOption(option)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40 disabled:opacity-60">
              <p className="font-black text-slate-900">{busy === option.label ? "Preparing…" : option.label}</p>
              <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function FabricPurchasing({ onNavigate = () => {} }) {
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadPo, setDownloadPo] = useState(null);

  const showNotice = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 5000); };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [vendorData, poData] = await Promise.all([
        request("/vendors?kind=fabric_supplier"),
        requestPO("/"),
      ]);
      setVendors(vendorData.data || []);
      const all = Array.isArray(poData) ? poData : [];
      setOrders(all.filter((o) => o.orderType === "Fabric / Raw Material").reverse());
    } catch (err) {
      setError(err.message || "Could not load fabric purchasing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createFabricPO = async (_plan, payload) => {
    setSaving(true);
    try {
      const result = await request("/fabric-purchase-orders", { method: "POST", body: JSON.stringify(payload) });
      showNotice(result.share_link ? `${result.message} Walk-in share link generated.` : result.message);
      if (result.whatsapp_url) window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      setShowCart(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Fabric Purchasing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Raise a fabric/raw-material PO directly with a registered fabric supplier, without going through Production & Job Work.</p>
        </div>
        <button type="button" onClick={() => setShowCart(true)}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition">
          + Create Fabric PO
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-black text-slate-900">Recent fabric POs</p>
            <p className="text-xs text-slate-500 mt-0.5">Manage sending, editing or reviewing these fully from the Order Details tab.</p>
          </div>
          <button type="button" onClick={() => onNavigate("order-details")} className="text-xs font-bold text-violet-700 hover:underline">Open Order Details →</button>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-black text-slate-700">No fabric POs yet</p>
            <p className="mt-1 text-xs text-slate-500">Click "Create Fabric PO" to raise your first one.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.slice(0, 8).map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sky-700">{o.orderNo}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusTone[o.status] || "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{o.vendorName} · {o.orderDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-slate-900">₹{Number(o.netAmount || 0).toLocaleString("en-IN")}</p>
                  <button type="button" onClick={() => setDownloadPo(o)} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100">Download</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FabricThemesSection vendors={vendors} />

      {showCart && (
        <CreateFabricPOModal vendors={vendors} onClose={() => setShowCart(false)} onSubmit={createFabricPO} saving={saving} />
      )}
      {downloadPo && (
        <DownloadModal po={downloadPo} onClose={() => setDownloadPo(null)} />
      )}
    </div>
  );
}
