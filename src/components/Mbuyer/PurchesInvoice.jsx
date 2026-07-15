import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useState, useEffect, useMemo } from "react";

/* ─── API base ─────────────────────────────────────────────────── */
const GRN_API = `${APP_API_URL}/grn`;
const PI_API  = `${APP_API_URL}/purchase-invoices`;

/* ─── Helpers ───────────────────────────────────────────────────── */
const n0     = (v) => { if (v === "" || v === null || v === undefined) return 0; const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clamp0 = (v) => Math.max(0, n0(v));
const money  = (v) => clamp0(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today  = () => new Date().toISOString().slice(0, 10);

/* Build a PI line from GRN item */
const PI_ITEM_FROM_GRN = (grnItem = {}) => ({
  barcode:      grnItem.barcode      || "",
  description:  grnItem.description  || "",
  grnQty:       grnItem.grnQty       || 0,
  invoicedQty:  grnItem.grnQty       || "",
  rate:         grnItem.rate         || 0,
  discountPct:  "",
  discountAmt:  0,
  taxablAmt:    0,
  cgstPct:      "",
  sgstPct:      "",
  igstPct:      "",
  cgstAmt:      0,
  sgstAmt:      0,
  igstAmt:      0,
  totalTax:     0,
  lineTotal:    0,
  hsn:          "",
  remarks:      "",
});

/* ─── Status badge ──────────────────────────────────────────────── */
const StatusBadge = ({ s }) => {
  const map = {
    Draft:         "bg-slate-100 text-slate-700 border-slate-200",
    Pending:       "bg-amber-50 text-amber-700 border-amber-200",
    Approved:      "bg-emerald-50 text-emerald-700 border-emerald-200",
    Paid:          "bg-sky-50 text-sky-700 border-sky-200",
    Cancelled:     "bg-rose-50 text-rose-700 border-rose-200",
    PartiallyPaid: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] font-bold border ${map[s] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {s || "—"}
    </span>
  );
};

/* ─── MAIN COMPONENT ────────────────────────────────────────────── */
export default function PurchaseInvoiceManager() {
  const [invoices,   setInvoices]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [openForm,   setOpenForm]   = useState(false);
  const [editingPI,  setEditingPI]  = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPI, setDeletingPI] = useState(null);
  const [viewPI,     setViewPI]     = useState(null);

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res  = await fetch(PI_API);
      if (!res.ok) throw new Error("Failed to load invoices");
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data.reverse() : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (pi) => {
    try {
      const isEdit = !!pi.id && invoices.some((i) => i.id === pi.id);
      const res = await fetch(isEdit ? `${PI_API}/${pi.id}` : PI_API, {
        method:  isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(pi),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchInvoices();
    } catch (err) {
      alert("Failed to save invoice: " + err.message);
    } finally {
      setOpenForm(false);
      setEditingPI(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPI?.id) return setDeleteOpen(false);
    try {
      const res = await fetch(`${PI_API}/${deletingPI.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await fetchInvoices();
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleteOpen(false);
      setDeletingPI(null);
    }
  };

  const approvePI = async (pi) => {
    if (!window.confirm(`Approve Purchase Invoice ${pi.invoiceNo}?`)) return;
    try {
      setLoading(true);
      const res  = await fetch(`${PI_API}/${pi.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Approval failed");
      alert(data.message || "Invoice Approved!");
      await fetchInvoices();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (pi) => {
    if (!window.confirm(`Mark Invoice ${pi.invoiceNo} as Paid?`)) return;
    try {
      setLoading(true);
      const res  = await fetch(`${PI_API}/${pi.id}/mark-paid`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      alert(data.message || "Invoice marked as Paid!");
      await fetchInvoices();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalDue     = invoices.filter((i) => i.status !== "Paid" && i.status !== "Cancelled").reduce((s, i) => s + n0(i.netAmount), 0);
  const totalPaid    = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + n0(i.netAmount), 0);
  const totalPending = invoices.filter((i) => i.status === "Pending" || i.status === "Draft").length;

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Purchase Invoice (PI)</h1>
          </div>
          <button
            onClick={() => { setEditingPI(null); setOpenForm(true); }}
            className="h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold border border-green-700"
            type="button"
          >
            + Generate Invoice
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total Invoices"   value={String(invoices.length)} />
          <Kpi label="Pending Approval" value={String(totalPending)} accent="amber" />
          <Kpi label="Outstanding (₹)"  value={money(totalDue)} accent="rose" />
          <Kpi label="Paid (₹)"         value={money(totalPaid)} accent="emerald" />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="w-full min-w-[1300px] text-xs">
            <thead className="bg-[#F2F4F8] text-slate-600">
              <tr className="border-b border-slate-200">
                <TH>Invoice No</TH>
                <TH>Invoice Date</TH>
                <TH>GRN No</TH>
                <TH>PO No</TH>
                <TH>Vendor Name</TH>
                <TH>Vendor Invoice No</TH>
                <TH>Due Date</TH>
                <TH>Status</TH>
                <TH className="text-right">Basic Amt</TH>
                <TH className="text-right">Tax Amt</TH>
                <TH className="text-right">Net Amount</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">Loading invoices…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">No invoices yet. Click <b>Generate Invoice</b> to create one.</td></tr>
              ) : invoices.map((pi) => {
                const isOverdue = pi.status !== "Paid" && pi.dueDate && pi.dueDate < today();
                return (
                  <tr key={pi.id} className={`hover:bg-slate-50 ${isOverdue ? "bg-rose-50/40" : ""}`}>
                    <TD className="font-semibold text-sky-700">{pi.invoiceNo || "-"}</TD>
                    <TD>{pi.invoiceDate || "-"}</TD>
                    <TD className="text-violet-700 font-semibold">{pi.grnNo || "-"}</TD>
                    <TD className="font-semibold">{pi.poNo || "-"}</TD>
                    <TD>{pi.vendorName || "-"}</TD>
                    <TD>{pi.vendorInvoiceNo || "-"}</TD>
                    <TD>
                      <span className={isOverdue ? "text-rose-600 font-bold" : ""}>
                        {pi.dueDate || "-"} {isOverdue && "⚠"}
                      </span>
                    </TD>
                    <TD><StatusBadge s={pi.status} /></TD>
                    <TD className="text-right tabular-nums">{money(pi.basicAmount)}</TD>
                    <TD className="text-right tabular-nums">{money(pi.totalTax)}</TD>
                    <TD className="text-right tabular-nums font-bold text-slate-900">{money(pi.netAmount)}</TD>
                    <TD className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => setViewPI(pi)} className="h-9 px-3 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 font-semibold" type="button">View</button>
                        <button onClick={() => { setEditingPI(pi); setOpenForm(true); }} disabled={pi.status === "Paid" || pi.status === "Approved"} className={`h-9 px-3 rounded-lg border font-semibold ${pi.status !== "Paid" && pi.status !== "Approved" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`} type="button">Edit</button>
                        <button onClick={() => approvePI(pi)} disabled={pi.status !== "Draft" && pi.status !== "Pending"} className={`h-9 px-3 rounded-lg border font-semibold ${(pi.status === "Draft" || pi.status === "Pending") ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`} type="button">Approve</button>
                        <button onClick={() => markPaid(pi)} disabled={pi.status !== "Approved"} className={`h-9 px-3 rounded-lg border font-semibold ${pi.status === "Approved" ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`} type="button">Mark Paid</button>
                        <button onClick={() => { setDeletingPI(pi); setDeleteOpen(true); }} disabled={pi.status === "Paid"} className="h-9 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 font-semibold" type="button">Delete</button>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <ModalShell onClose={() => { setOpenForm(false); setEditingPI(null); }}>
          <PIForm initialPI={editingPI} onClose={() => { setOpenForm(false); setEditingPI(null); }} onSave={handleSave} />
        </ModalShell>
      )}

      {viewPI && (
        <ModalShell onClose={() => setViewPI(null)}>
          <PIViewModal pi={viewPI} onClose={() => setViewPI(null)} />
        </ModalShell>
      )}

      {deleteOpen && (
        <ConfirmDeleteModal
          title="Delete Purchase Invoice?"
          message={<>Are you sure you want to delete invoice <b>{deletingPI?.invoiceNo || "this invoice"}</b>? This cannot be undone.</>}
          onClose={() => { setDeleteOpen(false); setDeletingPI(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

/* ─── PI FORM ───────────────────────────────────────────────────── */
function PIForm({ initialPI, onClose, onSave }) {
  const [grns,       setGrns]       = useState([]);
  const [grnLoading, setGrnLoading] = useState(false);

  const [header, setHeader] = useState({
    invoiceNo:          initialPI?.invoiceNo          || "",
    invoiceDate:        initialPI?.invoiceDate        || today(),
    grnNo:              initialPI?.grnNo              || "",
    poNo:               initialPI?.poNo               || "",
    vendorName:         initialPI?.vendorName         || "",
    vendorInvoiceNo:    initialPI?.vendorInvoiceNo    || "",
    vendorInvoiceDate:  initialPI?.vendorInvoiceDate  || "",
    paymentTerms:       initialPI?.paymentTerms       || "",
    dueDate:            initialPI?.dueDate            || "",
    currency:           initialPI?.currency           || "INR",
    exchangeRate:       initialPI?.exchangeRate       || "1",
    buyerGSTIN:         initialPI?.buyerGSTIN         || "",
    vendorGSTIN:        initialPI?.vendorGSTIN        || "",
    supplyType:         initialPI?.supplyType         || "Intra-State",
    remarks:            initialPI?.remarks            || "",
    status:             initialPI?.status             || "Draft",
  });

  const [items, setItems] = useState(
    Array.isArray(initialPI?.items) && initialPI.items.length
      ? initialPI.items
      : [PI_ITEM_FROM_GRN()]
  );

  const [extraCharges, setExtraCharges] = useState({
    freight:         initialPI?.extraCharges?.freight    || "",
    packagingCharge: initialPI?.extraCharges?.packaging  || "",
    otherCharge:     initialPI?.extraCharges?.other      || "",
    roundOff:        initialPI?.extraCharges?.roundOff   || "",
  });

  const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

  /* Load posted GRNs */
  useEffect(() => {
    (async () => {
      try {
        setGrnLoading(true);
        const res  = await fetch(`${GRN_API}`);
        const data = await res.json();
        setGrns(Array.isArray(data) ? data.filter((g) => g.status === "Posted" || g.status === "Approved") : []);
      } catch (e) { console.error(e); }
      finally { setGrnLoading(false); }
    })();
  }, []);

  /* When GRN selected → prefill */
  const handleGRNSelect = (grnNo) => {
    setH("grnNo", grnNo);
    const grn = grns.find((g) => g.grnNo === grnNo);
    if (!grn) return;
    setH("poNo",       grn.poNo       || "");
    setH("vendorName", grn.vendorName || "");
    setH("currency",   grn.currency   || "INR");
    if (Array.isArray(grn.items) && grn.items.length) {
      setItems(grn.items.map(PI_ITEM_FROM_GRN));
    }
  };

  /* Recompute line totals whenever any item field changes */
  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const copy = [...prev];
      const row  = { ...copy[idx], [k]: v };

      const qty      = clamp0(row.invoicedQty);
      const rate     = clamp0(row.rate);
      const discPct  = clamp0(row.discountPct);
      const gross    = qty * rate;
      const discAmt  = (gross * discPct) / 100;
      const taxable  = gross - discAmt;

      const cgst     = (taxable * clamp0(row.cgstPct)) / 100;
      const sgst     = (taxable * clamp0(row.sgstPct)) / 100;
      const igst     = (taxable * clamp0(row.igstPct)) / 100;
      const totalTax = cgst + sgst + igst;

      row.discountAmt = discAmt;
      row.taxablAmt   = taxable;
      row.cgstAmt     = cgst;
      row.sgstAmt     = sgst;
      row.igstAmt     = igst;
      row.totalTax    = totalTax;
      row.lineTotal   = taxable + totalTax;

      copy[idx] = row;
      return copy;
    });
  };

  const totals = useMemo(() => {
    const basicAmount = items.reduce((s, i) => s + clamp0(i.taxablAmt), 0);
    const totalTax    = items.reduce((s, i) => s + clamp0(i.totalTax), 0);
    const cgst        = items.reduce((s, i) => s + clamp0(i.cgstAmt), 0);
    const sgst        = items.reduce((s, i) => s + clamp0(i.sgstAmt), 0);
    const igst        = items.reduce((s, i) => s + clamp0(i.igstAmt), 0);
    const freight     = clamp0(extraCharges.freight);
    const packaging   = clamp0(extraCharges.packagingCharge);
    const other       = clamp0(extraCharges.otherCharge);
    const roundOff    = clamp0(extraCharges.roundOff);
    const netAmount   = basicAmount + totalTax + freight + packaging + other + roundOff;
    return { basicAmount, totalTax, cgst, sgst, igst, freight, packaging, other, roundOff, netAmount };
  }, [items, extraCharges]);

  const handleSubmit = () => {
    if (!header.grnNo)           return alert("Please select a GRN.");
    if (!header.vendorInvoiceNo) return alert("Please enter Vendor Invoice No.");
    if (!header.dueDate)         return alert("Please enter Due Date.");
    const hasQty = items.some((i) => clamp0(i.invoicedQty) > 0);
    if (!hasQty) return alert("Please enter invoiced quantity for at least one item.");

    const pi = {
      id:        initialPI?.id || `PI-${Date.now()}`,
      invoiceNo: header.invoiceNo || `PI-${Date.now()}`,
      ...header,
      ...totals,
      extraCharges,
      items,
    };
    onSave(pi);
  };

  return (
    <div className="bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-6 space-y-4">

        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {initialPI ? "Edit Purchase Invoice" : "Generate Purchase Invoice"}
          </h2>
          <p className="text-xs text-slate-500">Purchase Invoice linked to a posted GRN — creates vendor payable</p>
        </div>

        {/* ── Invoice Header ── */}
        <Section title="Invoice Header" subtitle="Basic invoice and vendor details">
          {/* FIX: 3 independent columns, each with flex-col rows — no nested grid overlap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Col 1 */}
            <div className="space-y-4">
              <Row label="Invoice No" required>
                <Input value={header.invoiceNo || "(auto-generated)"} readOnly className="bg-slate-100 text-slate-600" />
              </Row>
              <Row label="Invoice Date" required>
                <Input type="date" value={header.invoiceDate} onChange={(e) => setH("invoiceDate", e.target.value)} />
              </Row>
              <Row label="GRN Reference" required>
                <div className="relative w-full">
                  <input
                    value={header.grnNo}
                    onChange={(e) => handleGRNSelect(e.target.value)}
                    list="grnList"
                    placeholder={grnLoading ? "Loading GRNs…" : "Select posted GRN"}
                    className={inputClass}
                  />
                  <datalist id="grnList">{grns.map((g) => <option key={g.id} value={g.grnNo} />)}</datalist>
                </div>
              </Row>
              <Row label="PO Reference">
                <Input value={header.poNo} readOnly className="bg-slate-100 text-slate-600" />
              </Row>
              <Row label="Vendor Name">
                <Input value={header.vendorName} readOnly className="bg-slate-100 text-slate-600" />
              </Row>
            </div>

            {/* Col 2 */}
            <div className="space-y-4">
              <Row label="Vendor Invoice No" required>
                <Input value={header.vendorInvoiceNo} onChange={(e) => setH("vendorInvoiceNo", e.target.value)} placeholder="Vendor's invoice number" />
              </Row>
              <Row label="Vendor Invoice Date" required>
                <Input type="date" value={header.vendorInvoiceDate} onChange={(e) => setH("vendorInvoiceDate", e.target.value)} />
              </Row>
              <Row label="Payment Terms">
                <Combo value={header.paymentTerms} onChange={(v) => setH("paymentTerms", v)} listId="payTermsList" placeholder="Select…" options={["Net 30", "Net 45", "Net 60", "Immediate", "Advance"]} />
              </Row>
              <Row label="Due Date" required>
                <Input type="date" value={header.dueDate} onChange={(e) => setH("dueDate", e.target.value)} />
              </Row>
              <Row label="Status">
                <Combo value={header.status} onChange={(v) => setH("status", v)} listId="piStatusList" placeholder="Draft" options={["Draft", "Pending", "Approved", "PartiallyPaid", "Paid", "Cancelled"]} />
              </Row>
            </div>

            {/* Col 3 — GST */}
            <div className="space-y-4">
              <Row label="Supply Type">
                <Combo value={header.supplyType} onChange={(v) => setH("supplyType", v)} listId="supplyList" placeholder="Intra-State" options={["Intra-State", "Inter-State", "Import"]} />
              </Row>
              <Row label="Buyer GSTIN">
                <Input value={header.buyerGSTIN} onChange={(e) => setH("buyerGSTIN", e.target.value)} placeholder="15-char GSTIN" maxLength={15} />
              </Row>
              <Row label="Vendor GSTIN">
                <Input value={header.vendorGSTIN} onChange={(e) => setH("vendorGSTIN", e.target.value)} placeholder="15-char GSTIN" maxLength={15} />
              </Row>
              <Row label="Currency">
                <Combo value={header.currency} onChange={(v) => setH("currency", v)} listId="currList" placeholder="INR" options={["INR", "USD", "EUR", "AED"]} />
              </Row>
              <Row label="Exchange Rate">
                <Input type="number" min="0" value={header.exchangeRate} onChange={(e) => setH("exchangeRate", e.target.value)} placeholder="1" />
              </Row>
            </div>
          </div>

          {/* Remarks — full width below columns */}
          <div className="mt-4">
            <label className="block">
              <div className="text-xs font-semibold text-slate-600 mb-1">Remarks</div>
              <textarea
                rows={2}
                className={textareaClass}
                value={header.remarks}
                onChange={(e) => setH("remarks", e.target.value)}
                placeholder="Invoice notes…"
              />
            </label>
          </div>
        </Section>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Basic (Taxable) Amt (₹)" value={money(totals.basicAmount)} />
          <Kpi label="CGST (₹)"                value={money(totals.cgst)} accent="amber" />
          <Kpi label="SGST / IGST (₹)"         value={money(totals.sgst + totals.igst)} accent="amber" />
          <Kpi label="Net Payable (₹)"          value={money(totals.netAmount)} accent="sky" />
        </div>

        {/* ── Line Items ── */}
        <Section
          title="Invoice Line Items"
          subtitle="Verify quantities, rates and applicable taxes (CGST / SGST / IGST)"
          right={<Btn onClick={() => setItems((p) => [...p, PI_ITEM_FROM_GRN()])}>+ Add Row</Btn>}
        >
          <div className="rounded-xl border border-slate-200 bg-white overflow-auto max-h-[55vh]">
            <table className="w-full text-xs min-w-[1800px]">
              <thead className="bg-[#F2F4F8] text-slate-600 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <TH>#</TH>
                  <TH>HSN / SAC</TH>
                  <TH>Barcode</TH>
                  <TH>Description</TH>
                  <TH className="text-right">GRN Qty</TH>
                  <TH className="text-right">Invoice Qty</TH>
                  <TH className="text-right">Rate</TH>
                  <TH className="text-right">Disc %</TH>
                  <TH className="text-right">Disc Amt</TH>
                  <TH className="text-right">Taxable Amt</TH>
                  <TH className="text-right">CGST %</TH>
                  <TH className="text-right">SGST %</TH>
                  <TH className="text-right">IGST %</TH>
                  <TH className="text-right">Tax Amt</TH>
                  <TH className="text-right">Line Total</TH>
                  <TH>Remarks</TH>
                  <TH>Action</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 align-top">
                    <TD><div className="px-1 py-2 tabular-nums text-slate-500">{idx + 1}</div></TD>
                    <TD><Cell value={it.hsn}         onChange={(e) => updateItem(idx, "hsn", e.target.value)} placeholder="HSN code" /></TD>
                    <TD><Cell value={it.barcode}     onChange={(e) => updateItem(idx, "barcode", e.target.value)} /></TD>
                    <TD><Cell value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} /></TD>
                    <TD className="text-right"><div className="px-2 py-2 tabular-nums text-slate-500">{n0(it.grnQty).toFixed(3)}</div></TD>
                    <TD className="text-right"><CellNum value={it.invoicedQty}  onChange={(e) => updateItem(idx, "invoicedQty", e.target.value)} /></TD>
                    <TD className="text-right"><CellNum value={it.rate}         onChange={(e) => updateItem(idx, "rate", e.target.value)} /></TD>
                    <TD className="text-right"><CellNum value={it.discountPct}  onChange={(e) => updateItem(idx, "discountPct", e.target.value)} /></TD>
                    <TD className="text-right"><div className="px-2 py-2 tabular-nums text-rose-600">{money(it.discountAmt)}</div></TD>
                    <TD className="text-right"><div className="px-2 py-2 tabular-nums font-semibold">{money(it.taxablAmt)}</div></TD>
                    <TD className="text-right"><CellNum value={it.cgstPct} onChange={(e) => updateItem(idx, "cgstPct", e.target.value)} /></TD>
                    <TD className="text-right"><CellNum value={it.sgstPct} onChange={(e) => updateItem(idx, "sgstPct", e.target.value)} /></TD>
                    <TD className="text-right"><CellNum value={it.igstPct} onChange={(e) => updateItem(idx, "igstPct", e.target.value)} /></TD>
                    <TD className="text-right"><div className="px-2 py-2 tabular-nums text-amber-700">{money(it.totalTax)}</div></TD>
                    <TD className="text-right"><div className="px-2 py-2 font-bold tabular-nums text-sky-700">{money(it.lineTotal)}</div></TD>
                    <TD><Cell value={it.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} /></TD>
                    <TD>
                      <button
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                        className="h-9 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 font-semibold"
                        type="button"
                      >
                        Remove
                      </button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Extra Charges + Summary ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Additional Charges" subtitle="Freight, packaging, other levies">
            <div className="space-y-4">
              <Row label="Freight Charges">
                <Input type="number" min="0" value={extraCharges.freight} onChange={(e) => setExtraCharges((p) => ({ ...p, freight: e.target.value }))} placeholder="0.00" />
              </Row>
              <Row label="Packaging Charges">
                <Input type="number" min="0" value={extraCharges.packagingCharge} onChange={(e) => setExtraCharges((p) => ({ ...p, packagingCharge: e.target.value }))} placeholder="0.00" />
              </Row>
              <Row label="Other Charges">
                <Input type="number" min="0" value={extraCharges.otherCharge} onChange={(e) => setExtraCharges((p) => ({ ...p, otherCharge: e.target.value }))} placeholder="0.00" />
              </Row>
              <Row label="Round Off">
                <Input type="number" value={extraCharges.roundOff} onChange={(e) => setExtraCharges((p) => ({ ...p, roundOff: e.target.value }))} placeholder="0.00" />
              </Row>
            </div>
          </Section>

          <Section title="Invoice Summary" subtitle="Final payable breakdown">
            <div className="space-y-2 text-xs">
              <KV k="Basic (Taxable) Amount" v={money(totals.basicAmount)} />
              <KV k="CGST"          v={money(totals.cgst)} />
              <KV k="SGST"          v={money(totals.sgst)} />
              <KV k="IGST"          v={money(totals.igst)} />
              <KV k="Freight"       v={money(totals.freight)} />
              <KV k="Packaging"     v={money(totals.packaging)} />
              <KV k="Other Charges" v={money(totals.other)} />
              <KV k="Round Off"     v={money(totals.roundOff)} />
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">Net Payable</span>
                  <span className="text-xl font-extrabold text-sky-700 tabular-nums">₹ {money(totals.netAmount)}</span>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Footer Buttons ── */}
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-3 flex justify-end gap-3">
          <Btn ghost onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSubmit}>{initialPI ? "Update Invoice" : "Save Invoice"}</Btn>
        </div>

      </div>
    </div>
  );
}

/* ─── PI VIEW MODAL — Printable Invoice ────────────────────────── */
function PIViewModal({ pi, onClose }) {
  return (
    <div className="bg-white text-slate-900 px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-sky-700">Purchase Invoice</h2>
          <p className="text-sm text-slate-500 mt-1">Invoice No: <b className="text-slate-900">{pi.invoiceNo}</b></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm" type="button">🖨 Print</button>
          <button onClick={onClose}              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm" type="button">Close</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          ["Invoice Date",       pi.invoiceDate],
          ["GRN Reference",      pi.grnNo],
          ["PO Reference",       pi.poNo],
          ["Vendor",             pi.vendorName],
          ["Vendor Invoice No",  pi.vendorInvoiceNo],
          ["Vendor Invoice Date",pi.vendorInvoiceDate],
          ["Payment Terms",      pi.paymentTerms],
          ["Due Date",           pi.dueDate],
          ["Status",             pi.status],
          ["Supply Type",        pi.supplyType],
          ["Buyer GSTIN",        pi.buyerGSTIN],
          ["Vendor GSTIN",       pi.vendorGSTIN],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
            <div className="font-semibold text-slate-900 mt-0.5">{v || "—"}</div>
          </div>
        ))}
      </div>

      {Array.isArray(pi.items) && pi.items.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-auto mb-4">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-[#F2F4F8]">
              <tr className="border-b border-slate-200">
                {["#", "HSN", "Description", "Invoice Qty", "Rate", "Taxable Amt", "CGST", "SGST", "IGST", "Total Tax", "Line Total"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pi.items.map((it, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">{it.hsn || "—"}</td>
                  <td className="px-3 py-2">{it.description || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n0(it.invoicedQty).toFixed(3)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.rate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(it.taxablAmt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.cgstAmt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.sgstAmt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.igstAmt)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">{money(it.totalTax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-sky-700">{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="flex justify-end">
        <div className="rounded-xl border border-slate-200 bg-[#FAFBFF] px-5 py-4 min-w-[280px] space-y-2 text-xs">
          <KV k="Basic Amount"   v={money(pi.basicAmount)} />
          <KV k="CGST"           v={money(pi.cgst)} />
          <KV k="SGST"           v={money(pi.sgst)} />
          <KV k="IGST"           v={money(pi.igst)} />
          <KV k="Freight"        v={money(pi.freight)} />
          <KV k="Packaging"      v={money(pi.packaging)} />
          <KV k="Other Charges"  v={money(pi.other)} />
          <div className="border-t border-slate-200 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Net Payable</span>
              <span className="text-lg font-extrabold text-sky-700 tabular-nums">₹ {money(pi.netAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared UI primitives ──────────────────────────────────────── */

/* FIX: ModalShell changed from sticky/bottom to fixed/centered overlay */
function ModalShell({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
      <div className="relative w-full max-w-7xl mx-4 rounded-2xl bg-[#F6F7FB] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-slate-500 hover:text-slate-900 text-xl font-bold z-10"
          type="button"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ title, message, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose}    className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm" type="button">Cancel</button>
          <button onClick={onConfirm}  className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm border border-rose-600" type="button">Delete</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, right, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  const color =
    accent === "sky"     ? "text-sky-700"     :
    accent === "amber"   ? "text-amber-700"   :
    accent === "rose"    ? "text-rose-600"    :
    accent === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-[#FAFBFF] p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}

/* FIX: Row changed from grid (with fixed 190px col) to flex-col — prevents overflow into sibling columns */
function Row({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-slate-600">
        {label}{required && <span className="text-rose-500"> *</span>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{k}</span>
      <span className="font-semibold tabular-nums text-slate-900">{v}</span>
    </div>
  );
}

function Btn({ children, ghost, onClick, type = "button" }) {
  return (
    <button
      onClick={onClick}
      type={type}
      className={`h-10 px-4 rounded-lg text-sm font-semibold transition border ${
        ghost
          ? "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
          : "bg-sky-600 hover:bg-sky-700 text-white border-sky-600"
      }`}
    >
      {children}
    </button>
  );
}

function Combo({ value, onChange, options, listId, placeholder }) {
  return (
    <div className="relative w-full">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        className={inputClass}
      />
      <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}

const inputClass    = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";
const textareaClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

function Input({ className = "", ...props }) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}
function TH({ className = "", children }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase text-slate-600 text-left ${className}`}>{children}</th>;
}
function TD({ className = "", children }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function Cell({ disabled, ...props }) {
  return (
    <input
      {...props}
      disabled={disabled}
      className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-200 ${
        disabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
      }`}
    />
  );
}
function CellNum({ disabled, ...props }) {
  return (
    <input
      {...props}
      type="number"
      min="0"
      disabled={disabled}
      className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none text-right tabular-nums focus:ring-2 focus:ring-sky-200 ${
        disabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
      }`}
    />
  );
}