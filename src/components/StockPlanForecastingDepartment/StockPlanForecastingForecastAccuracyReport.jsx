import React, { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import {
  FaChartLine,
  FaBullseye,
  FaBalanceScale,
  FaPercent,
  FaFilePdf,
  FaFilter,
} from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");

const COLORS = {
  forecast: "#2563EB",
  actual: "#16A34A",
  accuracy: "#9333EA",
  mape: "#F59E0B",
  over: "#EF4444",
  under: "#0EA5E9",
  absError: "#64748B",
  target: "#22C55E",
  warning: "#FB7185",
  blue500: "rgb(59 130 246)",
};

const money = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

const pct = (n, d = 2) => `${Number(n || 0).toFixed(d)}%`;

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const accuracyPct = (forecast, actual) => {
  const A = Math.abs(num(actual));
  const F = num(forecast);
  if (A === 0) return 0;
  return Math.max(0, (1 - Math.abs(F - actual) / A) * 100);
};

const apePct = (forecast, actual) => {
  const A = Math.abs(num(actual));
  if (A === 0) return 0;
  return (Math.abs(num(forecast) - num(actual)) / A) * 100;
};

const biasVal = (forecast, actual) => num(forecast) - num(actual);

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-900 shadow-lg p-3 text-sm">
      <div className="font-semibold text-black-900 dark:text-black-100">
        {label}
      </div>
      <div className="mt-2 space-y-1">
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center justify-between gap-6">
            <span className="text-black-600 dark:text-black-300">{p.name}</span>
            <span className="font-semibold text-black-900 dark:text-black-100">
              {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEMO = [
  { month: "Apr", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1250000, actualSales: 1185000 },
  { month: "May", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1320000, actualSales: 1412000 },
  { month: "Jun", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1390000, actualSales: 1345000 },
  { month: "Jul", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1510000, actualSales: 1490000 },
  { month: "Aug", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1580000, actualSales: 1628000 },
  { month: "Sep", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1660000, actualSales: 1555000 },
  { month: "Oct", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1720000, actualSales: 1815000 },
  { month: "Nov", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 1890000, actualSales: 1932000 },
  { month: "Dec", division: "Mens", section: "Mens(Bi)", department: "Shirts", forecastSales: 2050000, actualSales: 1984000 },
];

const KPI = ({ icon, label, value, sub, tone = "indigo" }) => {
  const tones = {
    indigo: "from-indigo-500/15 to-indigo-500/5",
    emerald: "from-emerald-500/15 to-emerald-500/5",
    amber: "from-amber-500/15 to-amber-500/5",
    rose: "from-rose-500/15 to-rose-500/5",
    black: "from-black-500/15 to-black-500/5",
  };

  return (
    <div
      tabIndex={0}
      className={cn(
        "blink-card",
        "rounded-2xl border border-blue-500 dark:border-blue-600",
        "bg-gradient-to-br p-4 shadow-sm",
        "bg-white dark:bg-black-900",
        tones[tone] || tones.indigo
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
        <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-black-950 p-2 shadow-sm">
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
      "rounded-2xl border border-blue-500 dark:border-blue-600",
      "bg-white dark:bg-slate-900 shadow-sm p-4"
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

export default function ForecastAccuracyReportFullScreen() {
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

  const series = useMemo(() => {
    return filtered.map((r) => {
      const acc = accuracyPct(r.forecastSales, r.actualSales);
      const ape = apePct(r.forecastSales, r.actualSales);
      const bias = biasVal(r.forecastSales, r.actualSales);
      const absError = Math.abs(num(r.forecastSales) - num(r.actualSales));
      return { ...r, accuracy: acc, ape, mape: ape, bias, absError };
    });
  }, [filtered]);

  const summary = useMemo(() => {
    const n = series.length || 1;

    const totalForecast = series.reduce((s, r) => s + num(r.forecastSales), 0);
    const totalActual = series.reduce((s, r) => s + num(r.actualSales), 0);

    const mapeOverall = series.reduce((s, r) => s + num(r.ape), 0) / n;
    const biasOverall = series.reduce((s, r) => s + num(r.bias), 0) / n;
    const accOverall = series.reduce((s, r) => s + num(r.accuracy), 0) / n;

    const absErrTotal = series.reduce((s, r) => s + num(r.absError), 0);

    const status =
      accOverall >= 90
        ? "Excellent"
        : accOverall >= 80
        ? "Good"
        : accOverall >= 70
        ? "Needs Tuning"
        : "High Risk";

    return {
      totalForecast,
      totalActual,
      mapeOverall,
      biasOverall,
      accOverall,
      absErrTotal,
      status,
    };
  }, [series]);

  const biasBars = useMemo(() => {
    return series.map((r) => ({
      month: r.month,
      overForecast: r.bias > 0 ? r.bias : 0,
      underForecast: r.bias < 0 ? Math.abs(r.bias) : 0,
      bias: r.bias,
    }));
  }, [series]);

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

        /* ✅ blink/glow ONLY on hover/touch/focus */
        @keyframes kpiBlink {
          0%   { box-shadow: 0 0 0 rgba(59,130,246,0); transform: tranblackZ(0) scale(1); }
          45%  { box-shadow: 0 0 0 4px rgba(59,130,246,0.22); }
          100% { box-shadow: 0 0 0 rgba(59,130,246,0); transform: tranblackZ(0) scale(1.01); }
        }
        .blink-card {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
          transform: tranblackZ(0);
          will-change: transform, box-shadow;
        }
        .blink-card:hover { animation: kpiBlink 520ms ease-out; border-color: rgb(59 130 246); }
        .blink-card:active { animation: kpiBlink 520ms ease-out; border-color: rgb(59 130 246); }
        .blink-card:focus-visible { outline: none; animation: kpiBlink 520ms ease-out; border-color: rgb(59 130 246); }
      `}</style>

      <div className="no-print sticky top-0 z-50 border-b border-blue-500/50 dark:border-blue-600/50 bg-white/80 dark:bg-black-950/70 backdrop-blur">
        <div className="w-full px-3 sm:px-4 md:px-6 py-3 flex items-center justify-end">
          <button
            onClick={handleExportPDF}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold",
              "bg-black-900 text-white hover:bg-black-800",
              "dark:bg-white dark:text-black-900 dark:hover:bg-black-200",
              "shadow-sm"
            )}
            style={{ borderRadius: 10 }}
          >
            <FaFilePdf />
            Export to PDF
          </button>
        </div>

        <div className="w-full px-3 sm:px-4 md:px-6 pb-3">
          <div className="rounded-2xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-900 shadow-sm p-4">
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
                  className="mt-1 w-full rounded-xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
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
                  className="mt-1 w-full rounded-xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
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
                  className="mt-1 w-full rounded-xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-950 px-3 py-2 text-sm text-black-900 dark:text-white"
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

      <div ref={printRef} className="print-area w-full px-3 sm:px-4 md:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <KPI
            tone="indigo"
            icon={<FaPercent />}
            label="Overall Accuracy"
            value={pct(summary.accOverall, 2)}
            sub={`Status: ${summary.status}`}
          />
          <KPI
            tone="amber"
            icon={<FaBullseye />}
            label="MAPE (Overall)"
            value={pct(summary.mapeOverall, 2)}
            sub="Lower is better"
          />
          <KPI
            tone="rose"
            icon={<FaBalanceScale />}
            label="Bias (Avg)"
            value={money(summary.biasOverall)}
            sub={
              summary.biasOverall > 0
                ? "Over-forecasting"
                : summary.biasOverall < 0
                ? "Under-forecasting"
                : "Neutral"
            }
          />
          <KPI
            tone="black"
            icon={<FaChartLine />}
            label="Total Forecast"
            value={money(summary.totalForecast)}
            sub="Sum of selected range"
          />
          <KPI
            tone="emerald"
            icon={<FaChartLine />}
            label="Total Actual"
            value={money(summary.totalActual)}
            sub={`Abs Error Total: ${money(summary.absErrTotal)}`}
          />
        </div>

        {/* CHARTS */}
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Forecast vs Actual Sales" sub="Month-wise comparison">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => money(v)} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="forecastSales"
                    name="Forecast"
                    stroke={COLORS.forecast}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualSales"
                    name="Actual"
                    stroke={COLORS.actual}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Month-wise Accuracy Trend" sub="Higher is better">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<MonthTooltip />} />
                  <Legend />
                  <ReferenceLine
                    y={90}
                    stroke={COLORS.target}
                    strokeDasharray="6 6"
                    label="Target 90%"
                  />
                  <ReferenceLine
                    y={80}
                    stroke={COLORS.warning}
                    strokeDasharray="4 4"
                    label="Risk 80%"
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy %"
                    stroke={COLORS.accuracy}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="MAPE / Error Trend" sub="Lower is better">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<MonthTooltip />} />
                  <Legend />
                  <ReferenceLine
                    y={15}
                    stroke={COLORS.warning}
                    strokeDasharray="4 4"
                    label="15% Limit"
                  />
                  <Bar
                    dataKey="mape"
                    name="MAPE (APE %)"
                    fill={COLORS.mape}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Forecast Bias (Over vs Under)" sub="+ Over • − Under">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={biasBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => money(v)} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke={COLORS.absError} strokeDasharray="4 4" />
                  <Bar
                    dataKey="overForecast"
                    name="Over-forecast"
                    fill={COLORS.over}
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="underForecast"
                    name="Under-forecast"
                    fill={COLORS.under}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Absolute Error Trend" sub="Monthly deviation magnitude">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => money(v)} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="absError"
                    name="Abs Error"
                    stroke={COLORS.absError}
                    fill={COLORS.forecast}
                    fillOpacity={0.12}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Accuracy vs MAPE (Comparison)" sub="Best zone: high accuracy, low MAPE">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<MonthTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy %"
                    stroke={COLORS.accuracy}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="mape"
                    name="MAPE %"
                    stroke={COLORS.mape}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-4 print-card rounded-2xl border border-blue-500 dark:border-blue-600 bg-white dark:bg-black-900 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-black-900 dark:text-white">
              Detailed Month-wise Metrics
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="text-left bg-black-50 dark:bg-black-950/60">
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200 rounded-l-xl">
                    Month
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200">
                    Forecast
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200">
                    Actual
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200">
                    Accuracy %
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200">
                    MAPE %
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200">
                    Bias (F − A)
                  </th>
                  <th className="px-3 py-2 font-bold text-black-700 dark:text-black-200 rounded-r-xl">
                    Abs Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.map((r, idx) => (
                  <tr
                    key={`${r.month}-${idx}`}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-3 py-2 font-semibold text-black-900 dark:text-white">
                      {r.month}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {money(r.forecastSales)}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {money(r.actualSales)}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {pct(r.accuracy, 2)}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {pct(r.mape, 2)}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {money(r.bias)}
                    </td>
                    <td className="px-3 py-2 text-black-700 dark:text-black-200">
                      {money(r.absError)}
                    </td>
                  </tr>
                ))}

                {!series.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-black-500 dark:text-black-300"
                    >
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
