import React, { useMemo, useState } from "react";
import { FaFilter, FaSearch, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";

const cn = (...a) => a.filter(Boolean).join(" ");

const num = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const pct = (planned, actual) => {
  const p = num(planned);
  const a = num(actual);
  if (p === 0) return a === 0 ? 0 : 100; 
  return ((a - p) / p) * 100;
};

const fmtPct = (x) => `${(Number.isFinite(x) ? x : 0).toFixed(2)}%`;

const GROUPS = [
  { key: "SKU", label: "SKU" },
  { key: "Division", label: "Division" },
  { key: "Section", label: "Section" },
  { key: "Department", label: "Department" },
  { key: "Vendor", label: "Vendor" },
];

const DEMO_ROWS = [
  {
    SKU: "SKU-1001",
    Division: "Mens",
    Section: "Mens(CMO)",
    Department: "Shirts",
    Vendor: "Vendor A",
    PlannedQty: 500,
    ActualQty: 540,
    PlannedValue: 250000,
    ActualValue: 270000,
  },
  {
    SKU: "SKU-1002",
    Division: "Mens",
    Section: "Mens(CMO)",
    Department: "Denim",
    Vendor: "Vendor B",
    PlannedQty: 300,
    ActualQty: 210,
    PlannedValue: 180000,
    ActualValue: 126000,
  },
  {
    SKU: "SKU-2001",
    Division: "Ladies",
    Section: "Ladies Western Wear(CMO)",
    Department: "Tops",
    Vendor: "Vendor A",
    PlannedQty: 450,
    ActualQty: 450,
    PlannedValue: 225000,
    ActualValue: 225000,
  },
  {
    SKU: "SKU-3001",
    Division: "Kids",
    Section: "Kids Boys(CMO)",
    Department: "Winter Garments",
    Vendor: "Vendor C",
    PlannedQty: 0,
    ActualQty: 120,
    PlannedValue: 0,
    ActualValue: 72000,
  },
];

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full border text-xs font-semibold transition",
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-black-700 border-[#0e71eb] hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function DeviationPill({ value }) {
  const v = Number.isFinite(value) ? value : 0;
  const cls =
    v > 0
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : v < 0
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", cls)}>
      {fmtPct(v)}
    </span>
  );
}

export default function StockPlanForecastingPlanVsActualPurchase() {
  const [rows] = useState(DEMO_ROWS);

  const [groupBy, setGroupBy] = useState("SKU");
  const [q, setQ] = useState("");
  const [division, setDivision] = useState("ALL");
  const [section, setSection] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [vendor, setVendor] = useState("ALL");

  const [sortKey, setSortKey] = useState("DeviationQtyPct"); 
  const [sortDir, setSortDir] = useState("desc"); 

  const divisions = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.Division).filter(Boolean)))], [rows]);
  const sections = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.Section).filter(Boolean)))], [rows]);
  const departments = useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((r) => r.Department).filter(Boolean)))],
    [rows]
  );
  const vendors = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.Vendor).filter(Boolean)))], [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (division !== "ALL" && r.Division !== division) return false;
      if (section !== "ALL" && r.Section !== section) return false;
      if (department !== "ALL" && r.Department !== department) return false;
      if (vendor !== "ALL" && r.Vendor !== vendor) return false;

      if (!query) return true;

      const blob = [
        r.SKU,
        r.Division,
        r.Section,
        r.Department,
        r.Vendor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(query);
    });
  }, [rows, q, division, section, department, vendor]);

  const grouped = useMemo(() => {
    const map = new Map();

    for (const r of filtered) {
      const k = String(r[groupBy] ?? "Unknown");

      if (!map.has(k)) {
        map.set(k, {
          Key: k,

          PlannedQty: 0,
          ActualQty: 0,
          PlannedValue: 0,
          ActualValue: 0,
          _items: [],
        });
      }

      const agg = map.get(k);
      agg.PlannedQty += num(r.PlannedQty);
      agg.ActualQty += num(r.ActualQty);
      agg.PlannedValue += num(r.PlannedValue);
      agg.ActualValue += num(r.ActualValue);
      agg._items.push(r);
    }

    const out = Array.from(map.values()).map((g) => {
      const devQty = g.ActualQty - g.PlannedQty;
      const devVal = g.ActualValue - g.PlannedValue;

      const devQtyPct = pct(g.PlannedQty, g.ActualQty);
      const devValPct = pct(g.PlannedValue, g.ActualValue);

      return {
        ...g,
        DeviationQty: devQty,
        DeviationValue: devVal,
        DeviationQtyPct: devQtyPct,
        DeviationValuePct: devValPct,
      };
    });

    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });

    return out;
  }, [filtered, groupBy, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t = {
      PlannedQty: 0,
      ActualQty: 0,
      PlannedValue: 0,
      ActualValue: 0,
    };
    for (const r of filtered) {
      t.PlannedQty += num(r.PlannedQty);
      t.ActualQty += num(r.ActualQty);
      t.PlannedValue += num(r.PlannedValue);
      t.ActualValue += num(r.ActualValue);
    }
    return {
      ...t,
      DeviationQtyPct: pct(t.PlannedQty, t.ActualQty),
      DeviationValuePct: pct(t.PlannedValue, t.ActualValue),
    };
  }, [filtered]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = sortDir === "asc" ? FaSortAmountUp : FaSortAmountDown;

  return (
    <div className="p-6">
      <div className="rounded-3xl border border-blue-500 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#0b6ff1]">
          <h3 className="text-lg font-bold text-black-700">Plan vs Actual Purchase</h3>
        </div>

        <div className="px-6 py-4 border-b border-[#0b70f5] flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-black-600 mr-1">Group by:</span>
            {GROUPS.map((g) => (
              <Chip key={g.key} active={groupBy === g.key} onClick={() => setGroupBy(g.key)}>
                {g.label}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 flex items-center gap-2 rounded-2xl border border-[#0771f1] bg-white px-3 py-2">
              <FaSearch className="text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search SKU / Division / Section / Dept / Vendor..."
                className="w-full outline-none text-sm text-slate-800"
              />
            </div>

            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="rounded-2xl border border-[#0b72f0] bg-white px-3 py-2 text-sm outline-none"
              title="Filter Division"
            >
              {divisions.map((x) => (
                <option key={x} value={x}>
                  Division: {x}
                </option>
              ))}
            </select>

            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="rounded-2xl border border-[#0e71eb] bg-white px-3 py-2 text-sm outline-none"
              title="Filter Section"
            >
              {sections.map((x) => (
                <option key={x} value={x}>
                  Section: {x}
                </option>
              ))}
            </select>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-2xl border border-[#0d71eb] bg-white px-3 py-2 text-sm outline-none"
              title="Filter Department"
            >
              {departments.map((x) => (
                <option key={x} value={x}>
                  Dept: {x}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="rounded-2xl border border-[#0b6fe9] bg-white px-3 py-2 text-sm outline-none lg:col-span-2"
              title="Filter Vendor"
            >
              {vendors.map((x) => (
                <option key={x} value={x}>
                  Vendor: {x}
                </option>
              ))}
            </select>

            <div className="lg:col-span-3 rounded-2xl border border-[#0f56f0] bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-black-700">
                <FaFilter />
                Totals (filtered):
              </div>
              <div className="text-xs text-black-800">
                Qty: <span className="font-bold">{totals.PlannedQty}</span> planned →{" "}
                <span className="font-bold">{totals.ActualQty}</span> actual{" "}
                <span className="ml-2">
                  <DeviationPill value={totals.DeviationQtyPct} />
                </span>
              </div>
              <div className="text-xs text-black-800">
                Value: <span className="font-bold">{Math.round(totals.PlannedValue)}</span> planned →{" "}
                <span className="font-bold">{Math.round(totals.ActualValue)}</span> actual{" "}
                <span className="ml-2">
                  <DeviationPill value={totals.DeviationValuePct} />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left">
            <thead className="bg-slate-50 border-b border-[#086bec]">
              <tr className="text-xs font-bold text-black-700">
                <th className="px-5 py-3"> {groupBy} </th>
                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("PlannedQty")}>
                  Planned Qty {sortKey === "PlannedQty" ? <SortIcon className="inline ml-1" /> : null}
                </th>
                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("ActualQty")}>
                  Actual Qty {sortKey === "ActualQty" ? <SortIcon className="inline ml-1" /> : null}
                </th>
                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("DeviationQtyPct")}>
                  Deviation % (Qty) {sortKey === "DeviationQtyPct" ? <SortIcon className="inline ml-1" /> : null}
                </th>

                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("PlannedValue")}>
                  Planned Value {sortKey === "PlannedValue" ? <SortIcon className="inline ml-1" /> : null}
                </th>
                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("ActualValue")}>
                  Actual Value {sortKey === "ActualValue" ? <SortIcon className="inline ml-1" /> : null}
                </th>
                <th className="px-5 py-3 cursor-pointer" onClick={() => toggleSort("DeviationValuePct")}>
                  Deviation % (Value) {sortKey === "DeviationValuePct" ? <SortIcon className="inline ml-1" /> : null}
                </th>
              </tr>
            </thead>

            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-sm text-slate-600">
                    No data found for your filters.
                  </td>
                </tr>
              ) : (
                grouped.map((g, idx) => (
                  <tr
                    key={`${g.Key}-${idx}`}
                    className={cn(
                      "border-b border-[#F1F5F9] text-sm",
                      idx % 2 === 0 ? "bg-white" : "bg-white/70"
                    )}
                  >
                    <td className="px-5 py-3 font-semibold text-black-700">{g.Key}</td>

                    <td className="px-5 py-3 text-black-700">{Math.round(g.PlannedQty)}</td>
                    <td className="px-5 py-3 text-black-700">{Math.round(g.ActualQty)}</td>
                    <td className="px-5 py-3">
                      <DeviationPill value={g.DeviationQtyPct} />
                    </td>

                    <td className="px-5 py-3 text-black-700">{Math.round(g.PlannedValue)}</td>
                    <td className="px-5 py-3 text-black-700">{Math.round(g.ActualValue)}</td>
                    <td className="px-5 py-3">
                      <DeviationPill value={g.DeviationValuePct} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
