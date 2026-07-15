import React, { useState, useMemo } from "react";
import {
  Users,
  Wallet,
  Trophy,
  Calculator,
  History,
  FileSpreadsheet,
  AlertCircle,
  Download,
  X,
  CheckCircle,
  Clock,
  ChevronRight,
  Search,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

function KPICard({ title, value, icon, color, iconColor }) {
  return (
    <div className="relative min-h-[85px] bg-white rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer">
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

export default function FinancePayroll() {
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Dynamic state for ledger logs
  const [history, setHistory] = useState([]);

  // Incentives state
  const [incentivesList, setIncentivesList] = useState([]);

  const filteredIncentives = useMemo(() => {
    return incentivesList.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [incentivesList, searchTerm, statusFilter]);

  // Approved incentives total â€” computed live from the list (no separate state needed)
  const incentivesApprovedTotal = useMemo(() =>
    incentivesList.filter(i => i.status === "Approved").reduce((sum, i) => sum + i.amount, 0)
    , [incentivesList]);

  // Live calculated KPI stats
  const kpiStats = useMemo(() => {
    const baseTotal = 0;
    const bonusTotal = history.reduce((acc, curr) => acc + curr.bonus, 0);
    const deductions = 0;
    const incentiveTotal = incentivesApprovedTotal;
    const finalPayoutTotal = baseTotal + bonusTotal + incentiveTotal - deductions;

    return {
      base: `₹${baseTotal.toLocaleString("en-IN")}`,
      attendanceBased: `₹0`,
      bonuses: `₹${bonusTotal.toLocaleString("en-IN")}`,
      deductions: `₹${deductions.toLocaleString("en-IN")}`,
      incentives: `₹${incentiveTotal.toLocaleString("en-IN")}`,
      totalPayout: `₹${finalPayoutTotal.toLocaleString("en-IN")}`,
    };
  }, [history, incentivesApprovedTotal]);

  // Check if May 2026 payroll has been calculated
  const isMayProcessed = useMemo(() => {
    return history.some(h => h.month === 'May 2026');
  }, [history]);

  const handleExportCSV = () => {
    const headers = ["Month", "Employee Count", "Base Amount (INR)", "Bonuses (INR)", "Total Payout (INR)"];
    const rows = history.map(row => [
      row.month,
      `${row.count} Employees`,
      row.base,
      row.bonus,
      row.total
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Payroll_Compensation_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Compensation ledger successfully exported to CSV!");
  };

  const handleGenerateReport = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = 595;

    // â”€â”€ Dark header banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 90, "F");

    // Accent stripe
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 90, pageW, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("RMS  PAYROLL COMPENSATION REPORT", 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Financial Management Department  |  Confidential", 40, 70);

    // Generated date right-aligned
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageW - 40, 70, { align: "right" });

    // â”€â”€ Meta row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const metaY = 115;
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Audit Period:", 40, metaY);
    doc.setFont("helvetica", "normal");
    doc.text("Jan 2026 â€“ May 2026", 110, metaY);

    doc.setFont("helvetica", "bold");
    doc.text("Finance Controller:", 240, metaY);
    doc.setFont("helvetica", "normal");
    doc.text("RMS Finance Dept", 340, metaY);

    // â”€â”€ Summary KPI boxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const boxes = [
      { label: "Total Salary", value: kpiStats.base, color: [238, 242, 255] },
      { label: "Bonuses Paid", value: kpiStats.bonuses, color: [236, 253, 245] },
      { label: "Incentives", value: kpiStats.incentives, color: [255, 251, 235] },
      { label: "Total Payout", value: kpiStats.totalPayout, color: [245, 243, 255] },
    ];
    const boxW = 126, boxH = 52, boxY = 135, boxGap = 8;
    boxes.forEach((b, i) => {
      const bx = 40 + i * (boxW + boxGap);
      doc.setFillColor(...b.color);
      doc.roundedRect(bx, boxY, boxW, boxH, 5, 5, "F");
      doc.setDrawColor(210, 214, 220);
      doc.roundedRect(bx, boxY, boxW, boxH, 5, 5, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(b.label.toUpperCase(), bx + 8, boxY + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      // Replace ₹ with Rs. for helvetica font compatibility
      const valStr = b.value.replace("₹", "Rs.");
      doc.text(valStr, bx + 8, boxY + 36);
    });

    // â”€â”€ Section title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text("MONTHLY SALARY PAYMENT LEDGER", 40, 210);
    doc.setDrawColor(203, 213, 225);
    doc.line(40, 215, pageW - 40, 215);

    // â”€â”€ Main table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tableData = history.map((row, i) => {
      const rowIncentives = i === 0 ? incentivesApprovedTotal : 0;
      const rowTotal = row.base + row.bonus + rowIncentives;
      const fmt = (n) => `Rs.${n.toLocaleString("en-IN")}`;
      return [
        row.month,
        `${row.count} Employees`,
        fmt(row.base),
        fmt(row.bonus),
        fmt(rowIncentives),
        fmt(rowTotal)
      ];
    });

    autoTable(doc, {
      startY: 223,
      head: [["Month", "Headcount", "Base Salary", "Bonuses", "Incentives", "Total Payout"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [30, 27, 75],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold", textColor: [30, 27, 75] },
      },
      margin: { left: 40, right: 40 },
    });

    // â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, finalY, pageW - 80, 32, 5, 5, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "This document is system-generated by RMS Finance. All figures are in Indian Rupees (INR).",
      40 + (pageW - 80) / 2,
      finalY + 20,
      { align: "center" }
    );

    doc.save("Payroll_System_Report.pdf");
    toast.success("Payroll PDF generated and downloaded successfully!");
  };

  // Perform interactive payroll additions
  const executeProcessPayroll = () => {
    const nextMonthStr = `May 2026`;

    if (history.some(h => h.month === nextMonthStr)) {
      toast.error("May 2026 payroll has already been disbursed!");
      setShowCalcModal(false);
      return;
    }

    const nextRecord = {
      month: nextMonthStr,
      count: 43,
      base: 1260000,
      bonus: 140000,
      total: 1400000
    };

    setHistory([nextRecord, ...history]);
    setShowCalcModal(false);
    toast.success("Disbursed ₹14,00,000 for May 2026 payroll!");
  };

  // Perform individual incentive approval
  const handleApproveIndividual = (id) => {
    const item = incentivesList.find(i => i.id === id);
    if (!item || item.status === "Approved") return;

    const updated = incentivesList.map(i => i.id === id ? { ...i, status: "Approved" } : i);
    setIncentivesList(updated);
    setShowIncentiveModal(false); // auto-close modal after approve
    toast.success(`Approved Rs.${item.amount.toLocaleString("en-IN")} incentive for ${item.name.split(" ")[0]}!`);
  };

  // Perform interactive incentive approvals (Approve All Remaining)
  const executeApproveIncentives = () => {
    const totalPending = incentivesList
      .filter(i => i.status === "Pending")
      .reduce((sum, item) => sum + item.amount, 0);

    if (totalPending === 0) {
      toast.error("All incentives have already been approved.");
      setShowIncentiveModal(false);
      return;
    }

    const updated = incentivesList.map(item => ({ ...item, status: "Approved" }));
    setIncentivesList(updated);
    setShowIncentiveModal(false);
    toast.success(`Approved all remaining incentives totaling Rs.${totalPending.toLocaleString("en-IN")}!`);
  };

  // Check if any pending incentives remain
  const pendingCount = useMemo(() => {
    return incentivesList.filter(i => i.status === "Pending").length;
  }, [incentivesList]);

  const handleDownloadPayslip = (emp) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a5" });

    // Header banner
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 420, 60, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("RMS - SALARY STATEMENT", 30, 36);

    // Metadata
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Employee Name: ${emp.name}`, 30, 90);
    doc.text(`Statement Cycle: April 2026`, 30, 105);
    doc.text(`Designation: Department Staff`, 30, 120);

    const base = emp.id === 1 ? 60000 : emp.id === 2 ? 80000 : 50000;
    const allowance = 5000;
    const incentive = emp.status === "Approved" ? emp.amount : 0;
    const gross = base + allowance + incentive;

    const pf = Math.round(base * 0.12);
    const tds = Math.round(base * 0.05);
    const totalDeductions = pf + tds;
    const netPay = gross - totalDeductions;

    autoTable(doc, {
      startY: 140,
      head: [["Earnings Detail", "Amount", "Deductions Detail", "Amount"]],
      body: [
        ["Basic Pay", `₹${base.toLocaleString("en-IN")}`, "Provident Fund (PF)", `₹${pf.toLocaleString("en-IN")}`],
        ["Attendance Allow.", `₹${allowance.toLocaleString("en-IN")}`, "TDS (Tax)", `₹${tds.toLocaleString("en-IN")}`],
        ["Approved Incentive", `₹${incentive.toLocaleString("en-IN")}`, "", ""],
        ["Gross Earnings", `₹${gross.toLocaleString("en-IN")}`, "Total Deductions", `₹${totalDeductions.toLocaleString("en-IN")}`]
      ],
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      styles: { fontSize: 8, font: "helvetica" }
    });

    const finalY = doc.lastAutoTable.finalY;

    // Net Pay highlights
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(30, finalY + 15, 360, 40, 5, 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("NET PAYABLE AMOUNT (INR):", 45, finalY + 39);
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(13);
    doc.text(`₹${netPay.toLocaleString("en-IN")}`, 280, finalY + 40);

    doc.save(`Payslip_${emp.name.split(" ")[0]}.pdf`);
    toast.success(`Payslip for ${emp.name.split(" ")[0]} downloaded!`);
  };

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6 relative">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title & Actions Block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Payroll Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition shadow-md cursor-pointer"
            >
              <Download size={16} />
              <span>Generate PDF</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KPICard title="Employee Salary" value={kpiStats.base} icon={<Users size={16} />} color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80" iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" />
          <KPICard title="Attendance Based" value={kpiStats.attendanceBased} icon={<Calculator size={16} />} color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80" iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
          <KPICard title="Bonuses Paid" value={kpiStats.bonuses} icon={<Trophy size={16} />} color="bg-amber-950/95 border-amber-400 shadow-amber-950/80" iconColor="bg-amber-500/10 text-amber-400 border border-amber-500/20" />
          <KPICard title="Deductions" value={kpiStats.deductions} icon={<AlertCircle size={16} />} color="bg-rose-950/95 border-rose-400 shadow-rose-950/80" iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20" />
          <KPICard title="Incentives" value={kpiStats.incentives} icon={<Wallet size={16} />} color="bg-pink-950/95 border-pink-400 shadow-pink-950/80" iconColor="bg-pink-500/10 text-pink-400 border border-pink-500/20" />
          <KPICard title="Total Payout" value={kpiStats.totalPayout} icon={<History size={16} />} color="bg-fuchsia-950/95 border-fuchsia-400 shadow-fuchsia-950/80" iconColor="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20" />
        </div>

        {/* Lower layout panels */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Salary Payment History */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Active Employee Performance & Incentives" badge="Monthly Directory">
              {/* Search & Status Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4 pb-4 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search employee name or dept..."
                    className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  />
                </div>
                <div className="flex gap-1">
                  {["All", "Pending", "Approved"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${statusFilter === status
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                      <th className="py-3 px-4 font-bold">Employee Name</th>
                      <th className="py-3 px-4 text-center font-bold">Incentive Status</th>
                      <th className="py-3 px-4 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredIncentives.length > 0 ? (
                      filteredIncentives.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedEmployee(item)}
                          className="hover:bg-slate-50/75 transition-colors duration-200 cursor-pointer group"
                          title="Click to view detailed Salary Payslip"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <span className="border-b border-dashed border-slate-300 group-hover:border-indigo-600 group-hover:text-indigo-600 transition duration-150">
                              {item.name}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {item.status === 'Approved' ? (
                              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                Approved
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveIndividual(item.id);
                                }}
                                className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer"
                                title="Click to Approve"
                              >
                                Pending (Approve)
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 font-mono">₹{item.amount.toLocaleString("en-IN")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="py-8 text-center text-sm font-semibold text-slate-400">
                          No matching records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Salary Payment History" badge="Monthly Ledger">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                      <th className="py-3 px-4 font-bold">Month</th>
                      <th className="py-3 px-4 font-bold">Employee Count</th>
                      <th className="py-3 px-4 font-bold">Base Amount</th>
                      <th className="py-3 px-4 font-bold">Bonuses</th>
                      <th className="py-3 px-4 font-bold">Incentives</th>
                      <th className="py-3 px-4 text-right font-bold">Total Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {history.map((row, i) => {
                      const rowIncentives = i === 0 ? incentivesApprovedTotal : 0;
                      const rowTotal = row.base + row.bonus + rowIncentives;
                      return (
                        <tr key={i} className="hover:bg-slate-50/55 transition-colors duration-200">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{row.month}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">{row.count} Employees</td>
                          <td className="py-3.5 px-4 text-slate-600">₹{row.base.toLocaleString("en-IN")}</td>
                          <td className="py-3.5 px-4 text-slate-600 font-semibold">₹{row.bonus.toLocaleString("en-IN")}</td>
                          <td className="py-3.5 px-4 text-slate-600 font-semibold">₹{rowIncentives.toLocaleString("en-IN")}</td>
                          <td className="py-3.5 px-4 text-right font-black text-black">₹{rowTotal.toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Quick Actions & Status */}
          <div className="lg:col-span-1">
            <SectionCard title="Quick Actions" badge="Control Center">
              <div className="space-y-4">
                <button
                  onClick={() => setShowCalcModal(true)}
                  className="w-full rounded-xl bg-slate-50 p-4 border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-all duration-200 group shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-inner">
                      <Calculator size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Calculate Next Payroll</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => setShowIncentiveModal(true)}
                  className="w-full rounded-xl bg-slate-50 p-4 border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-all duration-200 group shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-inner">
                      <Wallet size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">Approve Incentives</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Calculate Next Payroll Modal */}
      {showCalcModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCalcModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                <Calculator size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Process Next Payroll</h3>
                <p className="text-xs text-slate-500">Calculate compensation parameters for the upcoming cycle.</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-800">Target Month:</span>
                <span className="font-bold text-slate-900">May 2026</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-800">Active Staff:</span>
                <span className="font-bold text-slate-900">43 Employees</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-800">Base Salary Volume:</span>
                <span className="font-extrabold text-slate-900">₹12,60,000</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <span className="font-bold text-slate-800">Projected Bonuses:</span>
                <span className="font-extrabold text-emerald-600">₹1,40,000</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-black text-black">Total Disbursements:</span>
                <span className="font-black text-indigo-600 text-base">₹14,00,000</span>
              </div>

              <button
                onClick={executeProcessPayroll}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-md cursor-pointer"
              >
                Process & Disburse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Incentives Modal */}
      {showIncentiveModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl relative">
            <button
              onClick={() => setShowIncentiveModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                <Wallet size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Authorize Incentives</h3>
                <p className="text-xs text-slate-500">Approve pending performance incentives ledger.</p>
              </div>
            </div>

            <div className="space-y-3.5 mb-5 max-h-56 overflow-y-auto pr-1">
              {incentivesList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.name}</p>
                    <span className="mt-1.5 inline-flex">
                      {item.status === "Approved" ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Approved</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wider">Pending</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-800">₹{item.amount.toLocaleString("en-IN")}</span>
                    {item.status === "Approved" ? (
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 p-1 rounded-full"><CheckCircle size={12} /></span>
                    ) : (
                      <button
                        onClick={() => handleApproveIndividual(item.id)}
                        className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg shadow-sm transition hover:-translate-y-0.5 cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {pendingCount > 0 ? (
              <button
                onClick={executeApproveIncentives}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-md cursor-pointer"
              >
                Approve & Pay All Remaining
              </button>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-2.5 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 rounded-xl">
                  âœ“ All Incentives Successfully Approved
                </div>
                <button
                  onClick={() => setShowIncentiveModal(false)}
                  className="w-full flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition shadow-md cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Employee Detailed Paystub Modal */}
      {selectedEmployee && (() => {
        const emp = selectedEmployee;
        const base = emp.id === 1 ? 60000 : emp.id === 2 ? 80000 : 50000;
        const allowance = 5000;
        const incentive = emp.status === "Approved" ? emp.amount : 0;
        const gross = base + allowance + incentive;
        const pf = Math.round(base * 0.12);
        const tds = Math.round(base * 0.05);
        const totalDeductions = pf + tds;
        const netPay = gross - totalDeductions;

        return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl relative overflow-hidden">
              {/* Top Accent Bar */}
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Salary Statement / Payslip</h3>
                  <p className="text-xs text-slate-500">Official monthly compensation slip break-up.</p>
                </div>
              </div>

              {/* Employee Info Block */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-sm font-bold text-black uppercase tracking-wider">Employee Name</span>
                  <p className="font-extrabold text-slate-800">{emp.name}</p>
                </div>
                <div>
                  <span className="text-sm font-bold text-black uppercase tracking-wider">Statement Cycle</span>
                  <p className="font-bold text-slate-800">April 2026</p>
                </div>
                <div>
                  <span className="text-sm font-bold text-black uppercase tracking-wider">Designation</span>
                  <p className="font-bold text-slate-600">Department Staff</p>
                </div>
                <div>
                  <span className="text-sm font-bold text-black uppercase tracking-wider">PF ID / Salary Bank</span>
                  <p className="font-semibold text-slate-600 font-mono">RMS-PF-92381 / HDFC</p>
                </div>
              </div>

              {/* Earnings & Deductions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
                {/* Earnings */}
                <div className="border border-slate-100 rounded-xl p-3 bg-emerald-50/20">
                  <h4 className="font-extrabold text-emerald-800 border-b border-emerald-100 pb-1.5 mb-2 flex items-center justify-between">
                    <span>Earnings</span>
                    <span className="text-xs text-emerald-600">Credit</span>
                  </h4>
                  <div className="space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span>Basic Pay:</span>
                      <span className="font-bold font-mono">₹{base.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Attendance Allow:</span>
                      <span className="font-bold font-mono">₹{allowance.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Approved Incentive:</span>
                      <span className={`font-bold font-mono ${incentive > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        ₹{incentive.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-emerald-100 font-extrabold text-slate-900">
                      <span>Gross Earnings:</span>
                      <span className="font-mono">₹{gross.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-100 rounded-xl p-3 bg-rose-50/20">
                  <h4 className="font-extrabold text-rose-800 border-b border-rose-100 pb-1.5 mb-2 flex items-center justify-between">
                    <span>Deductions</span>
                    <span className="text-xs text-rose-600">Debit</span>
                  </h4>
                  <div className="space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span>Provident Fund (PF):</span>
                      <span className="font-bold font-mono text-rose-600">₹{pf.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TDS / Income Tax:</span>
                      <span className="font-bold font-mono text-rose-600">₹{tds.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leave Cut:</span>
                      <span className="font-bold font-mono text-slate-400">₹0</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-rose-100 font-extrabold text-slate-900">
                      <span>Total Deductions:</span>
                      <span className="font-mono">₹{totalDeductions.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="bg-indigo-900 text-white rounded-xl p-4 mb-5 flex items-center justify-between shadow-lg">
                <div>
                  <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Net Payable Amount</p>
                  <p className="text-[11px] text-indigo-300">(Gross Earnings - Deductions)</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono tracking-tight">
                    ₹{netPay.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 py-2.5 text-sm font-bold text-slate-700 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDownloadPayslip(emp)}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-sm font-bold text-white transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download Slip</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


