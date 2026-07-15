import React, { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import {
  FaBoxes,
  FaChartBar,
  FaFilePdf,
  FaFilter,
  FaExclamationTriangle,
  FaCheckCircle,
  FaMinusCircle,
} from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");

const COLORS = {
  demand: "#2563EB",
  stock: "#16A34A",
  shortage: "#EF4444",
  excess: "#F59E0B",
  ok: "#22C55E",
  neutral: "#64748B",
};

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num(n));

const DEMO = [
  { month: "Apr", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 5200, currentStock: 4100 },
  { month: "May", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 5600, currentStock: 6300 },
  { month: "Jun", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 6100, currentStock: 5900 },
  { month: "Jul", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 6400, currentStock: 5200 },
  { month: "Aug", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 7000, currentStock: 6900 },
  { month: "Sep", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 7200, currentStock: 7900 },
  { month: "Oct", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 7800, currentStock: 6500 },
  { month: "Nov", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 8200, currentStock: 8700 },
  { month: "Dec", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastDemand: 9000, currentStock: 7600 },
];

function Badge({ type }) {
  const map = {
    SHORTAGE: {
      bg: "bg-red-100 dark:bg-red-950/40",
      bd: "border-red-200 dark:border-red-800/40",
      tx: "text-red-700 dark:text-red-200",
      icon: <FaExclamationTriangle />,
      label: "Shortage",
    },
    EXCESS: {
      bg: "bg-amber-100 dark:bg-amber-950/40",
      bd: "border-amber-200 dark:border-amber-800/40",
      tx: "text-amber-700 dark:text-amber-200",
      icon: <FaMinusCircle />,
      label: "Excess",
    },
    OK: {
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
      bd: "border-emerald-200 dark:border-emerald-800/40",
      tx: "text-emerald-700 dark:text-emerald-200",
      icon: <FaCheckCircle />,
      label: "Balanced",
    },
  };
  const m = map[type] || map.OK;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold",
        m.bg,
        m.bd,
        m.tx
      )}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function ActionChip({ action }) {
  const map = {
    REORDER: "bg-red-600 text-white",
    HOLD: "bg-black-800 text-white dark:bg-black-200 dark:text-black-900",
    REDUCE: "bg-amber-500 text-white",
  };
  const label =
    action === "REORDER" ? "Reorder" : action === "REDUCE" ? "Reduce buying" : "Hold";

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm",
        map[action] || map.HOLD
      )}
    >
      {label}
    </span>
  );
}

/** ✅ Glow + blink ONLY when mouse/touch is down */
const KPI = ({ icon, label, value, sub }) => {
  return (
    <div
      tabIndex={0}
      className={cn(
        "blink-card",
        "rounded-2xl border border-blue-500",
        "bg-white dark:bg-black-900 shadow-sm p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-wide text-black-600 dark:text-black-300">
            {label}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-black-900 dark:text-white">
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-xs text-black-500 dark:text-black-300">
              {sub}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-blue-500 bg-white dark:bg-black-950 p-2 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, sub, children }) => (
  <div
    tabIndex={0}
    className={cn(
      "blink-card print-card",
      "rounded-2xl border border-blue-500",
      "bg-white dark:bg-black-900 shadow-sm p-4"
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-extrabold text-black-900 dark:text-white">
        {title}
      </div>
      {sub ? (
        <div className="text-xs text-black-500 dark:text-black-300">{sub}</div>
      ) : null}
    </div>
    <div className="mt-3">{children}</div>
  </div>
);

export default function DemandVsStockGapAnalysisFullScreen() {
  const printRef = useRef(null);

  const [division, setDivision] = useState("All");
  const [section, setSection] = useState("All");
  const [department, setDepartment] = useState("All");

  const divisions = useMemo(
    () => ["All", ...Array.from(new Set(DEMO.map((d) => d.division)))],
    []
  );

  const sections = useMemo(() => {
    const base = DEMO.filter((d) => division === "All" || d.division === division);
    return ["All", ...Array.from(new Set(base.map((d) => d.section)))];
  }, [division]);

  const departments = useMemo(() => {
    const base = DEMO.filter(
      (d) =>
        (division === "All" || d.division === division) &&
        (section === "All" || d.section === section)
    );
    return ["All", ...Array.from(new Set(base.map((d) => d.department)))];
  }, [division, section]);

  const filtered = useMemo(() => {
    return DEMO.filter(
      (d) =>
        (division === "All" || d.division === division) &&
        (section === "All" || d.section === section) &&
        (department === "All" || d.department === department)
    );
  }, [division, section, department]);

  const rows = useMemo(() => {
    const EXCESS_PCT = 15;
    return filtered.map((r) => {
      const demand = num(r.forecastDemand);
      const stock = num(r.currentStock);
      const gap = stock - demand;

      const excessThreshold = demand * (EXCESS_PCT / 100);
      let flag = "OK";
      if (gap < 0) flag = "SHORTAGE";
      else if (gap > excessThreshold) flag = "EXCESS";

      let action = "HOLD";
      if (flag === "SHORTAGE") action = "REORDER";
      if (flag === "EXCESS") action = "REDUCE";

      const coverage = demand === 0 ? 0 : Math.max(0, (stock / demand) * 100);

      return {
        ...r,
        demand,
        stock,
        gap,
        flag,
        action,
        coverage,
        shortageQty: gap < 0 ? Math.abs(gap) : 0,
        excessQty: gap > 0 ? gap : 0,
      };
    });
  }, [filtered]);

  const summary = useMemo(() => {
    const n = rows.length || 1;

    const totalDemand = rows.reduce((s, r) => s + num(r.demand), 0);
    const totalStock = rows.reduce((s, r) => s + num(r.stock), 0);

    const shortageCount = rows.filter((r) => r.flag === "SHORTAGE").length;
    const excessCount = rows.filter((r) => r.flag === "EXCESS").length;

    const shortageQty = rows.reduce((s, r) => s + num(r.shortageQty), 0);
    const excessQty = rows.reduce((s, r) => s + num(r.excessQty), 0);

    const avgCoverage = rows.reduce((s, r) => s + num(r.coverage), 0) / n;

    return {
      totalDemand,
      totalStock,
      shortageCount,
      excessCount,
      shortageQty,
      excessQty,
      avgCoverage,
    };
  }, [rows]);

  const bars = useMemo(() => {
    return rows.map((r) => ({
      month: r.month,
      demand: r.demand,
      stock: r.stock,
      shortage: r.flag === "SHORTAGE" ? r.shortageQty : 0,
      excess: r.flag === "EXCESS" ? r.excessQty : 0,
      gap: r.gap,
    }));
  }, [rows]);

  const handleExportPDF = () => window.print();

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-black-50 dark:bg-black-950">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-area { height: auto !important; overflow: visible !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; }
        }

        /* ✅ GLOW + BLINK ON PRESS ONLY */
        @keyframes pressBlink {
          0%   { box-shadow: 0 0 0 rgba(59,130,246,0); transform: scale(1); filter: brightness(1); }
          35%  { box-shadow: 0 0 0 6px rgba(59,130,246,0.35), 0 10px 28px rgba(59,130,246,0.22); transform: scale(0.992); filter: brightness(1.04); }
          70%  { box-shadow: 0 0 0 2px rgba(59,130,246,0.20), 0 8px 22px rgba(59,130,246,0.18); transform: scale(0.996); filter: brightness(1.02); }
          100% { box-shadow: 0 0 0 rgba(59,130,246,0); transform: scale(1); filter: brightness(1); }
        }

        .blink-card {
          transition: transform 120ms ease;
          will-change: transform, box-shadow, filter;
          transform: tranblackZ(0);
        }

        /* Works on mouse + touch (mousedown/press) */
        .blink-card:active {
          animation: pressBlink 420ms ease-out;
        }
      `}</style>

      {/* TOP BAR: ONLY EXPORT BUTTON */}
      <div className="no-print sticky top-0 z-50 border-b border-blue-500 bg-white/70 dark:bg-blue-600 backdrop-blur">
        <div className="w-full px-3 sm:px-4 md:px-6 py-3 flex items-center justify-end">
          <button
            onClick={handleExportPDF}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold",
              "border border-blue-500",
              "bg-blue-600 text-white hover:bg-blue-800",
              "dark:bg-white dark:text-black-900 dark:hover:bg-black-200",
              "shadow-sm"
            )}
            style={{ borderRadius: 10 }}
          >
            <FaFilePdf />
            Export to PDF
          </button>
        </div>

        {/* FILTERS */}
        <div className="w-full px-3 sm:px-4 md:px-6 pb-3">
          <div className="rounded-2xl border border-blue-500 bg-white dark:bg-black-900 shadow-sm p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-black-900 dark:text-white">
              <FaFilter />
              Filters
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-black-600 dark:text-black-300">
                  Division
                </label>
                <select
                  value={division}
                  onChange={(e) => {
                    setDivision(e.target.value);
                    setSection("All");
                    setDepartment("All");
                  }}
                  className="mt-1 w-full rounded-xl border border-blue-500 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
                >
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-black-600 dark:text-black-300">
                  Section
                </label>
                <select
                  value={section}
                  onChange={(e) => {
                    setSection(e.target.value);
                    setDepartment("All");
                  }}
                  className="mt-1 w-full rounded-xl border border-blue-500 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
                >
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-black-600 dark:text-black-300">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-blue-500 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div ref={printRef} className="print-area w-full px-3 sm:px-4 md:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <KPI
            icon={<FaChartBar />}
            label="Total Forecast Demand"
            value={fmt(summary.totalDemand)}
            sub="Sum of selected months"
          />
          <KPI
            icon={<FaBoxes />}
            label="Total Current Stock"
            value={fmt(summary.totalStock)}
            sub={`Avg Coverage: ${summary.avgCoverage.toFixed(1)}%`}
          />
          <KPI
            icon={<FaExclamationTriangle />}
            label="Shortage (Months)"
            value={fmt(summary.shortageCount)}
            sub={`Qty short: ${fmt(summary.shortageQty)}`}
          />
          <KPI
            icon={<FaMinusCircle />}
            label="Excess (Months)"
            value={fmt(summary.excessCount)}
            sub={`Qty excess: ${fmt(summary.excessQty)}`}
          />
          <KPI
            icon={<FaCheckCircle />}
            label="Balanced"
            value={fmt(rows.filter((r) => r.flag === "OK").length)}
            sub="Months within safe zone"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Current Stock vs Forecast Demand" >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} barCategoryGap={18}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => fmt(v)} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="demand" name="Forecast Demand" fill={COLORS.demand} radius={[10, 10, 0, 0]} />
                  <Bar dataKey="stock" name="Current Stock" fill={COLORS.stock} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Gap Trend (Stock − Demand)" >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => fmt(v)} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke={COLORS.neutral} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="gap" name="Gap (Stock − Demand)" stroke={COLORS.demand} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Shortage vs Excess">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => fmt(v)} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke={COLORS.neutral} strokeDasharray="4 4" />
                  <Bar dataKey="shortage" name="Shortage Qty" fill={COLORS.shortage} />
                  <Bar dataKey="excess" name="Excess Qty" fill={COLORS.excess} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Coverage %">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={100} stroke={COLORS.stock} strokeDasharray="6 6" label="100% Coverage" />
                  <Line type="monotone" dataKey="coverage" name="Coverage %" stroke={COLORS.stock} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className={cn("mt-4 blink-card print-card rounded-2xl border border-blue-500 bg-white dark:bg-black-900 shadow-sm p-4")}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-black-900 dark:text-white">
              Demand vs Stock Gap Table
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="text-left bg-black-50 dark:bg-black-950/60">
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200 rounded-l-xl">Month</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200">Forecast Demand</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200">Current Stock</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200">Gap (Stock − Demand)</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200">Coverage %</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200">Flag</th>
                  <th className="px-4 py-3 font-bold text-black-700 dark:text-black-200 rounded-r-xl">Suggested Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.month}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold text-black-900 dark:text-white">{r.month}</td>
                    <td className="px-4 py-3 text-black-700 dark:text-black-200">{fmt(r.demand)}</td>
                    <td className="px-4 py-3 text-black-700 dark:text-black-200">{fmt(r.stock)}</td>
                    <td className="px-4 py-3 text-black-700 dark:text-black-200">
                      <span
                        className={cn(
                          "font-extrabold",
                          r.gap < 0
                            ? "text-red-600 dark:text-red-300"
                            : r.gap > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-black-700 dark:text-black-200"
                        )}
                      >
                        {fmt(r.gap)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black-700 dark:text-black-200">{r.coverage.toFixed(1)}%</td>
                    <td className="px-4 py-3"><Badge type={r.flag} /></td>
                    <td className="px-4 py-3"><ActionChip action={r.action} /></td>
                  </tr>
                ))}

                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-black-500 dark:text-black-300">
                      No data for selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
