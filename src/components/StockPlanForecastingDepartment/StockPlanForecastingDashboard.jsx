import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FaChartPie,
  FaChartLine,
  FaLayerGroup,
  FaPercent,
  FaBoxes,
  FaBalanceScale,
  FaExclamationTriangle,
} from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");
const fmtInt = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );
const money = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );
const pct = (n, d = 1) => `${Number(n || 0).toFixed(d)}%`;

/** ✅ FIX: Tooltip label normalizer (Recharts can pass either `dataKey` OR `name`) */
const tipLabel = (name) => {
  const k = String(name || "").toLowerCase();
  if (k === "planned" || k.includes("planned")) return "Planned";
  if (k === "actual" || k.includes("actual")) return "Actual";
  if (k === "variance" || k.includes("variance")) return "Variance";
  return String(name || "");
};

const CHART = {
  planned: "#2563EB",
  actual: "#16A34A",
  essentials: "#0EA5E9",
  premium: "#9333EA",
  warn: "#F59E0B",
  danger: "#EF4444",
  neutral: "#64748B",
  grid: "#E2E8F0",
  axis: "#64748B",
  tooltipBg: "#0B1220",
  tooltipBorder: "rgba(100,116,139,0.45)",
};

const BOX_BORDER = "border border-blue-500 dark:border-slate-700";

const months = [
  { key: "2025-01", label: "Jan 2025" },
  { key: "2025-02", label: "Feb 2025" },
  { key: "2025-03", label: "Mar 2025" },
  { key: "2025-04", label: "Apr 2025" },
  { key: "2025-05", label: "May 2025" },
  { key: "2025-06", label: "Jun 2025" },
];

const seasons = [
  { key: "SS25", label: "Summer (SS25)" },
  { key: "FW25", label: "Winter (FW25)" },
  { key: "Festive25", label: "Festive (2025)" },
];

function StatCard({ icon, label, value, sub, tone = "blue" }) {
  const toneRing =
    tone === "green"
      ? "ring-emerald-200/60 dark:ring-emerald-400/20"
      : tone === "amber"
      ? "ring-amber-200/60 dark:ring-amber-400/20"
      : tone === "red"
      ? "ring-rose-200/60 dark:ring-rose-400/20"
      : "ring-slate-200/70 dark:ring-slate-400/20";

  const toneChip =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-400/20 dark:text-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/25 dark:border-amber-400/20 dark:text-amber-200"
      : tone === "red"
      ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/25 dark:border-rose-400/20 dark:text-rose-200"
      : "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-950/25 dark:border-slate-400/20 dark:text-slate-200";

  return (
    <div
      className={cn(
        "rounded-2xl bg-white/90 dark:bg-black-900/50",
        BOX_BORDER,
        "shadow-sm ring-1",
        toneRing,
        "p-4"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl bg-white dark:bg-black-950 grid place-items-center",
            BOX_BORDER
          )}
        >
          <span className="text-black-800 dark:text-black-100 text-lg">
            {icon}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-black-600 dark:text-black-300">
            {label}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-black-900 dark:text-white truncate">
            {value}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {sub && (
              <p className="text-xs text-black-600 dark:text-black-300">
                {sub}
              </p>
            )}
            <span
              className={cn(
                "ml-auto text-[11px] font-extrabold px-2 py-1 rounded-lg border",
                toneChip
              )}
            >
              {tone === "green"
                ? "OK"
                : tone === "amber"
                ? "WATCH"
                : tone === "red"
                ? "ALERT"
                : "INFO"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-black-600 dark:text-black-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 px-3 rounded-xl",
          BOX_BORDER,
          "bg-white/95 dark:bg-black-950/60",
          "text-black-900 dark:text-black-100 shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400"
        )}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function heatBg(value, min, max) {
  const v = Number(value || 0);
  const a = max === min ? 0 : (v - min) / (max - min);
  const alpha = 0.08 + Math.max(0, Math.min(1, a)) * 0.37;
  return `rgba(37, 99, 235, ${alpha})`;
}

function groupSum(rows, key) {
  const map = new Map();
  rows.forEach((r) => {
    const k = r[key] || "Unknown";
    const prev = map.get(k) || { name: k, total: 0, essentials: 0, premium: 0 };
    prev.total += Number(r.total || 0);
    prev.essentials += Number(r.Essentials || 0);
    prev.premium += Number(r.Premium || 0);
    map.set(k, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function StockPlanForecastingDashboard() {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(months[0].key);
  const [season, setSeason] = useState(seasons[0].key);

  const purchaseSeries = useMemo(() => {
    const base =
      month === "2025-01"
        ? 1200
        : month === "2025-02"
        ? 1500
        : month === "2025-03"
        ? 1800
        : 1600;

    const bump = season === "Festive25" ? 1.2 : season === "FW25" ? 1.1 : 1.0;

    return Array.from({ length: 6 }).map((_, i) => {
      const planned = Math.round((base + i * 120) * bump);
      const actual = Math.round(
        planned *
          (0.88 + (i % 3) * 0.06 + (month === "2025-03" ? 0.04 : 0))
      );
      const variance = planned ? ((actual - planned) / planned) * 100 : 0;
      const budgetUsed = Math.round(actual * 260);

      return { week: `W${i + 1}`, planned, actual, variance, budgetUsed };
    });
  }, [month, season]);

  const deptDemand = useMemo(() => {
    const m = mode === "month" ? month : season;
    const mult =
      m === "2025-03" || m === "Festive25"
        ? 1.25
        : m === "FW25"
        ? 1.15
        : 1.0;

    return [
      {
        division: "FMCG",
        section: "Home & Personal Care",
        department: "Detergent",
        Essentials: 520 * mult,
        Premium: 180 * mult,
      },
      {
        division: "Apparel",
        section: "Mens",
        department: "Menswear",
        Essentials: 420 * mult,
        Premium: 260 * mult,
      },
      {
        division: "Home",
        section: "Kitchen",
        department: "Cookware",
        Essentials: 310 * mult,
        Premium: 140 * mult,
      },
      {
        division: "Accessories",
        section: "Fashion",
        department: "Bags",
        Essentials: 220 * mult,
        Premium: 90 * mult,
      },
      {
        division: "Electronics",
        section: "Mobiles",
        department: "Smartphones",
        Essentials: 260 * mult,
        Premium: 160 * mult,
      },
      {
        division: "FMCG",
        section: "Home & Personal Care",
        department: "Shampoo",
        Essentials: 280 * mult,
        Premium: 140 * mult,
      },
      {
        division: "Apparel",
        section: "Womens",
        department: "Womenswear",
        Essentials: 360 * mult,
        Premium: 210 * mult,
      },
    ].map((r) => ({
      ...r,
      Essentials: Math.round(r.Essentials),
      Premium: Math.round(r.Premium),
      total: Math.round(r.Essentials + r.Premium),
    }));
  }, [mode, month, season]);

  const kpis = useMemo(() => {
    const forecastedQty = deptDemand.reduce((s, r) => s + (r.total || 0), 0);
    const plannedQty = purchaseSeries.reduce((s, r) => s + (r.planned || 0), 0);
    const actualQty = purchaseSeries.reduce((s, r) => s + (r.actual || 0), 0);

    const budgetTotal = 1000000;
    const budgetUsed = Math.min(budgetTotal, Math.round(actualQty * 260));
    const budgetUsedPct = budgetTotal ? (budgetUsed / budgetTotal) * 100 : 0;

    return {
      forecastedQty,
      plannedQty,
      actualQty,
      budgetTotal,
      budgetUsed,
      budgetUsedPct,
    };
  }, [deptDemand, purchaseSeries]);

  const varianceSummary = useMemo(() => {
    const totalPlanned = kpis.plannedQty || 0;
    const totalActual = kpis.actualQty || 0;
    return totalPlanned ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0;
  }, [kpis]);

  const heat = useMemo(() => {
    const depts = deptDemand.map((d) => d.department);
    const weeks = purchaseSeries.map((w) => w.week);

    const matrix = depts.map((_, i) => {
      const base = deptDemand[i]?.total || 0;
      return weeks.map((_, wi) => {
        const wave = 0.88 + wi * 0.04 + (i % 2 ? 0.03 : -0.01);
        return Math.max(0, Math.round((base / weeks.length) * wave));
      });
    });

    const flat = matrix.flat();
    const min = Math.min(...flat, 0);
    const max = Math.max(...flat, 1);

    return { depts, weeks, matrix, min, max };
  }, [deptDemand, purchaseSeries]);

  const divisionAgg = useMemo(() => groupSum(deptDemand, "division"), [deptDemand]);
  const sectionAgg = useMemo(() => groupSum(deptDemand, "section"), [deptDemand]);

  const demandMix = useMemo(() => {
    const essentials = deptDemand.reduce((s, r) => s + (r.Essentials || 0), 0);
    const premium = deptDemand.reduce((s, r) => s + (r.Premium || 0), 0);
    return [
      { name: "Essentials", value: essentials },
      { name: "Premium", value: premium },
    ];
  }, [deptDemand]);

  const budgetBurn = useMemo(() => {
    let cum = 0;
    return purchaseSeries.map((w) => {
      cum += Number(w.budgetUsed || 0);
      return { ...w, cumBudget: cum };
    });
  }, [purchaseSeries]);

  const deptPlanActual = useMemo(() => {
    return deptDemand
      .map((d, i) => {
        const planned = d.total;
        const factor = 0.9 + (i % 4) * 0.05;
        const actual = Math.round(planned * factor);
        const variance = planned ? ((actual - planned) / planned) * 100 : 0;
        return {
          division: d.division,
          section: d.section,
          department: d.department,
          planned,
          actual,
          variance,
          absVar: Math.abs(variance),
        };
      })
      .sort((a, b) => b.absVar - a.absVar);
  }, [deptDemand]);

  const varianceTone =
    varianceSummary < -3 ? "red" : Math.abs(varianceSummary) > 5 ? "amber" : "green";
  const budgetTone = kpis.budgetUsedPct > 85 ? "amber" : "green";

  return (
    <div className="p-6 space-y-6">
      {/* ===================== Header ===================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-black-900 dark:text-white">
            Forecast Overview
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-black-950/50 px-3 py-2 shadow-sm",
              BOX_BORDER
            )}
          >
            <button
              type="button"
              onClick={() => setMode("month")}
              className={cn(
                "px-3 py-2 text-sm font-bold rounded-xl border transition",
                mode === "month"
                  ? "bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 text-white border-transparent"
                  : cn(
                      "bg-white/90 dark:bg-black-950/60 text-black-800 dark:text-black-100",
                      BOX_BORDER
                    )
              )}
            >
              Month
            </button>

            <button
              type="button"
              onClick={() => setMode("season")}
              className={cn(
                "px-3 py-2 text-sm font-bold rounded-xl border transition",
                mode === "season"
                  ? "bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 text-white border-transparent"
                  : cn(
                      "bg-white/90 dark:bg-black-950/60 text-black-800 dark:text-black-100",
                      BOX_BORDER
                    )
              )}
            >
              Season
            </button>
          </div>

          {mode === "month" ? (
            <Select label="Month" value={month} onChange={setMonth} options={months} />
          ) : (
            <Select label="Season" value={season} onChange={setSeason} options={seasons} />
          )}
        </div>
      </div>

      {/* ===================== KPI Cards ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<FaBoxes />}
          label="Forecasted Qty"
          value={fmtInt(kpis.forecastedQty)}
          sub={
            mode === "month"
              ? `Period: ${months.find((m) => m.key === month)?.label}`
              : `Period: ${seasons.find((s) => s.key === season)?.label}`
          }
          tone="blue"
        />
        <StatCard
          icon={<FaChartLine />}
          label="Planned Qty"
          value={fmtInt(kpis.plannedQty)}
          sub="Total planned purchases (week-wise)"
          tone="green"
        />
        <StatCard
          icon={<FaBalanceScale />}
          label="Actual Qty"
          value={fmtInt(kpis.actualQty)}
          sub={`Variance vs Planned: ${varianceSummary >= 0 ? "+" : ""}${pct(
            varianceSummary,
            1
          )}`}
          tone={varianceTone}
        />
        <StatCard
          icon={<FaPercent />}
          label="Budget Used %"
          value={pct(kpis.budgetUsedPct, 1)}
          sub={`Used: ₹${money(kpis.budgetUsed)} / ₹${money(kpis.budgetTotal)}`}
          tone={budgetTone}
        />
      </div>

      {/* ===================== Planned vs Actual ===================== */}
      <div
        className={cn(
          "rounded-3xl bg-white/90 dark:bg-black-900/50 shadow-sm overflow-hidden",
          BOX_BORDER
        )}
      >
        <div className={cn("px-5 py-4 flex items-start gap-3 border-b", BOX_BORDER)}>
          <div
            className={cn(
              "h-10 w-10 rounded-xl bg-white dark:bg-black-950 grid place-items-center",
              BOX_BORDER
            )}
          >
            <FaChartLine className="text-black-800 dark:text-black-100" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-black-900 dark:text-white">
              Planned vs Actual Purchases
            </h4>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className={cn("rounded-2xl bg-white/80 dark:bg-black-950/40 p-4", BOX_BORDER)}>
            <p className="text-sm font-bold text-black-900 dark:text-white mb-3">
              Bar View
            </p>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchaseSeries}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  <YAxis
                    tickFormatter={fmtInt}
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  {/* ✅ FIXED TOOLTIP */}
                  <Tooltip
                    contentStyle={{
                      background: CHART.tooltipBg,
                      border: `1px solid ${CHART.tooltipBorder}`,
                      borderRadius: 12,
                      color: "white",
                    }}
                    itemStyle={{ color: "white" }}
                    formatter={(val, name) => {
                      const label = tipLabel(name);
                      if (String(label).toLowerCase().includes("variance"))
                        return [pct(val, 1), "Variance"];
                      return [fmtInt(val), label];
                    }}
                    labelFormatter={(l) => String(l || "")}
                  />
                  <Legend />
                  <Bar
                    dataKey="planned"
                    name="Planned"
                    fill={CHART.planned}
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="actual"
                    name="Actual"
                    fill={CHART.actual}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cn("rounded-2xl bg-white/80 dark:bg-black-950/40 p-4", BOX_BORDER)}>
            <p className="text-sm font-bold text-black-900 dark:text-white mb-3">
              Trend View
            </p>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={purchaseSeries}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  <YAxis
                    tickFormatter={fmtInt}
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  {/* ✅ FIXED TOOLTIP */}
                  <Tooltip
                    contentStyle={{
                      background: CHART.tooltipBg,
                      border: `1px solid ${CHART.tooltipBorder}`,
                      borderRadius: 12,
                      color: "white",
                    }}
                    itemStyle={{ color: "white" }}
                    formatter={(val, name) => {
                      const label = tipLabel(name);
                      if (String(label).toLowerCase().includes("variance"))
                        return [pct(val, 1), "Variance"];
                      return [fmtInt(val), label];
                    }}
                    labelFormatter={(l) => String(l || "")}
                  />
                  <Legend />
                  <ReferenceLine y={0} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    name="Planned"
                    dot={false}
                    stroke={CHART.planned}
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    dot={false}
                    stroke={CHART.actual}
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== Demand Graph + Heatmap + Table ===================== */}
      <div
        className={cn(
          "rounded-3xl bg-white/90 dark:bg-black-900/50 shadow-sm overflow-hidden",
          BOX_BORDER
        )}
      >
        <div className={cn("px-5 py-4 flex items-start gap-3 border-b", BOX_BORDER)}>
          <div
            className={cn(
              "h-10 w-10 rounded-xl bg-white dark:bg-black-950 grid place-items-center",
              BOX_BORDER
            )}
          >
            <FaLayerGroup className="text-black-800 dark:text-black-100" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-black-900 dark:text-white">
              Division / Section / Department-wise Demand Graph
            </h4>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className={cn("rounded-2xl bg-white/80 dark:bg-black-950/40 p-4", BOX_BORDER)}>
            <p className="text-sm font-bold text-black-900 dark:text-white mb-3">
              Stacked Bar (by Department)
            </p>

            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptDemand}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="department"
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  <YAxis
                    tickFormatter={fmtInt}
                    tick={{ fill: CHART.axis }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={{ stroke: CHART.grid }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: CHART.tooltipBg,
                      border: `1px solid ${CHART.tooltipBorder}`,
                      borderRadius: 12,
                      color: "white",
                    }}
                    itemStyle={{ color: "white" }}
                    formatter={(v, name) => [fmtInt(v), name]}
                    labelFormatter={(l) => `Department: ${l}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="Essentials"
                    stackId="a"
                    name="Essentials"
                    fill={CHART.essentials}
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="Premium"
                    stackId="a"
                    name="Premium"
                    fill={CHART.premium}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className={cn(
              "rounded-2xl bg-white/80 dark:bg-black-950/40 p-4 overflow-hidden",
              BOX_BORDER
            )}
          >
            <p className="text-sm font-bold text-black-900 dark:text-white mb-3">
              Heatmap (Department × Week)
            </p>

            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `180px repeat(${heat.weeks.length}, minmax(64px, 1fr))`,
                  }}
                >
                  <div className="p-2 text-xs font-bold text-black-600 dark:text-black-300">
                    Department
                  </div>

                  {heat.weeks.map((w) => (
                    <div
                      key={w}
                      className="p-2 text-xs font-bold text-black-600 dark:text-black-300 text-center"
                    >
                      {w}
                    </div>
                  ))}

                  {heat.depts.map((d, i) => (
                    <React.Fragment key={d}>
                      <div
                        className={cn(
                          "p-2 text-sm font-semibold text-black-900 dark:text-white border-t",
                          BOX_BORDER
                        )}
                      >
                        {d}
                      </div>

                      {heat.matrix[i].map((val, j) => (
                        <div key={`${d}-${j}`} className={cn("border-t p-2 text-center", BOX_BORDER)}>
                          <div
                            className={cn(
                              "rounded-xl py-2 text-sm font-bold text-black-900 dark:text-white",
                              BOX_BORDER
                            )}
                            style={{ background: heatBg(val, heat.min, heat.max) }}
                            title={`${d} • ${heat.weeks[j]} • ${fmtInt(val)}`}
                          >
                            {fmtInt(val)}
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-black-600 dark:text-black-300 flex items-center gap-2">
              <span className="font-semibold">Scale:</span>
              <span className={cn("px-2 py-1 rounded-lg bg-white/70 dark:bg-black-950/30", BOX_BORDER)}>
                Low → High
              </span>
              <span className="ml-auto">
                Min:{" "}
                <span className="font-bold text-black-900 dark:text-white">
                  {fmtInt(heat.min)}
                </span>{" "}
                • Max:{" "}
                <span className="font-bold text-black-900 dark:text-white">
                  {fmtInt(heat.max)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* ===================== TABLE ===================== */}
        <div className="px-5 pb-5">
          <div className={cn("rounded-2xl bg-white/80 dark:bg-black-950/40 overflow-hidden", BOX_BORDER)}>
            <div className={cn("px-5 py-3 border-b", BOX_BORDER)}>
              <p className="text-sm font-bold text-black-900 dark:text-white">
                Department Plan vs Actual (Variance %)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={cn("border-b", BOX_BORDER)}>
                  <tr className="border-b border-slate-300 dark:border-slate-700">
                    <th className="py-3 px-5 font-semibold">Division</th>
                    <th className="py-3 px-5 font-semibold">Section</th>
                    <th className="py-3 px-5 font-semibold">Department</th>
                    <th className="py-3 px-5 font-semibold">Planned</th>
                    <th className="py-3 px-5 font-semibold">Actual</th>
                    <th className="py-3 px-5 font-semibold">Variance</th>
                  </tr>
                </thead>

                <tbody>
                  {deptPlanActual.slice(0, 8).map((r) => {
                    const isBad = r.variance < -5;
                    const isGood = r.variance > 5;

                    return (
                      <tr
                        key={`${r.division}-${r.section}-${r.department}`}
                        className={cn(
                          "border-t transition-colors",
                          BOX_BORDER,
                          "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        )}
                      >
                        <td className="py-3 px-5 font-semibold text-black-900 dark:text-white">
                          {r.division}
                        </td>
                        <td className="py-3 px-5 text-black-700 dark:text-black-200">
                          {r.section}
                        </td>
                        <td className="py-3 px-5 text-black-700 dark:text-black-200">
                          {r.department}
                        </td>
                        <td className="py-3 px-5 text-black-700 dark:text-black-200">
                          {fmtInt(r.planned)}
                        </td>
                        <td className="py-3 px-5 text-black-700 dark:text-black-200">
                          {fmtInt(r.actual)}
                        </td>
                        <td className="py-3 px-5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-1 rounded-lg border text-xs font-bold",
                              isGood &&
                                "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-400/20 dark:text-emerald-200",
                              isBad &&
                                "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/25 dark:border-rose-400/20 dark:text-rose-200",
                              !isGood &&
                                !isBad &&
                                "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-950/30 dark:border-slate-700 dark:text-slate-200"
                            )}
                          >
                            {(r.variance >= 0 ? "+" : "") + pct(r.variance, 1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
