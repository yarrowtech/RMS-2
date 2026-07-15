import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaUpload,
  FaDatabase,
  FaStore,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSync,
  FaFileExcel,
  FaFileCsv,
  FaPlug,
  FaWrench,
  FaFilePdf,
} from "react-icons/fa";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------- helpers ---------- */
const cn = (...a) => a.filter(Boolean).join(" ");

const fmtDateISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};

const isISODate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());

const toNumber = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};

const normalizeHeader = (h) =>
  String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const pickFirstMatch = (headers, aliases) => {
  for (const a of aliases) {
    const na = normalizeHeader(a);
    const found = headers.find((h) => normalizeHeader(h) === na);
    if (found) return found;
  }
  for (const a of aliases) {
    const na = normalizeHeader(a);
    const found = headers.find((h) => normalizeHeader(h).includes(na));
    if (found) return found;
  }
  for (const a of aliases) {
    const na = normalizeHeader(a);
    const found = headers.find((h) => na.includes(normalizeHeader(h)));
    if (found) return found;
  }
  return "";
};

const uniqSorted = (arr) =>
  Array.from(new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

/* ---------- fixed store master ---------- */
const STORE_MASTER = ["Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];

/* ---------- dummy sync data (for POS/ERP Sync Now) ---------- */
const DUMMY_SYNC_DATA = [
  {
    barcode: "8901234567890",
    sale_date: "2026-01-10",
    store_name: "Main - New Market",
    item_code: "SKU-10021",
    division: "Mens",
    section: "T-Shirts",
    department: "Winter/T-Shirt",
    sold_qty: 124,
    net_amount: 35640,
  },
  {
    barcode: "8909876543210",
    sale_date: "2026-01-10",
    store_name: "Store - Chowringhee",
    item_code: "SKU-11088",
    division: "Fmcg-Food",
    section: "Ready To Eat Biscuits",
    department: "Biscuits",
    sold_qty: 89,
    net_amount: 21490,
  },
  {
    barcode: "8907777777777",
    sale_date: "2026-01-11",
    store_name: "Store - Hatibagan",
    item_code: "SKU-22110",
    division: "Mens",
    section: "Jeans",
    department: "Denim",
    sold_qty: 56,
    net_amount: 33990,
  },
  {
    barcode: "8906666666666",
    sale_date: "2026-01-12",
    store_name: "Main - New Market",
    item_code: "SKU-33009",
    division: "Fmcg-Food",
    section: "Snacks",
    department: "Chips",
    sold_qty: 140,
    net_amount: 18990,
  },
];

/* ---------- auto-map dictionary ---------- */
const AUTO_MAP = {
  barcode: ["barcode", "bar_code", "ean", "ean13", "upc"],
  sku: ["sku", "item_code", "itemcode", "product_sku", "productcode", "sku_code", "product_code"],
  section: ["section", "sub_section", "subsection"],
  division: ["division", "div", "business_unit", "bu", "vertical"],
  department: ["department", "dept", "dept_name", "department_name", "management", "management_name"],
  date: ["date", "bill_date", "sale_date", "transaction_date", "invoice_date", "sales_date"],
  quantity: ["qty", "quantity", "units", "sold_qty", "sale_qty", "net_qty"],
  store: ["store", "branch", "location", "outlet", "store_name"],
  value: ["value", "amount", "net_amount", "sales_value", "mrp_value", "gross_amount"],
};

const REQUIRED_FIELDS = [
  "barcode",
  "sku",
  "section",
  "division",
  "department",
  "date",
  "quantity",
  "store",
  "value",
];

function StatusPill({ status, reason }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-50 border border-green-200 text-green-700">
        <FaCheckCircle /> Valid
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span
        title={reason || "Warning"}
        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700"
      >
        <FaExclamationTriangle /> Warning
      </span>
    );
  }
  return (
    <span
      title={reason || "Error"}
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700"
    >
      <FaTimesCircle /> Error
    </span>
  );
}

const FilterSelect = ({ label, value, onChange, options, icon }) => {
  return (
    <div className="bg-white border border-blue-500 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-700">{icon}</span>
        <p className="font-semibold text-slate-900 text-sm">{label}</p>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-blue-500 rounded-md px-3 py-2 text-sm bg-white"
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      {value !== "All" && (
        <p className="mt-2 text-[11px] text-slate-500">
          Filter active: <span className="font-semibold">{value}</span>
        </p>
      )}
    </div>
  );
};

export default function StockPlanForecastingSalesDataImportIntegration() {
  const [source, setSource] = useState("file"); // file | pos | erp
  const [file, setFile] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });

  // ✅ filters
  const [storeFilter, setStoreFilter] = useState("All");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const [syncStatus, setSyncStatus] = useState("idle");
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);

  const [mapping, setMapping] = useState({
    barcode: "",
    sku: "",
    section: "",
    division: "",
    department: "",
    date: "",
    quantity: "",
    store: "",
    value: "",
  });

  const fileInputRef = useRef(null);

  /* ✅ auto-map when headers available */
  useEffect(() => {
    if (!headers.length) return;
    setMapping((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(AUTO_MAP)) {
        if (!next[key]) next[key] = pickFirstMatch(headers, AUTO_MAP[key]);
      }
      return next;
    });
  }, [headers]);

  const parseCSV = async (f) =>
    new Promise((resolve, reject) => {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data || []),
        error: (err) => reject(err),
      });
    });

  const parseXLSX = async (f) => {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(ws, { defval: "" }) || [];
  };

  const onPickFile = async (f) => {
    setFile(f || null);
    setRawRows([]);
    setHeaders([]);
    setSyncStatus("idle");

    // reset filters (no Reset button, but safe on new file)
    setStoreFilter("All");
    setDivisionFilter("All");
    setSectionFilter("All");
    setDepartmentFilter("All");

    if (!f) return;

    try {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      let rows = [];
      if (ext === "csv") rows = await parseCSV(f);
      else if (ext === "xlsx" || ext === "xls") rows = await parseXLSX(f);
      else throw new Error("Unsupported file type. Please use .csv or .xlsx");

      const cleanRows = rows.filter((r) => r && Object.keys(r).length);
      const hdrs = cleanRows.length > 0 ? Object.keys(cleanRows[0]).filter(Boolean) : [];
      setRawRows(cleanRows);
      setHeaders(hdrs);
    } catch (e) {
      console.error(e);
      setSyncStatus("error");
      alert(e?.message || "Failed to parse file");
    }
  };

  /* ✅ Dummy sync for POS/ERP */
  const runConnectorSync = async () => {
    setSyncStatus("syncing");

    setStoreFilter("All");
    setDivisionFilter("All");
    setSectionFilter("All");
    setDepartmentFilter("All");

    await new Promise((r) => setTimeout(r, 800));

    setRawRows(DUMMY_SYNC_DATA);
    setHeaders(Object.keys(DUMMY_SYNC_DATA[0] || {}));
    setFile(null);
    setSyncStatus("success");
  };

  const mappingHealth = useMemo(() => {
    const missing = REQUIRED_FIELDS.filter((k) => !mapping[k]);
    return { ok: missing.length === 0, missing };
  }, [mapping]);

  const standardizedAll = useMemo(() => {
    if (!rawRows.length || !mappingHealth.ok) return [];

    const from = range.from ? new Date(range.from) : null;
    const to = range.to ? new Date(range.to) : null;

    return rawRows.map((r, idx) => {
      const barcode = String(r[mapping.barcode] ?? "").trim();
      const sku = String(r[mapping.sku] ?? "").trim();
      const division = String(r[mapping.division] ?? "").trim();
      const section = String(r[mapping.section] ?? "").trim();
      const department = String(r[mapping.department] ?? "").trim();

      const dtRaw = r[mapping.date];
      const dt = isISODate(dtRaw) ? String(dtRaw).trim() : fmtDateISO(dtRaw);

      const qty = toNumber(r[mapping.quantity]);
      const st = String(r[mapping.store] ?? "").trim();
      const val = toNumber(r[mapping.value]);

      let status = "ok";
      let reason = "";

      const missingRequired =
        !barcode ||
        !sku ||
        !division ||
        !section ||
        !department ||
        !dt ||
        !Number.isFinite(qty) ||
        !st ||
        !Number.isFinite(val);

      if (missingRequired) {
        status = "error";
        reason =
          "Missing required (Barcode/SKU/Division/Section/Department/Date/Quantity/Store/Value)";
      } else if (qty <= 0) {
        status = "warn";
        reason = "Quantity is 0 or negative";
      } else if (from && to) {
        const d = new Date(dt);
        if (!Number.isNaN(d.getTime()) && (d < from || d > to)) {
          status = "warn";
          reason = "Date is outside selected period";
        }
      }

      return {
        _i: idx + 1,
        barcode,
        date: dt,
        store: st,
        sku,
        division,
        section,
        department,
        quantity: qty,
        value: val,
        status,
        reason,
      };
    });
  }, [rawRows, mapping, range.from, range.to, mappingHealth.ok]);

  /* ✅ Store options are fixed (only 3 stores) */
  const storeOptions = useMemo(() => STORE_MASTER, []);

  const divisionOptions = useMemo(
    () =>
      uniqSorted(
        standardizedAll
          .filter((r) => (storeFilter === "All" ? true : r.store === storeFilter))
          .map((r) => r.division)
      ),
    [standardizedAll, storeFilter]
  );

  const sectionOptions = useMemo(
    () =>
      uniqSorted(
        standardizedAll
          .filter((r) => (storeFilter === "All" ? true : r.store === storeFilter))
          .filter((r) => (divisionFilter === "All" ? true : r.division === divisionFilter))
          .map((r) => r.section)
      ),
    [standardizedAll, storeFilter, divisionFilter]
  );

  const departmentOptions = useMemo(
    () =>
      uniqSorted(
        standardizedAll
          .filter((r) => (storeFilter === "All" ? true : r.store === storeFilter))
          .filter((r) => (divisionFilter === "All" ? true : r.division === divisionFilter))
          .filter((r) => (sectionFilter === "All" ? true : r.section === sectionFilter))
          .map((r) => r.department)
      ),
    [standardizedAll, storeFilter, divisionFilter, sectionFilter]
  );

  const standardized = useMemo(() => {
    let rows = standardizedAll;

    if (storeFilter !== "All") rows = rows.filter((r) => r.store === storeFilter);
    if (divisionFilter !== "All") rows = rows.filter((r) => r.division === divisionFilter);
    if (sectionFilter !== "All") rows = rows.filter((r) => r.section === sectionFilter);
    if (departmentFilter !== "All") rows = rows.filter((r) => r.department === departmentFilter);

    return rows;
  }, [standardizedAll, storeFilter, divisionFilter, sectionFilter, departmentFilter]);

  /* cascading safety */
  useEffect(() => {
    if (divisionFilter !== "All" && !divisionOptions.includes(divisionFilter)) {
      setDivisionFilter("All");
      setSectionFilter("All");
      setDepartmentFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionOptions.join("|")]);

  useEffect(() => {
    if (sectionFilter !== "All" && !sectionOptions.includes(sectionFilter)) {
      setSectionFilter("All");
      setDepartmentFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionOptions.join("|")]);

  useEffect(() => {
    if (departmentFilter !== "All" && !departmentOptions.includes(departmentFilter)) {
      setDepartmentFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentOptions.join("|")]);

  /* store safety (fixed list) */
  useEffect(() => {
    if (storeFilter !== "All" && !STORE_MASTER.includes(storeFilter)) {
      setStoreFilter("All");
      setDivisionFilter("All");
      setSectionFilter("All");
      setDepartmentFilter("All");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter]);

  const summary = useMemo(() => {
    let ok = 0,
      warn = 0,
      error = 0;
    for (const r of standardized) {
      if (r.status === "ok") ok++;
      else if (r.status === "warn") warn++;
      else error++;
    }
    return { ok, warn, error, total: standardized.length };
  }, [standardized]);

  const overallReady = mappingHealth.ok && summary.total > 0 && summary.error === 0;

  /* ✅ PDF export */
  const exportPDF = () => {
    if (!standardized.length) {
      alert("No rows available to export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    const title =
      source === "pos"
        ? "Sales Data Import - POS"
        : source === "erp"
        ? "Sales Data Import - ERP"
        : "Sales Data Import - File";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, pageWidth / 2, 34, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const filterLine = [
      `Store: ${storeFilter}`,
      `Division: ${divisionFilter}`,
      `Section: ${sectionFilter}`,
      `Department: ${departmentFilter}`,
      `From: ${range.from || "—"}`,
      `To: ${range.to || "—"}`,
    ].join("   |   ");

    doc.text(filterLine, 40, 56);
    doc.text(
      `Rows: ${standardized.length}   Valid: ${summary.ok}   Warn: ${summary.warn}   Error: ${summary.error}`,
      40,
      72
    );

    const head = [
      ["#", "Status", "Barcode", "Date", "Store", "SKU", "Division", "Section", "Department", "Qty", "Value"],
    ];

    const body = standardized.map((r) => [
      String(r._i),
      r.status === "ok" ? "Valid" : r.status === "warn" ? "Warning" : "Error",
      r.barcode || "—",
      r.date || "—",
      r.store || "—",
      r.sku || "—",
      r.division || "—",
      r.section || "—",
      r.department || "—",
      Number.isFinite(r.quantity) ? String(r.quantity) : "—",
      Number.isFinite(r.value) ? `₹${Math.round(r.value)}` : "—",
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 90,
      styles: {
        font: "helvetica",
        fontSize: 6.5,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
        lineColor: [37, 99, 235],
        lineWidth: 0.35,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        lineColor: [37, 99, 235],
        lineWidth: 0.55,
      },
      margin: { left: 14, right: 14 },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`Sales_Import_${source}_${stamp}.pdf`);
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Data Import & Integration</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportPDF}
            disabled={!standardized.length}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-md border inline-flex items-center gap-2",
              standardized.length
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            <FaFilePdf /> Export PDF
          </button>

          <button
            disabled={!overallReady}
            onClick={() => alert("✅ Import committed (hook this to API)")}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-md text-white",
              overallReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
            )}
          >
            Confirm Import
          </button>
        </div>
      </div>

      {/* Import Source */}
      <div className="bg-white border border-blue-500 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FaPlug className="text-blue-700" />
          <h3 className="font-semibold text-slate-900">Import Source</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={source}
            onChange={(e) => {
              const v = e.target.value;
              setSource(v);
              setRawRows([]);
              setHeaders([]);
              setSyncStatus("idle");
              setFile(null);

              setStoreFilter("All");
              setDivisionFilter("All");
              setSectionFilter("All");
              setDepartmentFilter("All");

              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="w-full border border-blue-500 rounded-md px-3 py-2 text-sm"
          >
            <option value="file">CSV / Excel</option>
            <option value="pos">POS</option>
            <option value="erp">ERP</option>
          </select>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">From Date</label>
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange((s) => ({ ...s, from: e.target.value }))}
              className="w-full border border-blue-500 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">To Date</label>
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange((s) => ({ ...s, to: e.target.value }))}
              className="w-full border border-blue-500 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect
            label="Store Selection"
            value={storeFilter}
            onChange={(v) => {
              setStoreFilter(v);
              setDivisionFilter("All");
              setSectionFilter("All");
              setDepartmentFilter("All");
            }}
            options={storeOptions}
            icon={<FaStore className="text-emerald-600" />}
          />

          <FilterSelect
            label="Division"
            value={divisionFilter}
            onChange={(v) => {
              setDivisionFilter(v);
              setSectionFilter("All");
              setDepartmentFilter("All");
            }}
            options={divisionOptions}
            icon={<FaDatabase className="text-blue-700" />}
          />

          <FilterSelect
            label="Section"
            value={sectionFilter}
            onChange={(v) => {
              setSectionFilter(v);
              setDepartmentFilter("All");
            }}
            options={sectionOptions}
            icon={<FaDatabase className="text-indigo-700" />}
          />

          <FilterSelect
            label="Department"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departmentOptions}
            icon={<FaDatabase className="text-violet-700" />}
          />
        </div>

        {/* Connector Status */}
        <div className="mt-4 bg-white border border-blue-500 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FaDatabase className="text-blue-700 text-lg" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {source === "pos" ? "POS Integration" : source === "erp" ? "ERP Integration" : "Connector Status"}
                </p>
                <p className="text-xs text-slate-500">
                  {source === "file"
                    ? "Choose file import to upload CSV / Excel"
                    : syncStatus === "syncing"
                    ? "Syncing data…"
                    : syncStatus === "success"
                    ? "Loaded dummy sync data"
                    : "Not synced yet"}
                </p>
              </div>
            </div>

            <button
              disabled={source === "file" || syncStatus === "syncing"}
              onClick={runConnectorSync}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-md text-white inline-flex items-center gap-2",
                source === "file" ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700",
                syncStatus === "syncing" && "opacity-80"
              )}
            >
              <FaSync className={cn(syncStatus === "syncing" && "animate-spin")} />
              Sync Now
            </button>
          </div>
        </div>
      </div>

      {/* Upload */}
      {source === "file" && (
        <div className="bg-white border border-blue-500 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FaUpload className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">Upload Sales File</h3>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => onPickFile(e.target.files?.[0])}
              className="block w-full text-sm text-slate-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border">
                <FaFileCsv /> CSV
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 border">
                <FaFileExcel /> XLSX
              </span>
            </div>
          </div>

          {file && <p className="mt-2 text-xs text-emerald-600 font-semibold">✔ {file.name} selected</p>}
        </div>
      )}

      {/* Auto-mapping */}
      <div className="bg-white border border-blue-500 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FaWrench className="text-indigo-700" />
          <h3 className="font-semibold text-slate-900">Auto Mapping</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          {[
            ["barcode", "Barcode"],
            ["sku", "SKU"],
            ["division", "Division"],
            ["section", "Section"],
            ["department", "Department"],
            ["date", "Date"],
            ["quantity", "Quantity"],
            ["store", "Store"],
            ["value", "Value"],
          ].map(([key, label]) => {
            const mapped = mapping[key];
            return (
              <div
                key={key}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  mapped ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
                )}
              >
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className={cn("mt-1 text-sm font-bold", mapped ? "text-green-700" : "text-red-600")}>
                  {mapped || "Not detected"}
                </p>
              </div>
            );
          })}
        </div>

        {!mappingHealth.ok && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Missing mapping: <span className="font-semibold">{mappingHealth.missing.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-white border border-blue-500 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-blue-300 font-semibold text-slate-900 flex items-center justify-between">
          <span>Imported Sales Preview</span>
          <span className="text-xs text-slate-600">
            Rows: <span className="font-semibold">{summary.total}</span> | ✔{" "}
            <span className="font-semibold">{summary.ok}</span> | ⚠{" "}
            <span className="font-semibold">{summary.warn}</span> | ❌{" "}
            <span className="font-semibold">{summary.error}</span>
          </span>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-slate-100 text-black-700">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Barcode</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Store</th>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-left">Division</th>
                <th className="px-4 py-2 text-left">Section</th>
                <th className="px-4 py-2 text-left">Department</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Value</th>
              </tr>
            </thead>

            <tbody>
              {standardized.slice(0, 200).map((r) => (
                <tr key={r._i} className="border-t border-blue-500">
                  <td className="px-4 py-2 text-black-500">{r._i}</td>
                  <td className="px-4 py-2">
                    <StatusPill status={r.status} reason={r.reason} />
                  </td>
                  <td className="px-4 py-2">{r.barcode || "—"}</td>
                  <td className="px-4 py-2">{r.date || "—"}</td>
                  <td className="px-4 py-2">{r.store || "—"}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{r.sku || "—"}</td>
                  <td className="px-4 py-2">{r.division || "—"}</td>
                  <td className="px-4 py-2">{r.section || "—"}</td>
                  <td className="px-4 py-2">{r.department || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {Number.isFinite(r.quantity) ? r.quantity : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {Number.isFinite(r.value) ? `₹${r.value}` : "—"}
                  </td>
                </tr>
              ))}

              {!standardized.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    No data loaded yet. {source === "file" ? "Upload a CSV/XLSX file." : "Click Sync Now to fetch POS/ERP data."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {standardized.length > 200 && (
          <div className="px-5 py-3 text-xs text-slate-500 border-t">
            Showing first 200 rows for preview. (PDF exports all filtered rows.)
          </div>
        )}
      </div>
    </div>
  );
}
