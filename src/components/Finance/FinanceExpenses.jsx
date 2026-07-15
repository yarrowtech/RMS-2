import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Zap,
  Settings,
  Briefcase,
  Megaphone,
  MoreHorizontal,
  ArrowDownRight,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Download,
  Search,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

const categoryConfigs = {
  Rent: {
    icon: <CreditCard size={16} />,
    iconColor: "bg-green-500/10 text-green-400 border border-green-500/20",
    glowGradient: "from-green-400 via-emerald-500 to-teal-600",
    cardBg: "bg-emerald-950/95 border-emerald-500/40 shadow-emerald-950/70"
  },
  Electricity: {
    icon: <Zap size={16} />,
    iconColor: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    glowGradient: "from-cyan-400 via-teal-500 to-emerald-600",
    cardBg: "bg-blue-950/95 border-blue-500/40 shadow-blue-950/70"
  },
  Maintenance: {
    icon: <Settings size={16} />,
    iconColor: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    glowGradient: "from-blue-400 via-indigo-500 to-violet-600",
    cardBg: "bg-blue-950/95 border-blue-500/40 shadow-blue-950/70"
  },
  "Office Supplies": {
    icon: <Briefcase size={16} />,
    iconColor: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    glowGradient: "from-yellow-400 via-amber-500 to-orange-600",
    cardBg: "bg-amber-950/95 border-amber-500/30 shadow-amber-950/60"
  },
  "Office Cost": {
    icon: <Briefcase size={16} />,
    iconColor: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
    glowGradient: "from-yellow-400 via-amber-500 to-orange-600",
    cardBg: "bg-amber-950/95 border-amber-500/30 shadow-amber-950/60"
  },
  Marketing: {
    icon: <Megaphone size={16} />,
    iconColor: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    glowGradient: "from-violet-400 via-fuchsia-500 to-pink-600",
    cardBg: "bg-violet-950/95 border-violet-500/40 shadow-violet-950/70"
  },
  "Marketing Cost": {
    icon: <Megaphone size={16} />,
    iconColor: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    glowGradient: "from-violet-400 via-fuchsia-500 to-pink-600",
    cardBg: "bg-violet-950/95 border-violet-500/40 shadow-violet-950/70"
  },
  Miscellaneous: {
    icon: <MoreHorizontal size={16} />,
    iconColor: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    glowGradient: "from-red-500 via-rose-500 to-amber-500",
    cardBg: "bg-rose-950/95 border-rose-500/40 shadow-rose-950/70"
  }
};

const getCategoryConfig = (catName) => {
  const normalized = catName.trim();
  if (categoryConfigs[normalized]) return categoryConfigs[normalized];

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % 5;
  const fallbacks = [
    {
      icon: <ArrowDownRight size={16} />,
      iconColor: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
      glowGradient: "from-teal-400 via-emerald-500 to-cyan-500",
      cardBg: "bg-teal-950/95 border-teal-500/40 shadow-teal-950/70"
    },
    {
      icon: <ArrowDownRight size={16} />,
      iconColor: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      glowGradient: "from-amber-400 via-orange-500 to-yellow-600",
      cardBg: "bg-amber-950/95 border-amber-500/40 shadow-amber-950/70"
    },
    {
      icon: <ArrowDownRight size={16} />,
      iconColor: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
      glowGradient: "from-pink-400 via-rose-500 to-red-600",
      cardBg: "bg-pink-950/95 border-pink-500/40 shadow-pink-950/70"
    },
    {
      icon: <ArrowDownRight size={16} />,
      iconColor: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
      glowGradient: "from-cyan-400 via-blue-500 to-indigo-600",
      cardBg: "bg-cyan-950/95 border-cyan-500/40 shadow-cyan-950/70"
    },
    {
      icon: <ArrowDownRight size={16} />,
      iconColor: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
      glowGradient: "from-indigo-400 via-purple-500 to-fuchsia-600",
      cardBg: "bg-indigo-950/95 border-indigo-500/40 shadow-indigo-950/70"
    }
  ];
  return fallbacks[index];
};

function ExpenseCard({ title, value, icon, iconColor, cardBg }) {
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
          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function FinanceExpenses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Advanced filters state
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString("en-US", { month: "long" }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [voucherId, setVoucherId] = useState("");
  const [category, setCategory] = useState("Rent");
  const [status, setStatus] = useState("Paid");
  const [amount, setAmount] = useState("");
  const [voucherFromDate, setVoucherFromDate] = useState("");
  const [voucherToDate, setVoucherToDate] = useState("");

  const [vouchers, setVouchers] = useState([]);

  // Dynamic Vouchers filter by Search and Paid/Unpaid Status query
  const searchedVouchers = useMemo(() => {
    const filtered = vouchers.filter(v => {
      // 1. Search query
      const matchSearch = searchQuery.trim() === "" ||
        v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.cat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.status.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Status match (All, Paid, Unpaid)
      const matchStatus = statusFilter === "All" ||
        (statusFilter === "Paid" && v.status.toLowerCase() === "paid") ||
        (statusFilter === "Unpaid" && v.status.toLowerCase() !== "paid");

      // 3. Month & Year filter (dynamic from locks!)
      const vDate = new Date(v.fromDate);
      const vMonth = vDate.toLocaleString("en-US", { month: "long" });
      const vYear = vDate.getFullYear().toString();

      const matchMonth = selectedMonth === "All Months" || vMonth === selectedMonth;
      const matchYear = selectedYear === "All Years" || vYear === selectedYear;

      return matchSearch && matchStatus && matchMonth && matchYear;
    });

    // Always sort descending by voucher ID so that newest entries appear at the very top!
    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.id.replace("VOU-", "")) || 0;
      const numB = parseInt(b.id.replace("VOU-", "")) || 0;
      return numB - numA;
    });
  }, [searchQuery, statusFilter, selectedMonth, selectedYear, vouchers]);

  // Strict Max 10 per page limit cap
  const activeLimit = useMemo(() => Math.min(limit, 10), [limit]);

  const filteredVouchers = useMemo(() => {
    const startIndex = (currentPage - 1) * activeLimit;
    return searchedVouchers.slice(startIndex, startIndex + activeLimit);
  }, [searchedVouchers, currentPage, activeLimit]);

  const totalPages = Math.ceil(searchedVouchers.length / activeLimit);

  // Reset page when search, limit, status, or month/year filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, limit, statusFilter, selectedMonth, selectedYear]);

  // Dynamic calculations for all cards (reflects selected Month & Year!)
  const stats = useMemo(() => {
    const categoryTotals = {};

    // Initialize default categories with 0 to ensure they are always present!
    const defaultCats = ["Rent", "Electricity", "Maintenance", "Office Supplies", "Marketing", "Miscellaneous"];
    defaultCats.forEach(c => {
      categoryTotals[c] = 0;
    });

    // Accumulate actual amounts from searchedVouchers
    searchedVouchers.forEach(v => {
      let cat = v.cat.trim();
      // Map legacy names to match default categories perfectly!
      if (cat === "Office Cost") cat = "Office Supplies";
      if (cat === "Marketing Cost") cat = "Marketing";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + v.amount;
    });

    const total = searchedVouchers.reduce((sum, v) => sum + v.amount, 0);

    return {
      categoryTotals,
      total: `Rs. ${total.toLocaleString("en-IN")}`,
      totalVal: total,
    };
  }, [searchedVouchers]);

  // Toast-based delete confirmation popup
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
              toast.dismiss(t.id)
              
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

  const handleOpenAddModal = () => {
    setIsEditing(false);
    // Auto-generate next voucher sequence ID
    const nextNum = vouchers.length > 0
      ? Math.max(...vouchers.map(v => parseInt(v.id.replace("VOU-", "")))) + 1
      : 1001;
    setVoucherId(`VOU-${nextNum}`);
    setCategory("Rent");
    setStatus("Pending"); // Default to pending
    setAmount("");
    const today = new Date().toISOString().split('T')[0];
    setVoucherFromDate(today);
    setVoucherToDate("Pending");
    setModalOpen(true);
  };

  const handleOpenEditModal = (voucher) => {
    setIsEditing(true);
    setVoucherId(voucher.id);
    setCategory(voucher.cat);
    setStatus(voucher.status);
    setAmount(voucher.amount.toString());
    const today = new Date().toISOString().split('T')[0];
    setVoucherFromDate(voucher.fromDate || today);
    setVoucherToDate(voucher.toDate || "Pending");
    setModalOpen(true);
  };

  const handleSaveVoucher = (e) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount!");
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // "jedin entry marbo sedin from date"
    // "jedin paid korbo sedin to date"
    const finalFromDate = isEditing
      ? (voucherFromDate || today)
      : today; // Entry day is today!

    const finalToDate = status.toLowerCase() === 'paid'
      ? (isEditing && vouchers.find(v => v.id === voucherId)?.status?.toLowerCase() === 'paid'
        ? voucherToDate // Keep existing payment date if it was already paid
        : today) // Set payment date to today!
      : "Pending"; // Otherwise it is pending!

    if (isEditing) {
      setVouchers((prev) =>
        prev.map((v) =>
          v.id === voucherId
            ? { ...v, cat: category, status: status, amount: Number(amount), fromDate: finalFromDate, toDate: finalToDate }
            : v
        )
      );
      
    } else {
      setVouchers((prev) => [
        ...prev,
        { id: voucherId, cat: category, status: status, amount: Number(amount), fromDate: finalFromDate, toDate: finalToDate },
      ]);
      
    }
    setModalOpen(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 595, 80, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("RMS - EXPENSE STATEMENT", 40, 48);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`PERIOD: ${selectedMonth.toUpperCase()} ${selectedYear}`, 555, 48, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175);
    doc.text("Financial Management Department", 40, 64);

    // Info block
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("STATEMENT OVERVIEW", 40, 115);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 135);
    doc.text(`Filter Search: ${searchQuery || "None"}`, 40, 150);

    // Summary box (Rupee ₹ replaced with Rs. to prevent superscript bugs!)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(300, 100, 255, 85, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY ANALYSIS", 315, 118);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Expense Cost: Rs. ${stats.totalVal.toLocaleString("en-IN")}`, 315, 138);
    doc.text(`Total Vouchers: ${vouchers.length}`, 315, 153);
    doc.text(`Projected Monthly Limit: Rs. 12,00,000`, 315, 168);

    const tableData = searchedVouchers.map(row => [
      row.id,
      row.cat,
      row.fromDate || "N/A",
      row.toDate || "N/A",
      row.status,
      `Rs. ${row.amount.toLocaleString("en-IN")}`
    ]);

    autoTable(doc, {
      startY: 210,
      head: [["Voucher No", "Category", "From Date", "To Date", "Status", "Amount"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [225, 29, 72] }, // rose-600 color
      styles: { fontSize: 9, font: "helvetica" },
      columnStyles: {
        5: { halign: "right" }
      }
    });

    doc.save("Expense_Tracking_Report.pdf");
    
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title & Actions Block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center sm:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <CreditCard size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">All Monthly Expenses</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Changeable Month & Year Selects next to Export PDF */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-50 hover:border-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition duration-200"
              >
                <option value="All Months" className="text-slate-800 font-bold bg-white">All Months</option>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => (
                  <option key={m} value={m} className="text-slate-800 font-bold bg-white">{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-50 hover:border-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition duration-200"
              >
                <option value="All Years" className="text-slate-800 font-bold bg-white">All Years</option>
                {["2025", "2026", "2027", "2028", "2029", "2030"].map(y => (
                  <option key={y} value={y} className="text-slate-800 font-bold bg-white">{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-md cursor-pointer"
            >
              <Download size={16} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* Dynamic Expense Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6">
          {Object.entries(stats.categoryTotals).map(([catName, amount]) => {
            const config = getCategoryConfig(catName);
            return (
              <ExpenseCard
                key={catName}
                title={catName}
                value={`Rs. ${amount.toLocaleString("en-IN")}`}
                icon={config.icon}
                iconColor={config.iconColor}
                glowGradient={config.glowGradient}
                cardBg={config.cardBg}
              />
            );
          })}
        </div>        {/* Lower Section Cards */}
        <div className="w-full">
          {/* Recent Expense Vouchers Table */}
          <div className="w-full">
            <SectionCard
              title="Expense Vouchers"
              badge={`Showing ${searchedVouchers.length} items`}
            >
              {/* Table Toolbar: Search bar and filters styled exactly like Revenue */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4 border-b border-slate-100 pb-4">
                {/* Search Input Box */}
                <div className="flex items-center w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search voucher, category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    />
                    <div className="absolute left-3 top-2.5 text-slate-400">
                      <Search size={14} />
                    </div>
                  </div>
                </div>

                {/* Filters & Limit selectors grouped on the right */}
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                  {/* Status filter selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-black uppercase tracking-wider">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer shadow-sm"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid / Pending</option>
                    </select>
                  </div>

                  {/* Limit Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-black uppercase tracking-wider">Show:</span>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer shadow-sm"
                    >
                      <option value={5}>5 entries</option>
                      <option value={10}>10 entries</option>
                      <option value={20}>20 entries</option>
                      <option value={30}>30 entries</option>
                      <option value={50}>50 entries</option>
                      <option value={100}>100 entries</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-900 font-bold">
                      <th className="py-3 px-4 font-bold">Voucher No</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">From Date</th>
                      <th className="py-3 px-4 font-bold">To Date</th>
                      <th className="py-3 px-4 text-center font-bold">Status</th>
                      <th className="py-3 px-4 text-right font-bold">Amount</th>
                      <th className="py-3 px-4 text-center font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredVouchers.length > 0 ? (
                      filteredVouchers.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors duration-200">
                          <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{row.id}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-955">{row.cat}</td>
                          <td className="py-3.5 px-4 text-slate-800 font-semibold font-mono">
                            <div>{row.fromDate || "N/A"}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-semibold font-mono">
                            <div>{row.toDate || "N/A"}</div>
                            {row.fromDate && row.toDate && row.toDate !== "Pending" && (
                              <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700 border border-indigo-100 mt-1">
                                {Math.max(1, Math.round((new Date(row.toDate) - new Date(row.fromDate)) / (1000 * 60 * 60 * 24)))} Days Paid
                              </span>
                            )}
                            {row.fromDate && row.toDate === "Pending" && (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700 border border-amber-100 mt-1 animate-pulse">
                                {Math.max(0, Math.round((new Date() - new Date(row.fromDate)) / (1000 * 60 * 60 * 24)))} Days Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${row.status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-rose-600">Rs. {row.amount.toLocaleString("en-IN")}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedVoucher(row)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye size={18} />
                              </button>
                              
                              <button
                                onClick={() => handleOpenEditModal(row)}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Voucher"
                              >
                                <Edit2 size={18} />
                              </button>

                              <button
                                onClick={() => handleDeleteVoucher(row.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Voucher"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-sm font-bold text-slate-400">
                          No vouchers matched the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Pagination Controls */}
              {searchedVouchers.length > 10 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 mt-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * activeLimit + 1}</span> to{" "}
                    <span className="text-slate-900 font-bold">
                      {Math.min(currentPage * activeLimit, searchedVouchers.length)}
                    </span>{" "}
                    of <span className="text-slate-900 font-bold">{searchedVouchers.length}</span> entries
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-sm"
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer shadow-sm ${currentPage === pageNum
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

        </div>
      </div>

      {/* 1. VIEW VOUCHER DETAIL MODAL */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all duration-300 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-extrabold text-slate-900">Voucher Details</h3>
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                {selectedVoucher.id}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Category</span>
                <span className="text-sm font-black text-slate-950">{selectedVoucher.cat}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">From Date</span>
                <span className="text-sm font-black text-slate-950 font-mono">{selectedVoucher.fromDate || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">To Date</span>
                <span className="text-sm font-black text-slate-950 font-mono">{selectedVoucher.toDate || "N/A"}</span>
              </div>
              {selectedVoucher.fromDate && selectedVoucher.toDate && (
                <div className="flex justify-between border-b border-slate-50 pb-2.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Calculated Duration</span>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 font-mono">
                    {selectedVoucher.toDate === "Pending"
                      ? `${Math.max(0, Math.round((new Date() - new Date(selectedVoucher.fromDate)) / (1000 * 60 * 60 * 24)))} Days (Pending)`
                      : `${Math.max(1, Math.round((new Date(selectedVoucher.toDate) - new Date(selectedVoucher.fromDate)) / (1000 * 60 * 60 * 24)))} Days (Paid)`
                    }
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Status</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${selectedVoucher.status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                  {selectedVoucher.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Amount</span>
                <span className="text-sm font-black text-rose-600">Rs. {selectedVoucher.amount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD & EDIT VOUCHER FORM MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all duration-300 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-extrabold text-slate-900">
                {isEditing ? "Edit Voucher" : "Add Voucher"}
              </h3>
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                {voucherId}
              </span>
            </div>

            <form onSubmit={handleSaveVoucher} className="mt-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-black uppercase tracking-wider">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Rent, Electricity, Marketing..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 placeholder-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-wider">From Date</label>
                  <input
                    type="date"
                    value={voucherFromDate}
                    disabled
                    className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 font-bold cursor-not-allowed"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-wider">To Date</label>
                  {status.toLowerCase() === 'paid' ? (
                    <input
                      type="date"
                      value={voucherToDate && voucherToDate !== "Pending" ? voucherToDate : new Date().toISOString().split('T')[0]}
                      disabled
                      className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 font-bold cursor-not-allowed"
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value="Pending (Stamp on Paid)"
                      disabled
                      className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 font-bold cursor-not-allowed"
                    />
                  )}
                </div>
              </div>

              {/* Live duration calculation helper inside form */}
              {voucherFromDate && (
                <div className="text-[10px] font-black text-indigo-600 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/50 flex justify-between items-center font-mono">
                  <span>Voucher billing period:</span>
                  <span>
                    {status.toLowerCase() === 'paid'
                      ? `${Math.max(1, Math.round((new Date(voucherToDate && voucherToDate !== "Pending" ? voucherToDate : new Date().toISOString().split('T')[0]) - new Date(voucherFromDate)) / (1000 * 60 * 60 * 24)))} Days (Paid)`
                      : `${Math.max(0, Math.round((new Date() - new Date(voucherFromDate)) / (1000 * 60 * 60 * 24)))} Days Pending`
                    }
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-black uppercase tracking-wider">Status</label>
                <input
                  type="text"
                  placeholder="e.g. Paid, Pending, Processing..."
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 placeholder-slate-400"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-black uppercase tracking-wider">Amount (Rs.)</label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 placeholder-slate-400"
                  required
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-md"
                >
                  Save voucher
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


