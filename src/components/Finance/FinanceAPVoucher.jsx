import React, { useState, useMemo } from "react";
import {
  FileText,
  Search,
  Plus,
  X,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Calendar,
  ChevronDown,
  Save,
  Paperclip,
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";

function KPICard({ title, value, icon, color, iconColor }) {
  let baseColor = 'slate';
  if (color) {
    const m = color.match(/bg-([a-z]+)-/);
    if (m) baseColor = m[1];
  }

  return (
    <div className={`relative min-h-[85px] bg-white rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer`}>
      <div className="flex items-center justify-between gap-3 relative z-10">
        <p className="text-sm font-bold text-black uppercase tracking-wider">
          {title}
        </p>
        <div className={`rounded-md p-1.5 shadow-sm ${iconColor}`}>{icon}</div>
      </div>
      <h3 className="mt-2 break-words text-2xl font-black text-black leading-tight relative z-10">{value}</h3>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)] transition-all duration-300 min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-1 text-xs font-bold text-indigo-700">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function FinanceAPVoucher() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add", "edit", "view"
  const [activeId, setActiveId] = useState(null);
  const [vendorName, setVendorName] = useState("");
  const [refInvoice, setRefInvoice] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("Open");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [balance, setBalance] = useState("");
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState("");
  const [subLedgerRows, setSubLedgerRows] = useState([{ id: 1 }]);

  const [vouchers, setVouchers] = useState([]);

  const stats = useMemo(() => {
    let total = vouchers.reduce((acc, curr) => acc + curr.amount, 0);
    let applied = vouchers.filter(v => v.status === "Applied").reduce((acc, curr) => acc + curr.amount, 0);
    let open = vouchers.filter(v => v.status === "Open").reduce((acc, curr) => acc + curr.amount, 0);
    let refunded = vouchers.filter(v => v.status === "Refunded").reduce((acc, curr) => acc + curr.amount, 0);

    return {
      total: `₹${total.toLocaleString("en-IN")}`,
      applied: `₹${applied.toLocaleString("en-IN")}`,
      open: `₹${open.toLocaleString("en-IN")}`,
      refunded: `₹${refunded.toLocaleString("en-IN")}`,
    };
  }, [vouchers]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.refInv.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vouchers, searchTerm]);

  const handleCreateVoucherClick = () => {
    setVendorName("");
    setRefInvoice("");
    setAmount("");
    setStatus("Open");
    setInstrumentDate("");
    setBalance("");
    setModalMode("add");
    setActiveId(null);
    setShowModal(true);
  };

  const handleQuickApply = (row) => {
    const updated = vouchers.map(v => {
      if (v.id === row.id) {
        return { ...v, status: 'Applied' };
      }
      return v;
    });
    setVouchers(updated);

  };

  const handleDeleteVoucher = (id) => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-2xl border border-slate-200 pointer-events-auto flex flex-col gap-2 p-4`}>
        <span className="text-sm font-bold text-slate-800">
          Are you sure you want to delete <span className="font-mono text-indigo-600">{id}</span>?
        </span>
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={() => {
              setVouchers((prev) => prev.filter((v) => v.id !== id));
              toast.remove(t.id);
              setTimeout(() => toast.success("AP Voucher Deleted Successfully!", { duration: 3000 }), 100);
            }}
            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition cursor-pointer"
          >
            Yes
          </button>
          <button
            onClick={() => toast.remove(t.id)}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            No
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: `delete-${id}` });
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title Block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Accounts Payable (AP Voucher)</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vendor or reference..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all font-semibold shadow-sm"
              />
            </div>
            <button
              onClick={handleCreateVoucherClick}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-800 transition shadow-md hover:-translate-y-[1px] whitespace-nowrap"
            >
              <Plus size={16} />
              <span>New AP Voucher</span>
            </button>
          </div>
        </div>



        {/* Data Table */}
        <SectionCard
          title="AP Vouchers Ledger"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-950 font-black">
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Sl No</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Voucher No</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Date</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Owner Site</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Cash/Bank</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Payment Mode</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Instrument No</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">On Account</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Reference Site</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Reference No</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Sub-Ledger</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Sub Ledger Id</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Sub Ledger Class Name</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">General Ledger</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Ledger Group Name</th>
                  <th className="py-4 px-4 text-right font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Amount (Dr)</th>
                  <th className="py-4 px-4 font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Ledger Narration</th>
                  <th className="py-4 px-4 text-center font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Status</th>
                  <th className="py-4 px-4 text-center font-bold text-slate-900 uppercase tracking-wider text-xs whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredVouchers.length > 0 ? (
                  filteredVouchers.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors duration-200 cursor-pointer">
                      <td className="py-3.5 px-4 font-bold text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-indigo-700 font-mono text-xs">{row.id}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-semibold">{row.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.ownerSite || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.cashBank || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.paymentMode || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.instrumentNo || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.onAccount || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.referenceSite || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.reference || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.subLedger || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.subLedgerId || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.subLedgerClassName || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.generalLedger || "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.ledgerGroupName || "-"}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700">{row.amountDr ? `₹${Number(row.amountDr).toLocaleString("en-IN")}` : "-"}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{row.ledgerNarration || "-"}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${row.status === 'Applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                          row.status === 'Refunded' ? 'bg-teal-50 text-teal-700 border-teal-250' : 'bg-amber-50 text-amber-700 border-amber-250'
                          }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setInstrumentDate(row.instrumentDate || ""); setBalance(row.balance || ""); setModalMode("view"); setActiveId(row.id); setShowModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                            <Eye size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setInstrumentDate(row.instrumentDate || ""); setBalance(row.balance || ""); setModalMode("edit"); setActiveId(row.id); setShowModal(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteVoucher(row.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-sm font-bold text-slate-800">
                      No accounts receivable vouchers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
        {/* Legacy Ginesys Ditto AR Voucher Modal */}
        {showModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-hidden p-4 sm:p-6">
            <div className="w-full max-w-[1100px] bg-white rounded-3xl shadow-2xl flex flex-col max-h-full font-sans text-sm sm:text-base text-slate-900 border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{modalMode === 'view' ? 'View AP Voucher' : modalMode === 'edit' ? 'Edit AP Voucher' : 'Add: AP Voucher'}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50/50">
                <fieldset disabled={modalMode === "view"} className={`space-y-6 sm:space-y-8 min-w-0 border-0 p-0 m-0 ${modalMode === "view" ? "opacity-80 pointer-events-none" : ""}`}>{/* 1. Document Information */}
                  <details className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 group" open>
                    <summary className="flex items-center justify-between cursor-pointer list-none border-b border-slate-100 pb-3 mb-4 select-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-indigo-600"><FileText size={18} /></span>
                        <h4 className="text-base sm:text-lg font-bold text-slate-900">Document Information</h4>
                      </div>
                      <ChevronDown size={20} className="text-slate-500 group-open:rotate-180 transition-transform duration-300" />
                    </summary>
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-32 font-bold text-slate-800">Owner Site <span className="text-red-500">*</span></label>
                            <div className="flex-1 relative">
                              <input type="text" list="ap-owner-sites" placeholder="Enter Owner Site" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm hide-datalist-arrow" />
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                              <datalist id="ap-owner-sites">
                              </datalist>                          </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-32 font-bold text-slate-800">Voucher No. <span className="text-red-500">*</span></label>
                            <div className="flex-1 relative">
                              <input type="text" placeholder="Enter Voucher No." className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />

                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-32 font-bold text-slate-800">Cash/Bank <span className="text-red-500">*</span></label>
                            <div className="flex-1 relative">
                              <input type="text" list="ap-cash-banks" placeholder="Enter Cash/Bank" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm bg-white hide-datalist-arrow" />
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                              <datalist id="ap-cash-banks">
                              </datalist>                          </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-32 font-bold text-slate-800">On Account</label>
                            <div className="flex-1 flex items-center gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="isOnAccount" value="Yes" className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                                <span className="text-sm font-semibold text-slate-800">Yes</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="isOnAccount" value="No" defaultChecked className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                                <span className="text-sm font-semibold text-slate-800">No</span>
                              </label>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-32 font-bold text-slate-800">Remarks</label>
                            <div className="flex-1 relative">
                              <input type="text" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-28 font-bold text-slate-800">Date <span className="text-red-500">*</span></label>
                            <div className="flex-1 relative">
                              <input type="date" defaultValue={new Date().toLocaleDateString('en-CA')} className="w-full border border-slate-300 rounded-lg pl-3 pr-4 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-28 font-bold text-slate-800">Reference</label>
                            <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <label className="sm:w-28 font-bold text-slate-800">Balance</label>
                            <input type="text" value={balance} onChange={(e) => setBalance(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <label className="font-extrabold text-slate-900 text-base sm:text-lg">Receipt Amount:</label>
                        <div className="relative w-48">
                          <input type="text" className="w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2.5 font-black text-black text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" placeholder="0.00" />

                        </div>
                      </div>
                    </div>
                  </details>

                  {/* 2. Sub Ledger Information */}
                  <details className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 group" open>
                    <summary className="flex items-center justify-between cursor-pointer list-none border-b border-slate-100 pb-3 mb-4 select-none [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600"><HelpCircle size={18} /></span>
                        <h4 className="text-base sm:text-lg font-bold text-slate-900">Sub Ledger Information</h4>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSubLedgerRows([...subLedgerRows, { id: Date.now() }]);
                          }}
                          className="flex items-center gap-2 text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-1.5 rounded-lg font-bold text-sm transition-colors border border-indigo-200"
                        >
                          <Plus size={16} /> Add Row
                        </button>
                        <ChevronDown size={20} className="text-slate-500 group-open:rotate-180 transition-transform duration-300" />
                      </div>
                    </summary>
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-100 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 text-center w-16">Sl No</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[200px]">Sub-Ledger</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Sub Ledger Id</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Sub Ledger Class Name</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[200px]">General Ledger</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Ledger Group Name</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Ledger Abbreviation</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Reference Site</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 text-center w-32">Is Reversal</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 text-left min-w-[200px]">Amount (Dr)</th>
                                <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[200px]">Ledger Narration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {subLedgerRows.map((row, index) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200 h-14 group">
                                  <td className="p-3 text-center text-slate-500 text-base font-bold cursor-pointer hover:text-indigo-600">{index + 1}</td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px]" />
                                  </td>
                                  <td className="p-3">
                                    <select className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 cursor-pointer text-center appearance-none shadow-sm transition-all">
                                      <option value="No">No</option>
                                      <option value="Yes">Yes</option>
                                    </select>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <input type="number" min="0" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} step="0.01" value={index === 0 ? enteredAmount : undefined} onChange={(e) => index === 0 && setEnteredAmount(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-black text-black text-left shadow-sm transition-all min-w-[150px]" placeholder="0.00" />
                                      <button className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-700 px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all whitespace-nowrap shrink-0">Adjust</button>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <textarea rows="1" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition-all resize-y min-h-[44px] min-w-[150px]" />
                                      <button onClick={(e) => { e.preventDefault(); setShowChequeModal(true); }} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-700 px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all whitespace-nowrap shrink-0">Cheque/RTGS</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-slate-100 px-5 py-4 border-t border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-8">
                            <div className="flex gap-2 items-center">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-600 uppercase">Record Count:</span>
                              <span className="font-black text-black text-base sm:text-lg">{subLedgerRows.length}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-xs sm:text-sm font-extrabold text-slate-600 uppercase">Total Amount:</span>
                              <span className="font-black text-black text-base sm:text-lg">₹ {enteredAmount || '0.00'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                </fieldset>
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 bg-white border border-slate-300 text-slate-800 hover:text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 font-extrabold px-5 py-2.5 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
                    <FileText size={18} />
                    <span>Copy Content</span>
                  </button>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (modalMode !== 'view') toast.error("AP Voucher Cancelled", { duration: 3000, id: "cancel" });
                      setShowModal(false);
                    }}
                    className="flex-1 sm:flex-none px-6 py-2.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-extrabold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                  >
                    {modalMode === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {modalMode !== 'view' && (
                    <button
                      onClick={() => {
                        if (modalMode === 'edit') {
                          setVouchers(vouchers.map(v => v.id === activeId ? {
                            ...v,
                            instrumentDate: instrumentDate,
                            balance: balance,
                            amount: Number(enteredAmount) || 0
                          } : v));
                          toast.success("AP Voucher Updated Successfully!", { duration: 3000 });
                        } else {
                          const newVoucher = {
                            id: `APV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                            name: "Sample Vendor",
                            refInv: "N/A",
                            date: new Date().toLocaleDateString('en-GB'),
                            instrumentDate: instrumentDate || "-",
                            balance: balance || "0",
                            status: "Open",
                            amount: Number(enteredAmount) || 0
                          };
                          setVouchers([...vouchers, newVoucher]);
                          toast.success("AP Voucher Saved Successfully!", { duration: 3000 });
                        }
                        setShowModal(false);
                      }}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 flex items-center justify-center gap-2"
                    >
                      <Save size={18} />
                      <span>Save Voucher</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Cheque/RTGS Modal */}
        {showChequeModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-hidden p-4 sm:p-6">
            <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-extrabold text-slate-900">Bank Details</h3>
                <button onClick={() => setShowChequeModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-800">Instrument No (Cheque/UTR):</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-800">Instrument Date:</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-800">Bank Name:</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. HDFC Bank" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-800">IFSC Code:</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-800">Account Holder Name:</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 bg-slate-50 px-6 py-4 border-t border-slate-200">
                <button onClick={() => setShowChequeModal(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={() => setShowChequeModal(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-all">Save Details</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


