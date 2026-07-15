import React, { useState, useMemo } from "react";
import {
  Users,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Plus,
  X,
  CreditCard,
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
  const finalBgColor = `bg-${baseColor}-200`;
  const finalIconColor = `bg-white text-${baseColor}-700`;

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
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function FinanceVendor() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add", "edit", "view"
  const [selectedVendor, setSelectedVendor] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");

  const [transactions, setTransactions] = useState([]);

  const stats = useMemo(() => {
    let settled = transactions.filter(t => t.status === "Paid").reduce((acc, curr) => acc + curr.amount, 0);
    let pending = transactions.filter(t => t.status !== "Paid").reduce((acc, curr) => acc + curr.amount, 0);
    let paidCount = transactions.filter(t => t.status === "Paid").length;
    let totalInvoices = transactions.reduce((acc, curr) => acc + curr.amount, 0);

    return {
      settled: `₹${settled.toLocaleString("en-IN")}`,
      pending: `₹${pending.toLocaleString("en-IN")}`,
      paidCount: paidCount.toString(),
      totalInvoices: `₹${totalInvoices.toLocaleString("en-IN")}`,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.inv.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const handlePayClick = (row) => {
    setSelectedVendor(row.name);
    setInvoiceNo(row.inv);
    setAmount(row.amount.toString());
    setModalMode("add");
    setShowModal(true);
  };

  const handleCreatePaymentClick = () => {
    setSelectedVendor("");
    setInvoiceNo(`INV-2026-00${transactions.length + 1}`);
    setAmount("");
    setModalMode("add");
    setShowModal(true);
  };

  const handleConfirmPayment = (e) => {
    e.preventDefault();
    if (!selectedVendor || !amount) {
      toast.error("Please fill in all details");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Check if invoice already exists
    const existingIndex = transactions.findIndex(t => t.inv === invoiceNo);
    if (existingIndex > -1) {
      const updated = [...transactions];
      updated[existingIndex] = {
        ...updated[existingIndex],
        status: "Paid"
      };
      setTransactions(updated);
      toast.success("Vendor transaction added successfully!", { duration: 3000 });
      setShowModal(false);
    } else {
      const newTxn = {
        name: selectedVendor,
        inv: invoiceNo,
        date: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Paid',
        amount: numericAmount
      };
      setTransactions([newTxn, ...transactions]);
      toast.success(`Processed settlement of ₹${numericAmount.toLocaleString("en-IN")} to ${selectedVendor}!`);
      setShowModal(false);
    }
  };

  const handleDeleteTransaction = (id) => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-2xl border border-slate-200 pointer-events-auto flex flex-col gap-2 p-4`}>
        <span className="text-sm font-bold text-slate-800">
          Are you sure you want to delete <span className="font-mono text-indigo-600">{id}</span>?
        </span>
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={() => {
              setTransactions((prev) => prev.filter((txn) => txn.inv !== id));
              toast.dismiss(t.id);
              setTimeout(() => toast.success(`Transaction deleted successfully!`, { duration: 3000 }), 100);

            }}
            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition cursor-pointer"
          >
            Yes
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            No
          </button>
        </div>
      </div>
    ), { duration: 3000, id: `delete-${id}` });
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Vendor Payments</h1>
              <p className="text-sm text-slate-500 mt-1 font-semibold">Manage supplier settlements and purchase obligations.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vendor..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all font-semibold"
              />
            </div>
            <button
              onClick={handleCreatePaymentClick}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-md"
            >
              <Plus size={16} />
              <span>Process Payment</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Supplier Payments" value={stats.settled} icon={<Users size={16} />} color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80" iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
          <KPICard title="Pending Dues" value={stats.pending} icon={<Clock size={16} />} color="bg-amber-950/95 border-amber-400 shadow-amber-950/80" iconColor="bg-amber-500/10 text-amber-400 border border-amber-500/20" />
          <KPICard title="Paid Bills" value={stats.paidCount} icon={<CheckCircle2 size={16} />} color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80" iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" />
          <KPICard title="Purchase Invoices" value={stats.totalInvoices} icon={<FileText size={16} />} color="bg-rose-950/95 border-rose-400 shadow-rose-950/80" iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20" />
        </div>

        <SectionCard
          title="Recent Vendor Transactions"
          badge={`Showing ${filteredTransactions.length} items`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                  <th className="py-3 px-4 font-bold">Vendor Name</th>
                  <th className="py-3 px-4 font-bold">Invoice #</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 text-center font-bold">Status</th>
                  <th className="py-3 px-4 text-right font-bold">Amount</th>
                  <th className="py-3 px-4 text-center font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-150 flex items-center justify-center text-xs font-extrabold text-indigo-700 shadow-sm">
                            {row.name.charAt(0)}
                          </div>
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-500 font-mono text-xs uppercase">{row.inv}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-semibold">{row.date}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${row.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                          row.status === 'Overdue' ? 'bg-rose-50 text-rose-700 border-rose-250' : 'bg-amber-50 text-amber-700 border-amber-250'
                          }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-black">₹{row.amount.toLocaleString("en-IN")}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setSelectedVendor(row.name); setInvoiceNo(row.inv); setAmount(row.amount.toString()); setModalMode("view"); setShowModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => { setSelectedVendor(row.name); setInvoiceNo(row.inv); setAmount(row.amount.toString()); setModalMode("edit"); setShowModal(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                            <Edit2 size={18} />
                          </button>
                          {row.status !== 'Paid' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAsPaid(row.inv); }}
                              className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 px-3 py-1.5">Settled</span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(row.inv); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-sm font-bold text-slate-400">
                      No vendor transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50/50 px-5 py-3.5 flex items-center justify-between border-t border-slate-200 mt-4 rounded-b-2xl">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Showing {filteredTransactions.length} vendors</p>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(n => (
                <button key={n} className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${n === 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-250 text-slate-600 hover:bg-slate-100'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Payment Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{modalMode === 'view' ? 'View Settlement' : modalMode === 'edit' ? 'Edit Settlement' : 'Process Settlement'}</h3>
                <p className="text-xs text-slate-500">Authorized payment disbursement portal.</p>
              </div>
            </div>

            <fieldset disabled={modalMode === "view"} className={`min-w-0 border-0 p-0 m-0 ${modalMode === "view" ? "opacity-80 pointer-events-none" : ""}`}>
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Vendor Name</label>
                  <input
                    type="text"
                    required
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    placeholder="Enter supplier name..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Invoice #</label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={invoiceNo}
                      className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">Amount (INR)</label>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="₹0.00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-md"
                  >
                    Confirm Settlement
                  </button>
                )}
              </form>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
}


