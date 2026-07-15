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
  ChevronDown,
  Save,
  Eye,
  Edit2,
  Trash2,
  Layers,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

const INITIAL_VOUCHERS = [];

export default function FinanceGeneralVoucher() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [activeId, setActiveId] = useState(null);
  const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS);
  const [enteredExpense, setEnteredExpense] = useState("");
  const [enteredIncome, setEnteredIncome] = useState("");
  const [rows, setRows] = useState([1]);

  const stats = useMemo(() => {
    const total = vouchers.length;
    const open = vouchers.filter((v) => v.status === "Open").length;
    const approved = vouchers.filter((v) => v.status === "Approved").length;
    const totalAmount = vouchers.reduce((s, v) => s + v.amount, 0);
    return { total, open, approved, totalAmount };
  }, [vouchers]);

  const filtered = useMemo(() =>
    vouchers.filter(
      (v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.status.toLowerCase().includes(searchTerm.toLowerCase())
    ), [vouchers, searchTerm]);

  const handleOpen = () => {
    setEnteredExpense("");
    setEnteredIncome("");
    setRows([1]);
    setModalMode("add");
    setActiveId(null);
    setShowModal(true);
  };

  const addRow = () => {
    setRows([...rows, rows.length + 1]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      const newRows = [...rows];
      newRows.splice(index, 1);
      setRows(newRows);
    }
  };

  const statusBadge = (s) => {
    if (s === "Approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "Open") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
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
              setTimeout(() => toast.success("General Voucher Deleted Successfully!", { duration: 3000 }), 100);
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
    <div className="min-h-full bg-slate-50/50 p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">

        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner border border-indigo-100">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-black tracking-tight">General Voucher</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vouchers..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all font-semibold shadow-sm"
              />
            </div>
            <button
              onClick={handleOpen}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              <span>New General Voucher</span>
            </button>
          </div>
        </div>


        {/* Data Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">General Vouchers Ledger</h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">Showing {filtered.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Sl No</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Voucher No.</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Owner Site</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Cash/Bank</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">General ledger</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Sub Ledger</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Ledger Narration</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Is Reversal</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Payment Mode</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Instrument No.</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Instrument Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Drawn On</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Cheque Label</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Reference</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Remarks</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">Balance</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider text-right whitespace-nowrap">Expense (Dr)</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider text-right whitespace-nowrap">Income (Cr)</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-black uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-4 px-6 font-bold text-slate-500 text-xs">{index + 1}</td>
                    <td className="py-4 px-6 font-bold text-indigo-600">{row.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-900">{row.name || 'Sample Site'}</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">{row.date}</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">Sample Bank</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">Sample GL</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">Sample SL</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">No</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">Cheque/RTGS</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600 uppercase">N/A</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">-</td>
                    <td className="py-4 px-6 font-semibold text-slate-600">0.00</td>
                    <td className="py-4 px-6 font-black text-black text-right">₹{(row.amount || 0).toLocaleString("en-IN")}</td>
                    <td className="py-4 px-6 font-black text-black text-right">₹0</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setModalMode("view"); setActiveId(row.id); setShowModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View"><Eye size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setModalMode("edit"); setActiveId(row.id); setShowModal(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteVoucher(row.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="21" className="py-12 text-center text-slate-500 font-semibold">No vouchers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* General Voucher Full Screen Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm overflow-hidden p-4 sm:p-6">
          <div className="w-full max-w-[1100px] bg-white rounded-3xl shadow-2xl flex flex-col max-h-full font-sans text-sm sm:text-base text-slate-900 border border-slate-200 overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{modalMode === 'view' ? 'View General Voucher' : modalMode === 'edit' ? 'Edit General Voucher' : 'Add: General Voucher'}</h3>
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

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 sm:space-y-8 bg-slate-50/50 custom-scrollbar">

              <fieldset disabled={modalMode === "view"} className={`min-w-0 border-0 p-0 m-0 ${modalMode === "view" ? "opacity-80 pointer-events-none" : ""}`}>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                  {/* 1. Document Information */}
                  <div className="xl:col-span-3">

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
                                <input type="text" list="gv-owner-sites" placeholder="Enter Owner Site" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm hide-datalist-arrow" />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                <datalist id="gv-owner-sites">
                                </datalist>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Voucher No. <span className="text-red-500">*</span></label>
                              <div className="flex-1 relative">
                                <input type="text" placeholder="General Voucher" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Cash/Bank <span className="text-red-500">*</span></label>
                              <div className="flex-1 relative">
                                <input type="text" list="gv-cash-banks" placeholder="Enter Cash/Bank" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm bg-white hide-datalist-arrow" />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                <datalist id="gv-cash-banks">
                                </datalist>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Remarks</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Date <span className="text-red-500">*</span></label>
                              <div className="flex-1 relative">
                                <input type="date" className="w-full border border-slate-300 rounded-lg pl-3 pr-4 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" defaultValue={new Date().toISOString().split('T')[0]} />
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Reference</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Balance</label>
                              <div className="flex-1 relative">
                                <input type="text" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm bg-slate-50" readOnly />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" size={16} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* 2. Expense/Income Detail */}
                  <div className="xl:col-span-3">
                    <details className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 group" open>
                      <summary className="flex items-center justify-between cursor-pointer list-none border-b border-slate-100 pb-3 mb-4 select-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500"><Layers size={18} /></span>
                          <h4 className="text-base sm:text-lg font-bold text-slate-900">Expense/Income Detail</h4>
                        </div>
                        <ChevronDown size={20} className="text-slate-500 group-open:rotate-180 transition-transform duration-300" />
                      </summary>
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">

                        <div className="flex justify-end items-center mb-4 gap-6">
                          <button onClick={addRow} className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 text-sm bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors shadow-sm">
                            <Plus size={16} /> Add Row
                          </button>
                          <div className="flex items-center gap-2">
                            <label className="font-extrabold text-slate-900 text-base">Net Amount:</label>
                            <input type="text" className="w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                            <AlertCircle className="text-amber-500" size={18} />
                            <CheckCircle2 className="text-emerald-500" size={18} />
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">

                          <div className="overflow-x-auto custom-scrollbar pb-2">
                            <table className="w-full text-left whitespace-nowrap min-w-[1200px]">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 w-12 text-center">...</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[200px]">General ledger</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Sub Ledger</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 min-w-[150px]">Ledger Narration</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 text-center w-32">Is Reversal</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 text-left w-36">Expense (Dr)</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 text-left w-36">Income (Cr)</th>
                                  <th className="px-4 py-3 text-base font-semibold text-slate-700 text-center w-24"></th>
                                  <th className="px-4 py-3 w-40 text-center"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {rows.map((row, index) => (
                                  <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-3 text-center text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600">
                                      <span className="flex flex-col items-center gap-0.5 justify-center w-full h-full">
                                        <span className="w-1 h-1 rounded-full bg-current"></span>
                                        <span className="w-1 h-1 rounded-full bg-current"></span>
                                        <span className="w-1 h-1 rounded-full bg-current"></span>
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="relative">
                                        <input type="text" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-all" placeholder="Select..." />
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <input type="text" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-all" />
                                    </td>
                                    <td className="p-3">
                                      <input type="text" className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-all" />
                                    </td>
                                    <td className="p-3">
                                      <select className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-semibold text-slate-900 cursor-pointer text-center appearance-none shadow-sm transition-all">
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      <input type="number" min="0" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} step="0.01" value={index === 0 ? enteredExpense : undefined} onChange={(e) => index === 0 && setEnteredExpense(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-black text-black text-left shadow-sm transition-all" placeholder="0.00" />
                                    </td>
                                    <td className="p-3">
                                      <input type="number" min="0" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} step="0.01" value={index === 0 ? enteredIncome : undefined} onChange={(e) => index === 0 && setEnteredIncome(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 px-4 py-2.5 text-base font-black text-black text-left shadow-sm transition-all" placeholder="0.00" />
                                    </td>
                                    <td className="p-3 text-center">
                                      <button className="bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all">Site</button>
                                    </td>
                                    <td className="p-2 flex items-center justify-center gap-2 px-3 h-14">
                                      <button className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all">Cheque/RTGS</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="bg-slate-50 border-t border-slate-200 p-3 px-6 flex items-center justify-end">
                            <div className="flex items-center gap-8">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-600">Record Count:</span>
                                <span className="text-base font-black text-black">{rows.length}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-600">Total Amount (Dr):</span>
                                <span className="text-lg font-black text-black bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm w-32 text-right">
                                  {enteredExpense ? Number(enteredExpense).toFixed(2) : "0.00"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-600">Total Amount (Cr):</span>
                                <span className="text-lg font-black text-black bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm w-32 text-right">
                                  {enteredIncome ? Number(enteredIncome).toFixed(2) : "0.00"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* 3. Payment Information */}
                  <div className="xl:col-span-3">
                    <details className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 group" open>
                      <summary className="flex items-center justify-between cursor-pointer list-none border-b border-slate-100 pb-3 mb-4 select-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600"><ShieldCheck size={18} /></span>
                          <h4 className="text-base sm:text-lg font-bold text-slate-900">Payment Information</h4>
                        </div>
                        <ChevronDown size={20} className="text-slate-500 group-open:rotate-180 transition-transform duration-300" />
                      </summary>
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Payment Mode</label>
                              <div className="flex-1 relative">
                                <input type="text" list="gv-payment-modes" className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm hide-datalist-arrow" />
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                <datalist id="gv-payment-modes">
                                </datalist>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Cheque Label</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Instrument No.</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Drawn On</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Instrument Date</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <label className="sm:w-32 font-bold text-slate-800">Reference</label>
                              <input type="text" className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

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
                    if (modalMode !== 'view') toast.error("General Voucher Cancelled", { duration: 3000, id: "cancel" });
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
                          amount: Number(enteredExpense) || 0
                        } : v));
                        toast.success("General Voucher Updated Successfully!", { duration: 3000 });
                      } else {
                        const newVoucher = {
                          id: `GV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                          name: "Sample Entry",
                          refInv: "N/A",
                          date: new Date().toLocaleDateString('en-GB'),
                          status: "Open",
                          amount: Number(enteredExpense) || 0
                        };
                        setVouchers([...vouchers, newVoucher]);
                        toast.success("General Voucher Saved Successfully!", { duration: 3000 });
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
    </div>
  );
}


