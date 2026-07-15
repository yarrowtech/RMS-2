import React, { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  FaChartLine,
  FaMoneyBillWave,
  FaExchangeAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
} from "react-icons/fa";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Receipt,
  Users,
  Wallet,
  ShoppingCart,
  Layers,
} from "lucide-react";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function KPICard({ title, value, change, trend, icon, iconColor, color }) {
  let baseColor = 'slate';
  if (color) {
    const m = color.match(/bg-([a-z]+)-/);
    if (m) baseColor = m[1];
  }
  const finalBgColor = `bg-${baseColor}-200`;
  const finalIconColor = `bg-white text-${baseColor}-700`;

  return (
    <div className="relative min-h-[85px] bg-white rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer">
      <div className="flex items-center justify-between gap-3 relative z-10">
        <p className="text-sm font-bold text-black uppercase tracking-wider">
          {title}
        </p>
        <div className={`rounded-md p-1.5 shadow-sm ${iconColor}`}>{icon}</div>
      </div>
      <div className="relative z-10 mt-2">
        <h3 className="break-words text-2xl font-black text-black leading-tight">{value}</h3>
        {change && (
          <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
            {trend === "up" ? (
              <ArrowUpRight size={14} className="text-emerald-600" />
            ) : (
              <ArrowDownRight size={14} className="text-rose-600" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-850">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}


export default function FinanceDashboard() {
  const [selectedActivity, setSelectedActivity] = useState(null);

  const stats = {
    revenue: 0,
    expenses: 0,
    profit: 0,
    efficiency: 0,
    arVouchers: 0,
    apVouchers: 0,
    payroll: 0,
    taxLiability: 0,
    purchaseInvoices: 0,
    generalVouchers: 0,
  };

  const previousStats = {
    revenue: 120000,
    expenses: 80000,
    profit: 40000,
    efficiency: 75,
    arVouchers: 65000,
    apVouchers: 42000,
    payroll: 30000,
    taxLiability: 15000,
    purchaseInvoices: 85000,
    generalVouchers: 24000,
  };

  const getTrend = (current, previous) => {
    if (current === 0 || previous === 0) {
      return { change: null, trend: current >= previous ? "up" : "down" };
    }
    const diff = ((current - previous) / previous) * 100;
    return {
      change: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
      trend: diff >= 0 ? "up" : "down"
    };
  };

  const revTrend = getTrend(stats.revenue, previousStats.revenue);
  const expTrend = getTrend(stats.expenses, previousStats.expenses);
  const profTrend = getTrend(stats.profit, previousStats.profit);
  const effTrend = getTrend(stats.efficiency, previousStats.efficiency);
  const arTrend = getTrend(stats.arVouchers, previousStats.arVouchers);
  const apTrend = getTrend(stats.apVouchers, previousStats.apVouchers);
  const payrollTrend = getTrend(stats.payroll, previousStats.payroll);
  const taxTrend = getTrend(stats.taxLiability, previousStats.taxLiability);
  const piTrend = getTrend(stats.purchaseInvoices, previousStats.purchaseInvoices);
  const gvTrend = getTrend(stats.generalVouchers, previousStats.generalVouchers);

  const [activities, setActivities] = useState([]);

  const handleTransitionStatus = (id) => {
    const currentItem = activities.find((item) => item.id === id);
    if (!currentItem) return;

    let nextStatus = currentItem.status;
    if (currentItem.status === "Pending") nextStatus = "Processed";
    else if (currentItem.status === "Processed") nextStatus = "Completed";

    if (nextStatus === currentItem.status) return;

    setActivities((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );
    setSelectedActivity((prev) => ({ ...prev, status: nextStatus }));

    toast.success(`Transaction status successfully updated to ${nextStatus}!`);
  };

  const modalTheme = selectedActivity
    ? (selectedActivity.status === "Completed"
      ? {
        bg: "bg-emerald-50/50",
        border: "border-emerald-500/30",
        text: "text-emerald-700",
        bannerBg: "bg-emerald-50/70 border-emerald-150",
        amountText: "text-emerald-600",
        iconBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      }
      : selectedActivity.status === "Processed"
        ? {
          bg: "bg-blue-50/50",
          border: "border-blue-500/30",
          text: "text-blue-700",
          bannerBg: "bg-blue-50/70 border-blue-150",
          amountText: "text-blue-600",
          iconBg: "bg-blue-100 text-blue-800 border-blue-200",
        }
        : {
          bg: "bg-amber-50/50",
          border: "border-amber-500/30",
          text: "text-amber-700",
          bannerBg: "bg-amber-50/70 border-amber-150",
          amountText: "text-amber-600",
          iconBg: "bg-amber-100 text-amber-800 border-amber-200",
        })
    : null;

  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <FaChartLine size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Finance Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KPICard
            title="Total Revenue"
            value={money(stats.revenue)}
            change={revTrend.change}
            trend={revTrend.trend}
            icon={<FaChartLine size={16} />}
            iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80"
          />

          <KPICard
            title="Total Expenses"
            value={money(stats.expenses)}
            change={expTrend.change}
            trend={expTrend.trend}
            icon={<TrendingDown size={16} />}
            iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20"
            color="bg-rose-950/95 border-rose-400 shadow-rose-950/80"
          />

          <KPICard
            title="Net Profit"
            value={money(stats.profit)}
            change={profTrend.change}
            trend={profTrend.trend}
            icon={<IndianRupee size={16} />}
            iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80"
          />

          <KPICard
            title="Efficiency Score"
            value={`${stats.efficiency}%`}
            change={effTrend.change}
            trend={effTrend.trend}
            icon={<Activity size={16} />}
            iconColor="bg-amber-50/10 text-amber-450 border border-amber-500/20"
            color="bg-amber-950/95 border-amber-400 shadow-amber-950/80"
          />

          <KPICard
            title="Accounts Receivable"
            value={money(stats.arVouchers)}
            change={arTrend.change}
            trend={arTrend.trend}
            icon={<FileText size={16} />}
            iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80"
          />

          <KPICard
            title="Accounts Payable"
            value={money(stats.apVouchers)}
            change={apTrend.change}
            trend={apTrend.trend}
            icon={<Receipt size={16} />}
            iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20"
            color="bg-rose-950/95 border-rose-400 shadow-rose-950/80"
          />

          <KPICard
            title="Total Payroll Cost"
            value={money(stats.payroll)}
            change={payrollTrend.change}
            trend={payrollTrend.trend}
            icon={<Users size={16} />}
            iconColor="bg-violet-500/10 text-violet-400 border border-violet-500/20"
            color="bg-violet-950/95 border-violet-400 shadow-violet-950/80"
          />

          <KPICard
            title="Tax Liability (GST)"
            value={money(stats.taxLiability)}
            change={taxTrend.change}
            trend={taxTrend.trend}
            icon={<Wallet size={16} />}
            iconColor="bg-amber-500/10 text-amber-400 border border-amber-500/20"
            color="bg-amber-950/95 border-amber-400 shadow-amber-950/80"
          />

          <KPICard
            title="Purchase Invoices"
            value={money(stats.purchaseInvoices)}
            change={piTrend.change}
            trend={piTrend.trend}
            icon={<ShoppingCart size={16} />}
            iconColor="bg-blue-500/10 text-blue-400 border border-blue-500/20"
            color="bg-blue-950/95 border-blue-400 shadow-blue-950/80"
          />

          <KPICard
            title="General Vouchers"
            value={money(stats.generalVouchers)}
            change={gvTrend.change}
            trend={gvTrend.trend}
            icon={<Layers size={16} />}
            iconColor="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
            color="bg-cyan-950/95 border-cyan-400 shadow-cyan-950/80"
          />
        </div>

        {/* Content Panels */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Integrity / Compliance Circle */}
          <div className="lg:col-span-1">
            <SectionCard title="Financial Integrity" badge="Compliance Audit">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="relative h-40 w-40 rounded-full border-[12px] border-slate-100 border-t-indigo-600 flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <span className="text-3xl font-black text-black">{stats.efficiency}</span>
                    <p className="text-sm font-bold text-slate-900 uppercase mt-0.5 tracking-wider">
                      Accuracy
                    </p>
                  </div>
                </div>
                <p className="mt-8 text-sm font-semibold text-slate-950 leading-relaxed max-w-[280px]">
                  Your financial records are highly accurate and fully compliant with current tax and accounting regulations.
                </p>
              </div>
            </SectionCard>
          </div>

          {/* Recent Activity Ledger */}
          <div className="lg:col-span-2">
            <SectionCard title="Recent Financial Activity" badge="Live Log">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-900 font-bold">
                      <th className="py-3 px-4 font-bold">Description</th>
                      <th className="py-3 px-4 font-bold">Date & Time</th>
                      <th className="py-3 px-4 text-right font-bold">Amount</th>
                      <th className="py-3 px-4 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {activities.map((item, i) => (
                      <tr key={i} onClick={() => setSelectedActivity(item)} className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${item.type === 'revenue' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'}`}>
                              {item.type === 'revenue' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            </div>
                            {item.label}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-900 font-semibold">{item.date}</td>
                        <td className={`py-3.5 px-4 text-right font-bold ${item.status === 'Completed' ? 'text-emerald-600' :
                          item.status === 'Processed' ? 'text-blue-600' :
                            'text-amber-600'
                          }`}>
                          {item.type === 'revenue' ? `+` : ``}{money(item.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold border ${item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                            item.status === 'Processed' ? 'bg-blue-50 text-blue-700 border-blue-250' :
                              'bg-amber-50 text-amber-700 border-amber-250'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300"
          onClick={() => setSelectedActivity(null)}
        >
          <div
            className={`relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-2 ${modalTheme.border}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
              <button
                onClick={() => setSelectedActivity(null)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition text-xs"
              >
                âœ•
              </button>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-4">
              {/* Top Amount Banner */}
              <div className={`flex flex-col items-center justify-center py-4 rounded-xl border ${modalTheme.bannerBg}`}>
                <div className={`p-2 rounded-full mb-2 border ${modalTheme.iconBg}`}>
                  {selectedActivity.type === 'revenue' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <span className="text-sm font-bold text-black uppercase tracking-wider">{selectedActivity.type}</span>
                <h4 className={`text-2xl font-black mt-0.5 ${modalTheme.amountText}`}>
                  {selectedActivity.type === 'revenue' ? '+' : ''}{money(selectedActivity.amount)}
                </h4>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Description</span>
                  <p className="mt-0.5 text-xs font-bold text-slate-950">{selectedActivity.label}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Status</span>
                  <div className="mt-0.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${selectedActivity.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                      selectedActivity.status === 'Processed' ? 'bg-blue-50 text-blue-700 border-blue-250' :
                        'bg-amber-50 text-amber-700 border-amber-250'
                      }`}>
                      {selectedActivity.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Date & Time</span>
                  <p className="mt-0.5 text-xs font-semibold text-slate-950">{selectedActivity.date}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Transaction ID</span>
                  <p className="mt-0.5 text-xs font-mono font-bold text-slate-950">{selectedActivity.id}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Source Channel</span>
                  <p className="mt-0.5 text-xs font-semibold text-slate-950">{selectedActivity.channel}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-black uppercase tracking-wider">Category</span>
                  <p className="mt-0.5 text-xs font-semibold text-slate-950">{selectedActivity.category}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 border-t border-slate-150 pt-3 flex items-center justify-between gap-3">
              {selectedActivity.status !== "Completed" ? (
                <button
                  onClick={() => handleTransitionStatus(selectedActivity.id)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm ${selectedActivity.status === "Pending"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                  {selectedActivity.status === "Pending" ? "Approve & Process" : "Mark as Completed"}
                </button>
              ) : (
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  âœ“ Process Fully Completed
                </span>
              )}
              <button
                onClick={() => setSelectedActivity(null)}
                className="rounded-lg border border-sky-400 bg-sky-100 px-4 py-2 text-xs font-bold text-sky-900 hover:bg-sky-800 hover:text-white hover:border-sky-800 transition-all duration-200 shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


