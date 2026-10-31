// Ported from the old Stock Planning & Forecasting department's
// ForecastAndStockGap.jsx — that department is being retired since its
// other tabs (Purchase Plan Creation, Budget Allocation, Approval Workflow,
// Plan vs Actual, Forecast Accuracy) duplicated what Forecast & Analytics
// already does with live data. This one tab was genuinely useful and reads
// real uploaded sales/stock snapshots, so it moves here instead of being
// deleted with the rest. Logic and backend endpoints (/api/upload/stock-gap,
// /api/upload/filters/options) are unchanged from the original.
import React, { useEffect, useMemo, useState } from "react";
import { FaFilePdf, FaFileExcel, FaLayerGroup, FaUsers, FaClock, FaWarehouse } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../config/api.js";

const cn = (...a) => a.filter(Boolean).join(" ");

const MultiSelect = ({ label, options, selected, setSelected, icon }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(
    () => options.filter((o) => o?.toLowerCase?.().includes(search.toLowerCase())),
    [search, options]
  );

  const toggleOption = (option) =>
    selected.includes(option)
      ? setSelected(selected.filter((s) => s !== option))
      : setSelected([...selected, option]);

  return (
    <div className="relative rounded-xl border border-indigo-200 bg-white p-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <span className="text-indigo-600">{icon}</span>
          <p className="text-xs font-bold text-slate-800">{label}</p>
        </div>
        <span className="text-xs text-slate-500">{selected.length ? `${selected.length} selected` : "All"}</span>
      </div>

      {open && (
        <div className="absolute z-20 bg-white border border-indigo-200 rounded-lg shadow-lg mt-2 w-full max-h-60 overflow-y-auto">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full px-2 py-1 text-xs border-b outline-none" />
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((opt) => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1 hover:bg-indigo-50 cursor-pointer text-xs">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} className="accent-indigo-600" />
                {opt}
              </label>
            ))}
            {!filteredOptions.length && <p className="px-3 py-2 text-xs text-slate-500">No match found</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ForecastStockGapView() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [holdingDays, setHoldingDays] = useState(45);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  const [stores, setStores] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedStores, setSelectedStores] = useState([]);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) >= 2000;

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/upload/filters/options`);
        const json = await res.json();
        setStores(json.stores || []);
        setDivisions(json.divisions || []);
        setSections(json.sections || []);
        setDepartments(json.departments || []);
        setVendors(json.vendors || []);
        setCategories(json.categories || []);
      } catch (err) { console.error("Failed to load filter options", err); }
    };
    fetchFilterOptions();
  }, []);

  const fetchStockGap = async () => {
    if (!isValidDate(fromDate) || !isValidDate(toDate)) return alert("Please select valid From and To dates.");
    try {
      setLoading(true);
      const params = new URLSearchParams({
        fromDate, toDate,
        store: selectedStores.length ? selectedStores.join(",") : "All",
        division: selectedDivisions.length ? selectedDivisions.join(",") : "All",
        section: selectedSections.length ? selectedSections.join(",") : "All",
        department: selectedDepartments.length ? selectedDepartments.join(",") : "All",
        vendor: selectedVendors.length ? selectedVendors.join(",") : "All",
        category: selectedCategories.length ? selectedCategories.join(",") : "All",
        holdingDays,
      });
      const res = await fetch(`${API_BASE_URL}/api/upload/stock-gap?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) { console.error(err); alert("Failed to fetch data."); }
    finally { setLoading(false); }
  };

  const exportPDF = () => {
    if (!data.length) return alert("No data to export.");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(12);
    doc.text(`Stock Gap Report (Holding: ${holdingDays} days)`, 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [["Store", "Division", "Section", "Department", "Vendor", "Cat1", "Cat2", "Cat3", "Cat4", "Cat5", "Sales Qty", "Store Stock", "Godown Stock", "Total Stock", "Stock Holding", "Variance"]],
      body: data.map((r) => [r.store, r.division, r.section, r.department, r.vendor, r.category1, r.category2, r.category3, r.category4, r.category5, r.salesQty, r.storeStock, r.godownStock, r.totalStock, r.stockHolding, r.variance]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [49, 46, 129], textColor: [255, 255, 255] },
    });
    doc.save(`StockGapReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportExcel = () => {
    if (!data.length) return alert("No data to export.");
    const headers = ["Store", "Division", "Section", "Department", "Vendor", "Cat1", "Cat2", "Cat3", "Cat4", "Cat5", "Sales Qty", "Store Stock", "Godown Stock", "Total Stock", "Stock Holding", "Variance"];
    const rows = data.map((r) => [r.store, r.division, r.section, r.department, r.vendor, r.category1, r.category2, r.category3, r.category4, r.category5, r.salesQty, r.storeStock, r.godownStock, r.totalStock, r.stockHolding, r.variance]);
    let csv = headers.join(",") + "\n";
    rows.forEach((row) => { csv += row.join(",") + "\n"; });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `StockGapReport_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 px-6 py-7 text-white shadow-[0_16px_35px_rgba(15,23,42,.14)] sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-indigo-200">Forecast & Analytics</p>
        <h3 className="mt-1 text-xl font-bold">Stock Gap Report</h3>
        <p className="mt-1 text-sm text-indigo-100/75">Projected demand (sales over a date range) vs. actual store + godown stock, from your uploaded stock/sales snapshots.</p>
      </section>

      <div className="fa-panel p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-900">Filters</h2>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={!data.length} className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition", data.length ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-emerald-200 text-emerald-600 cursor-not-allowed")}><FaFileExcel /> Excel</button>
            <button onClick={exportPDF} disabled={!data.length} className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition", data.length ? "bg-indigo-700 text-white hover:bg-indigo-800" : "bg-indigo-200 text-indigo-600 cursor-not-allowed")}><FaFilePdf /> PDF</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-indigo-200 bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">From Date *</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 outline-none" />
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-3">
            <label className="text-xs font-semibold text-slate-700">To Date *</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 outline-none" />
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-3">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1"><FaClock className="text-indigo-600" /> Holding Days</label>
            <select value={holdingDays} onChange={(e) => setHoldingDays(Number(e.target.value))} className="w-full mt-1 rounded-lg border border-indigo-200 px-3 py-2 text-sm">
              {[7, 15, 30, 45].map((d) => <option key={d} value={d}>{d} Days</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-3 text-xs">
            <div className="font-semibold text-slate-700">Summary</div>
            <div className="mt-1 text-slate-600">Records: <b>{data.length}</b></div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
          <MultiSelect label="Store / Godown" options={stores} selected={selectedStores} setSelected={setSelectedStores} icon={<FaWarehouse />} />
          <MultiSelect label="Division" options={divisions} selected={selectedDivisions} setSelected={setSelectedDivisions} icon={<FaLayerGroup />} />
          <MultiSelect label="Section" options={sections} selected={selectedSections} setSelected={setSelectedSections} icon={<FaLayerGroup />} />
          <MultiSelect label="Department" options={departments} selected={selectedDepartments} setSelected={setSelectedDepartments} icon={<FaLayerGroup />} />
          <MultiSelect label="Vendor" options={vendors} selected={selectedVendors} setSelected={setSelectedVendors} icon={<FaUsers />} />
          <MultiSelect label="Category" options={categories} selected={selectedCategories} setSelected={setSelectedCategories} icon={<FaLayerGroup />} />
        </div>

        <div className="flex justify-end mb-3">
          <button onClick={fetchStockGap} disabled={loading} className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-xl text-sm font-semibold">{loading ? "Loading..." : "Generate Report"}</button>
        </div>
      </div>

      <div className="fa-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-sm">
            <thead><tr>{["Store", "Division", "Section", "Department", "Vendor", "Cat1", "Cat2", "Cat3", "Cat4", "Cat5", "Sales Qty", "Store Stock", "Godown Stock", "Total Stock", "Stock Holding", "Variance"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-bold uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.store}</td>
                  <td className="px-3 py-2">{r.division}</td>
                  <td className="px-3 py-2">{r.section}</td>
                  <td className="px-3 py-2">{r.department}</td>
                  <td className="px-3 py-2">{r.vendor}</td>
                  <td className="px-3 py-2">{r.category1}</td>
                  <td className="px-3 py-2">{r.category2}</td>
                  <td className="px-3 py-2">{r.category3}</td>
                  <td className="px-3 py-2">{r.category4}</td>
                  <td className="px-3 py-2">{r.category5}</td>
                  <td className="px-3 py-2 text-right">{r.salesQty}</td>
                  <td className="px-3 py-2 text-right">{r.storeStock}</td>
                  <td className="px-3 py-2 text-right">{r.godownStock}</td>
                  <td className="px-3 py-2 text-right">{r.totalStock}</td>
                  <td className="px-3 py-2 text-right">{r.stockHolding}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold", r.variance < 0 ? "text-rose-600" : "text-emerald-700")}>{r.variance}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={16} className="px-4 py-8 text-center text-slate-400">No data found. Select filters and click "Generate Report".</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
