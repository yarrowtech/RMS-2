import React from "react";
import {
  FileText,
  Download,
  Calendar,
  Users,
  Receipt,
  Plus,
  Activity,
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

// ======================== EMPTY DATASETS (real data to be connected) ========================
const overviewData = [
  { month: "Jan", revenue: 0, expenses: 0, profit: 0 },
  { month: "Feb", revenue: 0, expenses: 0, profit: 0 },
  { month: "Mar", revenue: 0, expenses: 0, profit: 0 },
  { month: "Apr", revenue: 0, expenses: 0, profit: 0 },
  { month: "May", revenue: 0, expenses: 0, profit: 0 },
  { month: "Jun", revenue: 0, expenses: 0, profit: 0 },
];

const revenueData = [
  { name: "Card Sales", value: 0, color: "#3b82f6" },
  { name: "UPI Payments", value: 0, color: "#6366f1" },
  { name: "Cash Transactions", value: 0, color: "#10b981" },
];

const expenseData = [
  { name: "Rent", value: 0, color: "#10b981" },
  { name: "Power", value: 0, color: "#06b6d4" },
  { name: "Maintenance", value: 0, color: "#3b82f6" },
  { name: "Overhead", value: 0, color: "#6366f1" },
  { name: "Marketing", value: 0, color: "#8b5cf6" },
  { name: "Misc", value: 0, color: "#f43f5e" },
];

const payrollData = [
  { month: "Jan", base: 0, total: 0 },
  { month: "Feb", base: 0, total: 0 },
  { month: "Mar", base: 0, total: 0 },
  { month: "Apr", base: 0, total: 0 },
];

const vendorData = [
  { name: "Vendor 1", paid: 0, pending: 0 },
  { name: "Vendor 2", paid: 0, pending: 0 },
  { name: "Vendor 3", paid: 0, pending: 0 },
  { name: "Vendor 4", paid: 0, pending: 0 },
  { name: "Vendor 5", paid: 0, pending: 0 },
];

const taxData = [
  { name: "CGST (9%)", value: 0, color: "#3b82f6" },
  { name: "SGST (9%)", value: 0, color: "#6366f1" },
  { name: "IGST (18%)", value: 0, color: "#f43f5e" },
];

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-1 transform transition-all duration-300 will-change-transform flex flex-col h-full cursor-pointer hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 leading-tight">{title}</h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex-grow w-full font-semibold">
        {children}
      </div>
    </div>
  );
}



const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-750 p-2.5 rounded-xl shadow-xl backdrop-blur-md text-white text-xs font-sans">
        <p className="font-black text-slate-400 uppercase tracking-widest">{label || payload[0].name || ""}</p>
        <div className="mt-1 space-y-0.5">
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color || item.fill }} className="font-bold">
              {item.name}: â‚¹{Number(item.value || 0).toLocaleString("en-IN")}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function FinanceAnalytics() {
  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title & Actions Block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Departmental Analytics Hub</h1>
              <p className="text-sm text-slate-500 mt-1">Simultaneous multi-wing visual performance dashboards.</p>
            </div>
          </div>
        </div>

        {/* Simultaneous BI Analytics Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Chart 1: Widescreen Overview Trend */}
          <div className="md:col-span-2 xl:col-span-2 h-[340px]">
            <ChartCard title="Financial Performance Overview" subtitle="Real-time Revenue vs Expenses ledger trajectory" icon={Activity}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overviewData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0) / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                  <Area type="monotone" name="Gross Revenue" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" name="Operating Expenses" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 2: Revenue Sales Medium */}
          <div className="h-[340px]">
            <ChartCard title="Revenue Sales Medium" subtitle="Breakdown of POS & Online transactions" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0).toLocaleString("en-IN")}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Sales Revenue" radius={[6, 6, 0, 0]} barSize={32}>
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 3: Expenses Tracking Category Breakdown */}
          <div className="h-[300px]">
            <ChartCard title="Expense Category Breakdown" subtitle="Distribution of monthly operational costs" icon={CreditCard}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={expenseData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0) / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Operational Cost" radius={[6, 6, 0, 0]} barSize={22}>
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 4: Payroll Salary Disbursement Progression */}
          <div className="h-[300px]">
            <ChartCard title="Payroll Disbursement Hub" subtitle="Monthly payouts and baseline salary trend" icon={Users}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={payrollData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0) / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
                  <Area type="monotone" name="Base Salary" dataKey="base" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPayroll)" />
                  <Area type="monotone" name="Gross Payout" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 5: Vendor Payout Settlements */}
          <div className="h-[300px]">
            <ChartCard title="Vendor Payout Settlements" subtitle="Supplier outstanding dues vs processed payments" icon={Wallet}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={vendorData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0) / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
                  <Bar dataKey="paid" name="Settled" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} barSize={24} />
                  <Bar dataKey="pending" name="Dues" fill="#f43f5e" stackId="a" radius={[6, 6, 0, 0]} barSize={24} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Chart 6: GST & Tax Hub Collections */}
          <div className="h-[300px]">
            <ChartCard title="GST & Tax Liability Share" subtitle="Reconciliation of active tax categories" icon={Receipt}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={taxData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `â‚¹${Number(v || 0) / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="GST Collected" radius={[6, 6, 0, 0]} barSize={32}>
                    {taxData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>


      </div>
    </div>
  );
}


