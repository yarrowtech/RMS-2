import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  Smartphone,
  CreditCard,
  Banknote,
  LayoutGrid,
  Download,
  Eye,
  Edit2,
  Trash2,
  MoreHorizontal,
  Search,
  Plus,
} from "lucide-react";
import { FaMoneyBillWave, FaMobileAlt } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm min-w-0">
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

const getDynamicDate = (daysAgo, timeString) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${day}, ${timeString}`;
};

export default function FinanceRevenue() {
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString("en-US", { month: "long" }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [breakdownPeriod, setBreakdownPeriod] = useState("monthly");
  const [selectedDailyDate, setSelectedDailyDate] = useState("");

  // New payment form states styled consistently with Expense Vouchers
  const [showAddModal, setShowAddModal] = useState(false);
  const [formTxnId, setFormTxnId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState("UPI");
  const [formSource, setFormSource] = useState("POS Terminal 1");
  const [formDate, setFormDate] = useState("");

  const handleOpenAddModal = () => {
    const nextNum = transactions.length > 0
      ? Math.max(...transactions.map(t => parseInt(t.id.replace("TXN-", "")) || 0)) + 1
      : 9022;
    setFormTxnId(`TXN-${nextNum}`);
    setFormAmount("");
    setFormMethod("UPI");
    setFormSource("POS Terminal 1");

    const now = new Date();
    const formattedDate = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    setFormDate(formattedDate);
    setShowAddModal(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formAmount || isNaN(formAmount) || parseFloat(formAmount) <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    const newTxn = {
      id: formTxnId,
      source: formSource,
      method: formMethod,
      date: formDate,
      amount: parseFloat(formAmount),
    };

    setTransactions((prev) => [newTxn, ...prev]);
    setShowAddModal(false);
    setFormAmount("");
    
  };

  const [transactions, setTransactions] = useState([]);

  const handleDeleteTransaction = (id) => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-lg rounded-2xl border border-slate-200 pointer-events-auto flex flex-col gap-2 p-4`}>
        <span className="text-sm font-bold text-slate-800">
          Are you sure you want to delete <span className="font-mono text-indigo-600">{id}</span>?
        </span>
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={() => {
              setTransactions((prev) => prev.filter((txn) => txn.id !== id));
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

  const searchedTransactions = useMemo(() => {
    const filtered = transactions.filter(txn => {
      const matchSearch = searchQuery.trim() === "" ||
        txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.method.toLowerCase().includes(searchQuery.toLowerCase());

      // 3. Month & Year filter
      const txnMonth = txn.date.split(" ")[0]; // "May"
      const txnYear = new Date().getFullYear().toString(); // "2026"

      const matchMonth = selectedMonth === "All Months" ||
        txnMonth.toLowerCase().startsWith(selectedMonth.toLowerCase().substring(0, 3));
      const matchYear = selectedYear === "All Years" || txnYear === selectedYear;

      return matchSearch && matchMonth && matchYear;
    });

    // Always sort descending by transaction ID so that newest entries appear at the very top!
    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.id.replace("TXN-", "")) || 0;
      const numB = parseInt(b.id.replace("TXN-", "")) || 0;
      return numB - numA;
    });
  }, [searchQuery, selectedMonth, selectedYear, transactions]);

  const uniqueDates = useMemo(() => {
    const dates = searchedTransactions.map(t => t.date.split(",")[0].trim());
    return [...new Set(dates)];
  }, [searchedTransactions]);

  const allDaysInMonth = useMemo(() => {
    if (selectedMonth === "All Months" || selectedYear === "All Years") {
      return [];
    }
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(selectedMonth);
    if (monthIndex === -1) return [];

    const yearNum = parseInt(selectedYear);
    const date = new Date(yearNum, monthIndex + 1, 0);
    const numDays = date.getDate();

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonthIndex = today.getMonth();
    const todayDate = today.getDate();

    const days = [];
    const shortMonth = new Date(yearNum, monthIndex, 1).toLocaleString("en-US", { month: "short" });
    for (let i = 1; i <= numDays; i++) {
      const isFuture =
        yearNum > todayYear ||
        (yearNum === todayYear && monthIndex > todayMonthIndex) ||
        (yearNum === todayYear && monthIndex === todayMonthIndex && i > todayDate);

      if (!isFuture) {
        days.push(`${shortMonth} ${i}`);
      }
    }
    return days;
  }, [selectedMonth, selectedYear]);

  const activeDaysList = useMemo(() => {
    if (allDaysInMonth.length > 0) return allDaysInMonth;
    return uniqueDates;
  }, [allDaysInMonth, uniqueDates]);

  useEffect(() => {
    if (activeDaysList.length > 0) {
      if (!selectedDailyDate || !activeDaysList.includes(selectedDailyDate)) {
        const today = new Date();
        const currentShortMonth = today.toLocaleString("en-US", { month: "short" });
        const currentDay = today.getDate();
        const todayStr = `${currentShortMonth} ${currentDay}`;

        if (activeDaysList.includes(todayStr)) {
          setSelectedDailyDate(todayStr);
        } else {
          setSelectedDailyDate(activeDaysList[0]);
        }
      }
    } else {
      setSelectedDailyDate("");
    }
  }, [activeDaysList, selectedDailyDate]);

  const activeLimit = useMemo(() => Math.min(limit, 10), [limit]);

  const filteredTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * activeLimit;
    return searchedTransactions.slice(startIndex, startIndex + activeLimit);
  }, [searchedTransactions, currentPage, activeLimit]);

  const totalPages = Math.ceil(searchedTransactions.length / activeLimit);

  // Reset page when search query, limit, or month/year changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, limit, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    // 1. Monthly (Filtered) calculations
    let total = searchedTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    let cash = searchedTransactions.filter(t => t.method === "Cash").reduce((acc, curr) => acc + curr.amount, 0);
    let card = searchedTransactions.filter(t => t.method === "Card").reduce((acc, curr) => acc + curr.amount, 0);
    let upi = searchedTransactions.filter(t => t.method === "UPI").reduce((acc, curr) => acc + curr.amount, 0);

    // 2. Daily calculations for the selected daily date
    const latestDateInList = searchedTransactions.length > 0
      ? searchedTransactions[0].date.split(",")[0].trim()
      : "";

    const activeDailyDate = selectedDailyDate || latestDateInList;

    const dailyTxns = searchedTransactions.filter(t => t.date.split(",")[0].trim() === activeDailyDate);

    let dailyTotal = dailyTxns.reduce((acc, curr) => acc + curr.amount, 0);
    let dailyCash = dailyTxns.filter(t => t.method === "Cash").reduce((acc, curr) => acc + curr.amount, 0);
    let dailyCard = dailyTxns.filter(t => t.method === "Card").reduce((acc, curr) => acc + curr.amount, 0);
    let dailyUpi = dailyTxns.filter(t => t.method === "UPI").reduce((acc, curr) => acc + curr.amount, 0);

    return {
      // Monthly values
      total: `₹${total.toLocaleString("en-IN")}`,
      cash: `₹${cash.toLocaleString("en-IN")}`,
      card: `₹${card.toLocaleString("en-IN")}`,
      upi: `₹${upi.toLocaleString("en-IN")}`,

      // Daily values
      dailyTotal: `₹${dailyTotal.toLocaleString("en-IN")}`,
      dailyCash: `₹${dailyCash.toLocaleString("en-IN")}`,
      dailyCard: `₹${dailyCard.toLocaleString("en-IN")}`,
      dailyUpi: `₹${dailyUpi.toLocaleString("en-IN")}`,

      latestDate: activeDailyDate,
    };
  }, [searchedTransactions, selectedDailyDate]);

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // Header styling
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 595, 80, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("RMS - REVENUE REPORT", 40, 48);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(225, 29, 72); // rose-600 (highly visible highlight)
    doc.text(`PERIOD: ${selectedMonth.toUpperCase()} ${selectedYear}`, 555, 48, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text("Financial Management Department", 40, 64);

    // Metadata
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REPORT OVERVIEW", 40, 115);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 135);
    doc.text(`Search Query: ${searchQuery || "All Transactions"}`, 40, 150);
    doc.text(`Visible Entries: ${limit}`, 40, 165);

    // Summary Cards block
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(300, 100, 255, 85, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY METRICS", 315, 118);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Filtered Sales: ${stats.total.replace("₹", "Rs. ")}`, 315, 138);
    doc.text(`Cash: ${stats.cash.replace("₹", "Rs. ")} | Card: ${stats.card.replace("₹", "Rs. ")}`, 315, 153);
    doc.text(`UPI: ${stats.upi.replace("₹", "Rs. ")}`, 315, 168);

    const tableData = searchedTransactions.map(row => [
      row.id,
      row.source,
      row.method,
      row.date,
      `Rs. ${row.amount.toLocaleString("en-IN")}`
    ]);

    autoTable(doc, {
      startY: 210,
      head: [["Transaction ID", "Source", "Method", "Date & Time", "Amount"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229], fontStyle: "bold" }, // indigo-600
      styles: { fontSize: 9, font: "helvetica" },
      columnStyles: {
        4: { halign: "right" }
      }
    });

    doc.save("Revenue_Analysis_Report.pdf");
    
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center sm:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Banknote size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">All Monthly Revenue</h1>
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
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-md cursor-pointer"
            >
              <Download size={16} />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition shadow-md cursor-pointer"
            >
              <Plus size={16} />
              <span>New Payment</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Header & Breakdown Toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-300 pb-3">
          <h2 className="text-sm font-extrabold text-black uppercase tracking-wider">
            {breakdownPeriod === "monthly" ? "Monthly" : `Daily (${stats.latestDate || "Today"})`} Sales Breakdown
          </h2>
          <div className="flex items-center gap-2">
            {breakdownPeriod === "daily" && activeDaysList.length > 0 && (
              <select
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="bg-white text-slate-800 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer hover:bg-slate-50 hover:border-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition duration-200 shadow-sm"
              >
                {activeDaysList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            <div className="inline-flex rounded-xl bg-slate-200 p-1 border border-slate-350 shadow-sm backdrop-blur-md">
              <button
                onClick={() => setBreakdownPeriod("monthly")}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition duration-200 cursor-pointer ${breakdownPeriod === "monthly"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-900 hover:bg-slate-300"
                  }`}
              >
                Monthly View
              </button>
              <button
                onClick={() => setBreakdownPeriod("daily")}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition duration-200 cursor-pointer ${breakdownPeriod === "daily"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-900 hover:bg-slate-300"
                  }`}
              >
                Daily View
              </button>
            </div>
          </div>
        </div>

        {/* 5 KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            title={stats.latestDate ? `Daily Sales (${stats.latestDate})` : "Daily Sales"}
            value={stats.dailyTotal}
            icon={<TrendingUp size={16} />}
            iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80"
          />
          <KPICard
            title={breakdownPeriod === "monthly" ? "Monthly Cash Sales" : `Cash Sales (${stats.latestDate || "Daily"})`}
            value={breakdownPeriod === "monthly" ? stats.cash : stats.dailyCash}
            icon={<FaMoneyBillWave size={16} />}
            iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80"
          />
          <KPICard
            title={breakdownPeriod === "monthly" ? "Monthly Card Sales" : `Card Sales (${stats.latestDate || "Daily"})`}
            value={breakdownPeriod === "monthly" ? stats.card : stats.dailyCard}
            icon={<CreditCard size={16} />}
            iconColor="bg-blue-500/10 text-blue-400 border border-blue-500/20"
            color="bg-blue-950/95 border-blue-400 shadow-blue-950/80"
          />
          <KPICard
            title={breakdownPeriod === "monthly" ? "Monthly UPI Sales" : `UPI Sales (${stats.latestDate || "Daily"})`}
            value={breakdownPeriod === "monthly" ? stats.upi : stats.dailyUpi}
            icon={<FaMobileAlt size={16} />}
            iconColor="bg-amber-50/10 text-amber-450 border border-amber-500/20"
            color="bg-amber-950/95 border-amber-400 shadow-amber-950/80"
          />
          <KPICard
            title="Total Collection"
            value={breakdownPeriod === "monthly" ? stats.total : stats.dailyTotal}
            icon={<LayoutGrid size={16} />}
            iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20"
            color="bg-rose-950/95 border-rose-400 shadow-rose-950/80"
          />
        </div>

        {/* Recent Revenue Table Section */}
        <SectionCard
          title="Recent Revenue Transactions"
          badge={`Showing ${filteredTransactions.length} items`}
        >
          {/* Table Toolbar: Search bar and entries selector */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4 border-b border-slate-100 pb-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, source, or method..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                <Search size={14} />
              </div>
            </div>

            {/* Entries Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-950 font-bold">
                  <th className="py-3 px-4 font-bold">Transaction ID</th>
                  <th className="py-3 px-4 font-bold">Source</th>
                  <th className="py-3 px-4 text-center font-bold">Method</th>
                  <th className="py-3 px-4 font-bold">Date & Time</th>
                  <th className="py-3 px-4 text-right font-bold">Amount</th>
                  <th className="py-3 px-4 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{row.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{row.source}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-900 border border-slate-200">
                          {row.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-semibold">{row.date}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">₹{row.amount.toLocaleString("en-IN")}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedTxn(row)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          
                          <button
                            onClick={() => {
                              // Re-using the New Transaction modal for editing
                              setSelectedTxn(row);
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit2 size={18} />
                          </button>

                          <button
                            onClick={() => handleDeleteTransaction(row.id)}
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
                    <td colSpan="6" className="py-8 text-center text-sm font-bold text-slate-400">
                      No transactions matched the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {searchedTransactions.length > 10 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 mt-2">
              <span className="text-xs font-semibold text-slate-800">
                Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * activeLimit + 1}</span> to{" "}
                <span className="text-slate-900 font-bold">
                  {Math.min(currentPage * activeLimit, searchedTransactions.length)}
                </span>{" "}
                of <span className="text-slate-900 font-bold">{searchedTransactions.length}</span> entries
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

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300"
          onClick={() => setSelectedTxn(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
              <button
                onClick={() => setSelectedTxn(null)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition text-xs cursor-pointer"
              >
                âœ•
              </button>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-4">
              {/* Top Amount Banner */}
              <div className="flex flex-col items-center justify-center py-4 rounded-xl border border-emerald-150 bg-emerald-50/50">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Revenue Inward</span>
                <h4 className="text-2xl font-black mt-0.5 text-emerald-600">
                  +₹{selectedTxn.amount.toLocaleString("en-IN")}
                </h4>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-[9px] font-bold text-slate-850 uppercase tracking-wider">Transaction ID</span>
                  <p className="mt-0.5 text-xs font-mono font-bold text-slate-900">{selectedTxn.id}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-850 uppercase tracking-wider">Source / Terminal</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-900">{selectedTxn.source}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-850 uppercase tracking-wider">Payment Method</span>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900">{selectedTxn.method}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-850 uppercase tracking-wider">Date & Time</span>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900">{selectedTxn.date}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 border-t border-slate-150 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedTxn(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Payment Modal - Designed consistently with Expenses */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-6 shadow-2xl transition-all duration-300 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-extrabold text-slate-900">Add New Payment</h3>
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                {formTxnId}
              </span>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-black uppercase tracking-wider">Amount (Rs.)</label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 placeholder-slate-400"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-black uppercase tracking-wider">Payment Method</label>
                <select
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-black uppercase tracking-wider">Source / Terminal</label>
                <select
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="POS Terminal 1">POS Terminal 1</option>
                  <option value="POS Terminal 2">POS Terminal 2</option>
                  <option value="POS Terminal 3">POS Terminal 3</option>
                  <option value="Online Store">Online Store</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-black uppercase tracking-wider">Date & Time (Automatic)</label>
                <input
                  type="text"
                  value={formDate}
                  disabled
                  className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 font-bold cursor-not-allowed"
                  required
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-md"
                >
                  Add Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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








