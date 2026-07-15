import React from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertOctagon,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "react-hot-toast";

function KPICard({ title, value, change, trend, icon, color, iconColor }) {
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
          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            {trend === "up" ? (
              <TrendingUp size={14} className="text-emerald-600" />
            ) : (
              <TrendingDown size={14} className="text-rose-600" />
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

export default function FinanceProfitLoss() {
  return (
    <div className="min-h-full bg-transparent p-4 lg:p-6 font-sans text-slate-900 flex flex-col gap-6">
      <div className="mx-auto w-full max-w-[1750px] space-y-6 min-w-0">
        {/* Title & Actions Block */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-2xl p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-center sm:justify-between transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-black tracking-tight">Profit & Loss</h1>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KPICard
            title="Total Revenue"
            value="₹0"
            change="No data yet"
            trend="up"
            icon={<TrendingUp size={16} />}
            iconColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            color="bg-emerald-950/95 border-emerald-400 shadow-emerald-950/80"
          />
          <KPICard
            title="Total Expenses"
            value="₹0"
            change="No data yet"
            trend="down"
            icon={<TrendingDown size={16} />}
            iconColor="bg-rose-500/10 text-rose-400 border border-rose-500/20"
            color="bg-rose-950/95 border-rose-400 shadow-rose-950/80"
          />
          <KPICard
            title="Net Profit"
            value="₹0"
            change="No data yet"
            trend="up"
            icon={<DollarSign size={16} />}
            iconColor="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            color="bg-indigo-950/95 border-indigo-400 shadow-indigo-950/80"
          />
          <KPICard
            title="Net Loss"
            value="₹0"
            icon={<AlertOctagon size={16} />}
            iconColor="bg-amber-50/10 text-amber-450 border border-amber-500/20"
            color="bg-amber-950/95 border-amber-400 shadow-amber-950/80"
          />
        </div>

        {/* Lower layout panels */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Monthly P&L Chart */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Monthly P&L Report"
              badge="Audited Log"
            >
              <div className="p-4">
                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded bg-indigo-600 shadow-sm" />
                    <span>Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded bg-indigo-300 shadow-sm" />
                    <span>Expenses</span>
                  </div>
                </div>

                <div className="h-60 flex items-end gap-5 px-2 mt-4">
                  {[
                    { r: 0, e: 0, m: 'Jan' },
                    { r: 0, e: 0, m: 'Feb' },
                    { r: 0, e: 0, m: 'Mar' },
                    { r: 0, e: 0, m: 'Apr' },
                    { r: 0, e: 0, m: 'May' },
                    { r: 0, e: 0, m: 'Jun' }
                  ].map((data, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                      <div className="w-full flex justify-center gap-2 h-full items-end">
                        <div className="w-3.5 bg-indigo-600/20 rounded-t-lg transition-all duration-300 group-hover:bg-indigo-600 cursor-pointer shadow-sm" style={{ height: `${data.r}%` }} />
                        <div className="w-3.5 bg-indigo-300/20 rounded-t-lg transition-all duration-300 group-hover:bg-indigo-300 cursor-pointer shadow-sm" style={{ height: `${data.e}%` }} />
                      </div>
                      <span className="text-[10px] font-extrabold text-black uppercase tracking-wider">{data.m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Financial Health & Margin progress bars */}
          <div className="lg:col-span-1">
            <SectionCard title="Financial Health" badge="Bottom Line">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <span>Gross Margin</span>
                    <span className="text-slate-900 font-black">0%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200 shadow-inner">
                    <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: '0%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <span>Operating Margin</span>
                    <span className="text-slate-900 font-black">0%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200 shadow-inner">
                    <div className="h-full bg-slate-700 rounded-full transition-all duration-500" style={{ width: '0%' }} />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-250 bg-emerald-50/70 p-6 shadow-sm backdrop-blur-xl cursor-pointer hover:-translate-y-0.5 transform transition-all duration-300 will-change-transform hover:shadow-[0_20px_50px_rgba(99,102,241,0.25)]">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Business Status</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">Profitable</p>
                  <p className="mt-2 text-xs font-semibold text-emerald-600 leading-relaxed">
                    The corporation is currently running at an extremely healthy gross and operating profit margin, exceeding the projected quarterly performance target by 4.2%.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}


