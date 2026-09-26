import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, HandCoins, Loader2, PiggyBank, RefreshCw, Search, Wallet, X } from "lucide-react";
import { apiUrl } from "../../config/api.js";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const getToken = () => localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
const MODES = ["NEFT", "RTGS", "UPI", "Cash", "Cheque", "DD", "Other"];

async function ledgerFetch(path, options = {}) {
  const response = await fetch(apiUrl(`/api/finance/vendor-ledger${path}`), {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Vendor ledger request failed.");
  return body;
}

const keyOf = (vendor) => encodeURIComponent(vendor);
const typeLabel = {
  bill: "Bill", payment: "Payment", advance: "Advance paid", advance_adjustment: "Advance set against bill",
  debit_note: "Debit note", voucher_payment: "Payment voucher",
};

function Stat({ label, value, tone = "slate", hint }) {
  const tones = { slate: "text-slate-900", rose: "text-rose-700", emerald: "text-emerald-700", amber: "text-amber-700", indigo: "text-indigo-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-black tracking-tight ${tones[tone]}`}>{value}</p>
    {hint && <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>}
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>;
}

const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

// One payment to a vendor, shown split across their open bills (oldest due first).
function PayModal({ vendor, openBills, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState("NEFT");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [manual, setManual] = useState({});   // invoice id -> typed amount (overrides the auto split)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = Number(amount) || 0;
  const split = useMemo(() => {
    if (Object.keys(manual).length) return openBills.map((bill) => ({ ...bill, pay: Math.max(0, Number(manual[bill.id]) || 0) }));
    let left = total;
    return openBills.map((bill) => {
      const pay = Math.max(0, Math.min(left, bill.balance_due));
      left = Math.round((left - pay) * 100) / 100;
      return { ...bill, pay: Math.round(pay * 100) / 100 };
    });
  }, [manual, openBills, total]);
  const allocated = Math.round(split.reduce((a, b) => a + b.pay, 0) * 100) / 100;
  const leftover = Math.round((total - allocated) * 100) / 100;

  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (total <= 0) { setError("Enter the amount you are paying."); return; }
    if (allocated > total + 0.01) { setError("The split is more than the amount being paid."); return; }
    setSaving(true);
    try {
      const allocations = split.filter((s) => s.pay > 0).map((s) => ({ invoice_id: s.id, amount: s.pay }));
      const result = await ledgerFetch(`/vendors/${keyOf(vendor)}/pay`, {
        method: "POST",
        body: JSON.stringify({ amount: total, paymentDate: date, paymentMode: mode, referenceNo: reference, remarks, allocations, keep_excess_as_advance: true }),
      });
      onDone(result.message + (result.advance_created ? ` ₹${Number(result.advance_created.amount).toLocaleString("en-IN")} kept as advance.` : ""));
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <Modal title={`Pay ${vendor}`} onClose={onClose}>
    <form onSubmit={save} className="space-y-4">
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">Amount paying now<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setManual({}); }} className={field} required autoFocus /></label>
        <label className="text-sm font-bold text-slate-700">Payment date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required /></label>
        <label className="text-sm font-bold text-slate-700">Mode<select value={mode} onChange={(e) => setMode(e.target.value)} className={field}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">Reference / UTR<input value={reference} onChange={(e) => setReference(e.target.value)} className={field} placeholder="UTR, cheque no." /></label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Note<input value={remarks} onChange={(e) => setRemarks(e.target.value)} className={field} placeholder="Optional" /></label>

      <div>
        <div className="flex items-center justify-between"><p className="text-sm font-black text-slate-800">How this payment is split across open bills</p>
          {Object.keys(manual).length > 0 && <button type="button" onClick={() => setManual({})} className="text-xs font-bold text-indigo-600">Reset to oldest-first</button>}</div>
        {openBills.length === 0 ? <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No open bills. The full amount will be kept as an advance.</p> :
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Bill</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-right">Pay</th></tr></thead>
              <tbody>{split.map((bill) => <tr key={bill.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">{bill.invoice_no}</td>
                <td className="px-3 py-2 text-slate-600">{bill.due_date || "-"}{bill.days_overdue > 0 && <span className="ml-2 text-xs font-bold text-rose-600">{bill.days_overdue}d late</span>}</td>
                <td className="px-3 py-2 text-right text-slate-700">{money(bill.balance_due)}</td>
                <td className="px-3 py-2 text-right"><input type="number" min="0" step="0.01" max={bill.balance_due} value={bill.pay || ""} placeholder="0" onChange={(e) => setManual((old) => ({ ...Object.fromEntries(split.map((s) => [s.id, s.pay])), ...old, [bill.id]: e.target.value }))} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-indigo-500" /></td>
              </tr>)}</tbody>
            </table>
          </div>}
        <p className={`mt-2 text-sm font-semibold ${leftover > 0.01 ? "text-amber-700" : "text-slate-500"}`}>
          Set against bills: {money(allocated)}{leftover > 0.01 && ` · ${money(leftover)} will be kept as an advance for this vendor`}
        </p>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Record payment"}</button>
      </div>
    </form>
  </Modal>;
}

function AdvanceModal({ vendor, onClose, onDone }) {
  const [form, setForm] = useState({ amount: "", date: today(), payment_mode: "NEFT", reference_no: "", remarks: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try { const result = await ledgerFetch(`/vendors/${keyOf(vendor)}/advance`, { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) }); onDone(result.message); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <Modal title={`Record advance to ${vendor}`} onClose={onClose}>
    <form onSubmit={save} className="space-y-4">
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      <p className="rounded-xl bg-indigo-50 p-3 text-sm font-medium text-indigo-900">Money paid before a bill exists. It stays as "advance available" and can be set against the vendor's bills when they arrive.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">Amount<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={field} required autoFocus /></label>
        <label className="text-sm font-bold text-slate-700">Date<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={field} required /></label>
        <label className="text-sm font-bold text-slate-700">Mode<select value={form.payment_mode} onChange={(e) => set("payment_mode", e.target.value)} className={field}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">Reference<input value={form.reference_no} onChange={(e) => set("reference_no", e.target.value)} className={field} /></label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Note<input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={field} placeholder="e.g. Advance for the winter order" /></label>
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Record advance"}</button></div>
    </form>
  </Modal>;
}

function exportCsv(statement) {
  const rows = [["Date", "Type", "Reference", "Description", "Bill (owed +)", "Payment / credit (−)", "Balance"]];
  rows.push(["", "Opening balance", "", "", "", "", statement.opening_balance]);
  statement.lines.forEach((l) => rows.push([l.date, typeLabel[l.type] || l.type, l.ref, l.description, l.bill || "", l.credit || "", l.balance]));
  rows.push(["", "Closing balance", "", "", "", "", statement.closing_balance]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = `vendor-ledger-${statement.vendor.replace(/[^a-z0-9]+/gi, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function FinanceVendorLedger() {
  const [summary, setSummary] = useState({ rows: [], totals: {} });
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [statement, setStatement] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true); setError("");
    try { setSummary(await ledgerFetch("/vendors")); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);
  const loadStatement = useCallback(async (name, r = range) => {
    setLoading(true); setError("");
    try {
      const qs = new URLSearchParams(); if (r.from) qs.set("from_date", r.from); if (r.to) qs.set("to_date", r.to);
      setStatement(await ledgerFetch(`/vendors/${keyOf(name)}/statement${qs.toString() ? `?${qs}` : ""}`));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const open = (name) => { setVendor(name); setStatement(null); setNotice(""); loadStatement(name, range); };
  const back = () => { setVendor(""); setStatement(null); setNotice(""); loadSummary(); };
  const done = (message) => { setModal(""); setNotice(message); loadStatement(vendor); loadSummary(); };
  const setAdvanceAgainstBills = async () => {
    setError("");
    try { const r = await ledgerFetch(`/vendors/${keyOf(vendor)}/apply-advance`, { method: "POST", body: "{}" }); setNotice(r.message); loadStatement(vendor); loadSummary(); }
    catch (err) { setError(err.message); }
  };

  const rows = useMemo(() => summary.rows.filter((r) => r.vendor.toLowerCase().includes(search.toLowerCase())), [summary.rows, search]);
  const totals = summary.totals || {};

  if (!vendor) {
    return <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900">Vendor ledger</h2><p className="text-sm text-slate-500">One running account per vendor: every bill adds to what you owe, every payment, advance or debit note reduces it.</p></div>
        <button onClick={loadSummary} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Vendors" value={totals.vendors || 0} />
        <Stat label="Total billed" value={money(totals.total_billed)} />
        <Stat label="Outstanding to vendors" value={money(totals.outstanding)} tone="rose" hint={totals.overdue > 0 ? `${money(totals.overdue)} overdue` : "Nothing overdue"} />
        <Stat label="Advances available" value={money(totals.advance_available)} tone="emerald" hint="Paid on account, not yet set against bills" />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-xs"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" /></div>
        </div>
        {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin text-slate-400" /></div> :
          rows.length === 0 ? <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-slate-500">No vendor bills yet. Approved purchase invoices appear here.</div> :
            <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-5 py-3">Vendor</th><th className="px-5 py-3 text-right">Bills</th><th className="px-5 py-3 text-right">Billed</th><th className="px-5 py-3 text-right">Paid</th><th className="px-5 py-3 text-right">Advance</th><th className="px-5 py-3 text-right">Outstanding</th><th className="px-5 py-3 text-right">Overdue</th><th className="px-5 py-3">Last payment</th><th className="px-5 py-3" /></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.vendor} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => open(r.vendor)}>
                <td className="px-5 py-3 font-bold text-slate-900">{r.vendor}</td><td className="px-5 py-3 text-right text-slate-600">{r.invoice_count}</td>
                <td className="px-5 py-3 text-right text-slate-700">{money(r.total_billed)}</td><td className="px-5 py-3 text-right text-slate-700">{money(r.paid)}</td>
                <td className="px-5 py-3 text-right text-emerald-700">{r.advance_available > 0 ? money(r.advance_available) : "-"}</td>
                <td className={`px-5 py-3 text-right font-black ${r.outstanding > 0 ? "text-rose-700" : r.outstanding < 0 ? "text-emerald-700" : "text-slate-500"}`}>{r.outstanding < 0 ? `${money(-r.outstanding)} in advance` : money(r.outstanding)}</td>
                <td className="px-5 py-3 text-right text-amber-700">{r.overdue > 0 ? money(r.overdue) : "-"}</td><td className="px-5 py-3 text-slate-500">{r.last_payment || "-"}</td>
                <td className="px-5 py-3 text-right"><span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">View ledger</span></td>
              </tr>)}</tbody>
            </table></div>}
      </section>
    </div>;
  }

  const s = statement?.summary;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button onClick={back} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></button>
        <div><h2 className="text-lg font-black text-slate-900">{vendor}</h2><p className="text-sm text-slate-500">Vendor ledger and statement</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModal("pay")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700"><Wallet size={16} /> Pay vendor</button>
        <button onClick={() => setModal("advance")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><PiggyBank size={16} /> Record advance</button>
        {s?.advance_available > 0 && statement.open_bills.length > 0 && <button onClick={setAdvanceAgainstBills} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100"><HandCoins size={16} /> Set advance against bills</button>}
        {statement && <button onClick={() => exportCsv(statement)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Download size={16} /> Download statement</button>}
      </div>
    </div>
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
    {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {loading && !statement ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-slate-400" /></div> : statement && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total billed" value={money(s.total_billed)} hint={`${s.invoice_count} bill(s)`} />
        <Stat label="Paid" value={money(s.paid_on_bills)} tone="emerald" />
        <Stat label="Advance available" value={money(s.advance_available)} tone="indigo" />
        <Stat label="Outstanding" value={s.outstanding < 0 ? `${money(-s.outstanding)} in advance` : money(s.outstanding)} tone={s.outstanding > 0 ? "rose" : "emerald"} hint="Billed − paid − advance − notes" />
        <Stat label="Overdue" value={money(s.overdue)} tone="amber" />
      </div>

      {statement.open_bills.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3"><h3 className="font-black text-slate-900">Open bills</h3></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-5 py-2.5">Bill</th><th className="px-5 py-2.5">Bill date</th><th className="px-5 py-2.5">Due</th><th className="px-5 py-2.5 text-right">Total</th><th className="px-5 py-2.5 text-right">Paid</th><th className="px-5 py-2.5 text-right">Balance</th><th className="px-5 py-2.5">Status</th></tr></thead>
          <tbody>{statement.open_bills.map((b) => <tr key={b.id} className="border-t border-slate-100">
            <td className="px-5 py-2.5 font-semibold text-slate-900">{b.invoice_no}</td><td className="px-5 py-2.5 text-slate-600">{b.invoice_date}</td><td className="px-5 py-2.5 text-slate-600">{b.due_date || "-"}</td>
            <td className="px-5 py-2.5 text-right">{money(b.invoice_total)}</td><td className="px-5 py-2.5 text-right text-emerald-700">{money(b.paid_amount)}</td><td className="px-5 py-2.5 text-right font-bold">{money(b.balance_due)}</td>
            <td className="px-5 py-2.5">{b.days_overdue > 0 ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{b.days_overdue} days overdue</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Not due yet</span>}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h3 className="font-black text-slate-900">Statement</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2 font-semibold text-slate-600">From<input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            <label className="flex items-center gap-2 font-semibold text-slate-600">To<input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>
            <button onClick={() => loadStatement(vendor, range)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Apply</button>
            {(range.from || range.to) && <button onClick={() => { const r = { from: "", to: "" }; setRange(r); loadStatement(vendor, r); }} className="text-xs font-bold text-indigo-600">Clear</button>}
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Entry</th><th className="px-5 py-2.5">Details</th><th className="px-5 py-2.5 text-right">Bill (+)</th><th className="px-5 py-2.5 text-right">Paid / credit (−)</th><th className="px-5 py-2.5 text-right">Balance</th></tr></thead>
          <tbody>
            <tr className="border-t border-slate-100 bg-slate-50/60"><td className="px-5 py-2.5" /><td className="px-5 py-2.5 font-bold text-slate-700" colSpan={4}>Opening balance</td><td className="px-5 py-2.5 text-right font-bold">{money(statement.opening_balance)}</td></tr>
            {statement.lines.map((l, i) => <tr key={i} className={`border-t border-slate-100 ${l.type === "advance_adjustment" ? "text-slate-400" : ""}`}>
              <td className="px-5 py-2.5 text-slate-600">{l.date}</td>
              <td className="px-5 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.type === "bill" ? "bg-rose-50 text-rose-700" : l.type === "advance" ? "bg-indigo-50 text-indigo-700" : l.type === "advance_adjustment" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{typeLabel[l.type] || l.type}</span></td>
              <td className="px-5 py-2.5 text-slate-700">{l.description}{l.type === "advance_adjustment" && <span className="ml-2 text-xs">(no change to balance)</span>}</td>
              <td className="px-5 py-2.5 text-right">{l.bill ? money(l.bill) : ""}</td>
              <td className="px-5 py-2.5 text-right text-emerald-700">{l.credit ? money(l.credit) : l.type === "advance_adjustment" ? money(l.applied) : ""}</td>
              <td className="px-5 py-2.5 text-right font-bold text-slate-900">{money(l.balance)}</td>
            </tr>)}
            {statement.lines.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No entries in this period.</td></tr>}
            <tr className="border-t-2 border-slate-200 bg-slate-50"><td className="px-5 py-3" /><td className="px-5 py-3 font-black text-slate-800" colSpan={4}>Closing balance</td><td className="px-5 py-3 text-right font-black text-slate-900">{money(statement.closing_balance)}</td></tr>
          </tbody>
        </table></div>
      </section>
    </>}
    {modal === "pay" && statement && <PayModal vendor={vendor} openBills={statement.open_bills} onClose={() => setModal("")} onDone={done} />}
    {modal === "advance" && <AdvanceModal vendor={vendor} onClose={() => setModal("")} onDone={done} />}
  </div>;
}
