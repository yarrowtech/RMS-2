import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaFilePdf, FaTrash, FaEdit } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const cn = (...a) => a.filter(Boolean).join(" ");
const num = (n) => {
  const x = Number(n ?? 0);
  return Number.isNaN(x) ? 0 : x;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, num(v)));
const todayISO = () => {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toTime = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

const stripLeadingZeros = (v) => {
  if (v === "") return "";
  if (v === "0") return "0";
  return v.replace(/^0+(?=\d)/, "");
};

const smartFocusSelectZero = (e) => {
  if (e.target.value === "0") requestAnimationFrame(() => e.target.select());
};

const stopReselectOnMouseDown = (e) => {
  const el = e.currentTarget;
  if (document.activeElement !== el) return;

  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const len = (el.value || "").length;

  if (start === 0 && end === len && len > 0) {
    e.preventDefault();
    requestAnimationFrame(() => el.setSelectionRange(len, len));
  }
};

const seedRows = () => [];
const VENDORS = [
  "Vendor A - ABC Traders",
  "Vendor B - National Supply",
  "Vendor C - Omni Distributors",
  "Vendor D - Local Wholesales",
];

const STORES = ["Main - New Market", "Store - Chowringhee", "Store - Hatibagan"];
const DIVISIONS = [
  "Accessories",
  "Branded Items",
  "CMO",
  "Fmcg Home & Personal Care",
  "Fmcg-Food",
  "Handcraft",
  "Home Decor",
  "House Hold Appliences",
  "Kids",
  "Ladies",
  "Leather Accoessories",
  "Mens",
  "Staples",
  "Winter Garments",
];

const SECTION_MAP = {
  Accessories: ["Gift & Novelties", "Jewellery & Ornaments", "Other"],
  "Branded Items": ["Mens(Bi)", "Other"],
  CMO: ["Mens(CMO)", "Saree(CMO)", "Ladies Ethnic Wear(CMO)", "Other"],

  "Fmcg Home & Personal Care": [
    "Fabric Care Detergent",
    "Personal Care Skin",
    "Hair Care",
    "Oral Care",
    "Other",
  ],

  "Fmcg-Food": [
    "Masala & Spices",
    "Staples Atta & Flour",
    "Sugar & Salt",
    "Tea & Coffee",
    "Biscuits & Snacks",
    "Other",
  ],

  Handcraft: ["Handicraft Decor", "Other"],
  "Home Decor": ["Decor Utility", "Other"],
  "House Hold Appliences": ["Small Appliances", "Kitchen Appliances", "Other"],
  Kids: ["Kids Boys", "Kids Girls", "Other"],
  Ladies: ["Ladies Ethnic", "Ladies Western", "Other"],
  "Leather Accoessories": ["Wallets", "Belts", "Bags", "Other"],
  Mens: ["Mens Casual", "Mens Formal", "Other"],
  Staples: ["Staples Oil", "Staples Pulses", "Other"],
  "Winter Garments": ["Winter Mens", "Winter Ladies", "Other"],
};

const DEPARTMENT_MAP = {
  "Gift & Novelties": ["Gifts", "Novelties", "Other"],
  "Jewellery & Ornaments": ["Imitation", "Fashion Jewellery", "Other"],

  "Fabric Care Detergent": ["Detergent Powder", "Detergent Liquid", "Loose", "Other"],
  "Personal Care Skin": ["Face Wash", "Cream", "Soap", "Other"],
  "Hair Care": ["Shampoo", "Conditioner", "Hair Oil", "Other"],
  "Oral Care": ["Toothpaste", "Toothbrush", "Mouthwash", "Other"],

  "Masala & Spices": ["Whole Spices", "Powder Spices", "Loose", "Other"],
  "Staples Atta & Flour": ["Atta", "Maida", "Besan", "Loose", "Other"],
  "Sugar & Salt": ["Sugar", "Salt", "Jaggery", "Loose", "Other"],
  "Tea & Coffee": ["Tea", "Coffee", "Other"],
  "Biscuits & Snacks": ["Biscuits", "Chips", "Namkeen", "Other"],

  "Handicraft Decor": ["Showpiece", "Wall Decor", "Other"],
  "Decor Utility": ["Vase", "Frames", "Other"],

  "Small Appliances": ["Mixer Grinder", "Kettle", "Iron", "Other"],
  "Kitchen Appliances": ["Induction", "Toaster", "Other"],

  "Kids Boys": ["T-Shirts", "Shorts", "Jeans", "Other"],
  "Kids Girls": ["Dress", "Top", "Leggings", "Other"],

  "Ladies Ethnic": ["Saree", "Kurti", "Other"],
  "Ladies Western": ["Top", "Jeans", "Dress", "Other"],

  Wallets: ["Mens Wallet", "Ladies Wallet", "Other"],
  Belts: ["Mens Belt", "Other"],
  Bags: ["Handbag", "Backpack", "Other"],

  "Mens Casual": ["T-Shirts", "Jeans", "Shirts", "Other"],
  "Mens Formal": ["Formal Shirts", "Trousers", "Other"],

  "Staples Oil": ["Mustard Oil", "Refined Oil", "Other"],
  "Staples Pulses": ["Dal", "Chana", "Rajma", "Other"],

  "Winter Mens": ["Jackets", "Sweaters", "Other"],
  "Winter Ladies": ["Jackets", "Sweaters", "Other"],

  Other: ["Other"],
};

const SIZE_MAP = {
  "Detergent Powder": ["200g", "500g", "1kg", "2kg", "5kg", "10kg"],
  "Detergent Liquid": ["250ml", "500ml", "1L", "2L", "5L"],
  Loose: ["Loose"],

  "Face Wash": ["50ml", "100ml", "150ml", "200ml"],
  Cream: ["25g", "50g", "100g", "200g"],
  Soap: ["75g", "100g", "125g", "150g"],

  Shampoo: ["100ml", "180ml", "340ml", "650ml"],
  Conditioner: ["100ml", "180ml", "340ml", "650ml"],
  "Hair Oil": ["50ml", "100ml", "200ml", "500ml"],

  Toothpaste: ["50g", "80g", "100g", "150g", "200g"],
  Toothbrush: ["Single", "Pack of 2", "Pack of 4"],
  Mouthwash: ["100ml", "250ml", "500ml"],

  Atta: ["1kg", "2kg", "5kg", "10kg"],
  Maida: ["500g", "1kg", "2kg", "5kg"],
  Besan: ["500g", "1kg", "2kg"],
  Sugar: ["500g", "1kg", "2kg", "5kg"],
  Salt: ["200g", "500g", "1kg"],
  Jaggery: ["500g", "1kg", "2kg"],
  "Whole Spices": ["50g", "100g", "200g", "500g"],
  "Powder Spices": ["50g", "100g", "200g", "500g"],

  Tea: ["100g", "250g", "500g", "1kg"],
  Coffee: ["50g", "100ml", "200g", "500g"],

  Biscuits: ["50g", "100g", "200g", "500g"],
  Chips: ["20g", "40g", "80g", "150g"],
  Namkeen: ["40g", "200g", "400g", "1kg"],

  "T-Shirts": ["S", "M", "L", "XL", "XXL"],
  Shirts: ["38", "40", "42", "44", "46"],
  "Formal Shirts": ["38", "40", "42", "44", "46"],
  Jeans: ["28", "30", "32", "34", "36", "38"],
  Trousers: ["30", "32", "34", "36", "38"],
  Kurti: ["S", "M", "L", "XL", "XXL"],
  Saree: ["Free Size"],
  Dress: ["S", "M", "L", "XL"],
  Top: ["S", "M", "L", "XL"],
  Shorts: ["26", "28", "30", "32"],
  Leggings: ["S", "M", "L", "XL"],

  "__SECTION__Fabric Care Detergent": [
    "200g",
    "500g",
    "1kg",
    "2kg",
    "5kg",
    "10kg",
    "250ml",
    "500ml",
    "1L",
    "2L",
    "5L",
    "Loose",
  ],
  "__SECTION__Masala & Spices": ["50g", "100g", "200g", "500g", "Loose"],
  "__SECTION__Staples Atta & Flour": ["500g", "1kg", "2kg", "5kg", "10kg", "Loose"],
  "__SECTION__Sugar & Salt": ["200g", "500g", "1kg", "2kg", "5kg", "Loose"],
};

const getSizeOptions = (section, department) => {
  const deptKey = String(department || "").trim();
  if (deptKey && SIZE_MAP[deptKey]) return SIZE_MAP[deptKey];

  const secKey = String(section || "").trim();
  if (secKey && SIZE_MAP[`__SECTION__${secKey}`]) return SIZE_MAP[`__SECTION__${secKey}`];

  return [];
};

function ModalShell({ open, onClose, title, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);

    const t = setTimeout(() => {
      panelRef.current?.querySelector("input,select,button,textarea")?.focus();
    }, 30);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-black-900/60 backdrop-blur-sm" />
      <div className="absolute inset-0">
        <div
          ref={panelRef}
          className="
            h-full w-full bg-white
            sm:bg-white/95 sm:backdrop-blur-2xl
            sm:mx-auto sm:my-6 sm:h-[calc(100%-3rem)] sm:max-w-5xl
            sm:rounded-2xl sm:border sm:border-[#186fda]
            sm:shadow-[0_24px_80px_rgba(15,23,42,0.35)]
            overflow-hidden
          "
        >
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#186fda] bg-blue-50/90 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-black-900 truncate">
                {title}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-blue-500 bg-white px-4 py-2 text-xs font-black text-black-700 hover:bg-black-50"
            >
              Close
            </button>
          </div>

          <div className="h-[calc(100%-56px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockPlanForecastingPurchasePlanCreation() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState(seedRows);
  const [error, setError] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");

  const dateValid = useMemo(() => {
    if (!fromDate || !toDate) return true;
    return new Date(fromDate).getTime() <= new Date(toDate).getTime();
  }, [fromDate, toDate]);

  const matchDate = (iso) => {
    const t = toTime(iso);
    if (t == null) return false;

    const a = toTime(fromDate);
    const b = toTime(toDate);
    if (a != null && b == null) return t >= a;
    if (a == null && b != null) return t <= b;
    if (a != null && b != null && dateValid) return t >= a && t <= b;

    return true;
  };

  const isSingleDay = useMemo(() => {
    return Boolean(fromDate && toDate && dateValid && fromDate === toDate);
  }, [fromDate, toDate, dateValid]);

  const filterSections = useMemo(() => {
    if (!filterDivision) return [];
    return SECTION_MAP[filterDivision] || ["Other"];
  }, [filterDivision]);

  useEffect(() => {
    setFilterSection("");
    setFilterDepartment("");
  }, [filterDivision]);

  const filterDepartments = useMemo(() => {
    if (!filterSection) return [];
    return DEPARTMENT_MAP[filterSection] || ["Other"];
  }, [filterSection]);

  useEffect(() => {
    setFilterDepartment("");
  }, [filterSection]);

  const [openAdd, setOpenAdd] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    date: "",
    store: "",
    division: "",
    section: "",
    department: "",
    vendor: "",
    brand: "",
    size: "",
    stock: "",
    purchase: "",
    trendPct: "",
    seasonalityPct: "",
  });

  const isEditMode = Boolean(editId);

  const formSections = useMemo(() => {
    if (!form.division) return [];
    return SECTION_MAP[form.division] || ["Other"];
  }, [form.division]);

  const formDepartments = useMemo(() => {
    if (!form.section) return [];
    return DEPARTMENT_MAP[form.section] || ["Other"];
  }, [form.section]);

  const sizeOptions = useMemo(() => getSizeOptions(form.section, form.department), [
    form.section,
    form.department,
  ]);

  const isSizeRequired = sizeOptions.length > 0;

  useEffect(() => {
    setForm((p) => ({ ...p, section: "", department: "", size: "" }));
  }, [form.division]);

  useEffect(() => {
    setForm((p) => ({ ...p, department: "", size: "" }));
  }, [form.section]);

  useEffect(() => {
    setForm((p) => ({ ...p, size: "" }));
  }, [form.department]);

  const resetForm = (prefill) => {
    if (prefill) {
      setForm({
        date: prefill.date || todayISO(),
        store: prefill.store || "",
        division: prefill.division || "",
        section: prefill.section || "",
        department: prefill.department || "",
        vendor: prefill.vendor || "",
        brand: String(prefill.brand || ""),
        size: String(prefill.size || ""),
        stock: String(Math.max(0, Math.round(num(prefill.stock)))),
        purchase: String(Math.max(0, Math.round(num(prefill.purchase)))),
        trendPct: String(num(prefill.trendPct)),
        seasonalityPct: String(num(prefill.seasonalityPct || 100)),
      });
      return;
    }

    setForm({
      date: todayISO(),
      store: "",
      division: "",
      section: "",
      department: "",
      vendor: "",
      brand: "",
      size: "",
      stock: "",
      purchase: "",
      trendPct: "",
      seasonalityPct: "",
    });
  };

  const openCreateModal = () => {
    setError("");
    setEditId(null);
    resetForm(null);

    const createDate = isSingleDay ? fromDate : todayISO();
    setForm((p) => ({ ...p, date: createDate }));

    setOpenAdd(true);
  };

  const openEditModal = (row) => {
    setError("");
    setEditId(row?.id || null);
    resetForm(row);
    setOpenAdd(true);
  };

  const closeModal = () => {
    setOpenAdd(false);
    setEditId(null);
    setError("");
  };

  const validateAndBuildRow = (idForEdit) => {
    if (!String(form.date || "").trim()) return { err: "Date is required." };
    if (!String(form.store || "").trim()) return { err: "Store is required." };
    if (!String(form.division || "").trim()) return { err: "Division is required." };
    if (!String(form.section || "").trim()) return { err: "Section is required." };
    if (!String(form.department || "").trim()) return { err: "Department is required." };
    if (!String(form.vendor || "").trim()) return { err: "Vendor is required." };

    const opts = getSizeOptions(form.section, form.department);
    if (opts.length > 0 && !String(form.size || "").trim()) {
      return { err: "Size is required for the selected Division/Section/Department." };
    }

    const stockN = Math.max(0, Math.round(num(form.stock || 0)));
    const purchaseN = Math.max(0, Math.round(num(form.purchase || 0)));
    const trendN = clamp(num(form.trendPct || 0), -1000, 1000);
    const seasonN = clamp(num(form.seasonalityPct || 100), 50, 200);

    return {
      row: {
        id: idForEdit || `p_${Date.now()}`,
        date: form.date,
        store: form.store,
        division: form.division,
        section: form.section,
        department: form.department,
        vendor: form.vendor,
        brand: String(form.brand || "").trim(),
        size: String(form.size || "").trim(),
        stock: stockN,
        purchase: purchaseN,
        trendPct: trendN,
        seasonalityPct: seasonN,
      },
    };
  };

  const saveFromModal = () => {
    const built = validateAndBuildRow(editId);
    if (built.err) return setError(built.err);

    if (isEditMode) {
      setRows((prev) => prev.map((r) => (r.id === editId ? built.row : r)));
      closeModal();
      return;
    }

    setRows((prev) => [...prev, built.row]);
    closeModal();
  };

  const deleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const filteredRows = useMemo(() => {
    let list = rows;

    if (fromDate || toDate) list = list.filter((r) => matchDate(r.date));
    if (filterStore) list = list.filter((r) => String(r.store || "") === String(filterStore));
    if (filterDivision) list = list.filter((r) => String(r.division || "") === String(filterDivision));
    if (filterSection) list = list.filter((r) => String(r.section || "") === String(filterSection));
    if (filterDepartment) list = list.filter((r) => String(r.department || "") === String(filterDepartment));

    return list;
  }, [rows, fromDate, toDate, dateValid, filterStore, filterDivision, filterSection, filterDepartment]);

  const totals = useMemo(() => {
    const totalStock = filteredRows.reduce((s, r) => s + Math.max(0, Math.round(num(r.stock))), 0);
    const totalPurchase = filteredRows.reduce((s, r) => s + Math.max(0, Math.round(num(r.purchase))), 0);
    return { totalStock, totalPurchase };
  }, [filteredRows]);

  const storeSummary = useMemo(() => {
    if (!isSingleDay) return [];
    const map = new Map();
    for (const r of filteredRows) {
      const key = String(r.store || "—");
      const prev = map.get(key) || { store: key, stock: 0, purchase: 0, rows: 0 };
      prev.stock += Math.max(0, Math.round(num(r.stock)));
      prev.purchase += Math.max(0, Math.round(num(r.purchase)));
      prev.rows += 1;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.purchase - a.purchase);
  }, [filteredRows, isSingleDay]);

  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");

    const title = "Purchase Plan Report";
    const sub = `Date Filter: ${fromDate || "—"} → ${toDate || "—"}`;
    const extra = `Store: ${filterStore || "All"} | Division: ${filterDivision || "All"} | Section: ${
      filterSection || "All"
    } | Department: ${filterDepartment || "All"}`;
    const createdAt = `Generated: ${new Date().toLocaleString()}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, 40, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(sub, 40, 56);
    doc.text(extra, 40, 70);
    doc.text(createdAt, 40, 84);

    const head = [
      [
        "SL",
        "Date",
        "Store",
        "Division",
        "Section",
        "Department",
        "Vendor",
        "Brand",
        "Size",
        "Stock",
        "Purchase",
        "Trend %",
        "Seasonality %",
      ],
    ];

    const body = filteredRows.map((r, i) => [
      i + 1,
      r.date || "—",
      r.store || "—",
      r.division || "—",
      r.section || "—",
      r.department || "—",
      r.vendor || "—",
      r.brand || "—",
      r.size || "—",
      Math.max(0, Math.round(num(r.stock))),
      Math.max(0, Math.round(num(r.purchase))),
      `${clamp(r.trendPct, -1000, 1000).toFixed(1)}%`,
      `${clamp(r.seasonalityPct, 50, 200)}%`,
    ]);

    autoTable(doc, {
      startY: 100,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [24, 111, 218], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        const pageCount = doc.internal.getNumberOfPages();
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.text(`Page ${pageCount}`, w - 90, h - 18);
      },
    });

    const finalY = (doc.lastAutoTable?.finalY || 100) + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total Stock: ${totals.totalStock}    Total Purchase: ${totals.totalPurchase}`, 40, finalY);

    const safeFrom = fromDate || "ALLFROM";
    const safeTo = toDate || "ALLTO";
    doc.save(`Purchase_Plan_${safeFrom}_${safeTo}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-2xl border border-[#186fda] bg-white/85 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg sm:text-xl font-bold text-black-900">Purchase Plan Creation</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-[#186fda] bg-white p-3">
              <label className="text-xs font-semibold text-black-700">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="rounded-xl border border-[#186fda] bg-white p-3">
              <label className="text-xs font-semibold text-black-700">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div className="rounded-xl border border-[#186fda] bg-white p-3">
              <label className="text-xs font-semibold text-black-700">Store</label>
              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">All Stores</option>
                {STORES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[#186fda] bg-white p-3">
              <label className="text-xs font-semibold text-black-700">Division</label>
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#186fda] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">All Divisions</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-semibold text-black-700">Section</label>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                disabled={!filterDivision}
                className={cn(
                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none",
                  filterDivision
                    ? "border-[#186fda] bg-white focus:ring-2 focus:ring-sky-300"
                    : "border-[#186fda] bg-black-100 text-black-500 cursor-not-allowed"
                )}
              >
                <option value="">{filterDivision ? "All Sections" : "Select Division first"}</option>
                {filterSections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[#186fda] bg-white p-3">
              <label className="text-xs font-semibold text-black-700">Department</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                disabled={!filterSection}
                className={cn(
                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none",
                  filterSection
                    ? "border-[#186fda] bg-white focus:ring-2 focus:ring-sky-300"
                    : "border-[#186fda] bg-black-100 text-black-500 cursor-not-allowed"
                )}
              >
                <option value="">{filterSection ? "All Departments" : "Select Section first"}</option>
                {filterDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!dateValid && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              From Date cannot be after To Date.
            </div>
          )}
        </div>
      </div>

      {/* ===== Store Summary ===== */}
      {isSingleDay && (
        <div className="mt-4 rounded-2xl border border-[#186fda] bg-white/80 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#186fda] bg-white/70">
            <div className="text-sm font-bold text-black-900">Store-wise Summary (Date: {fromDate})</div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-left text-[11px] font-bold text-black-800">
                  <th className="px-3 py-3">Store</th>
                  <th className="px-3 py-3 text-right">Rows</th>
                  <th className="px-3 py-3 text-right">Total Stock</th>
                  <th className="px-3 py-3 text-right">Total Purchase</th>
                </tr>
              </thead>
              <tbody>
                {storeSummary.map((s) => (
                  <tr key={s.store} className="border-b border-[#D6DEE8] bg-white/60">
                    <td className="px-3 py-2 font-semibold text-black-800">{s.store}</td>
                    <td className="px-3 py-2 text-right">{s.rows}</td>
                    <td className="px-3 py-2 text-right">{s.stock}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-blue-700">{s.purchase}</td>
                  </tr>
                ))}
                {storeSummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-black-600">
                      No data for this date & filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Main Table ===== */}
      <div className="mt-4 rounded-2xl border border-[#186fda] bg-white/80 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#186fda] bg-white/70">
          <div className="text-sm font-bold text-black-900">Purchase Plan Table</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportToPDF}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-purple-500 text-white hover:opacity-90"
            >
              <FaFilePdf /> Export PDF
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-blue-900 text-white hover:opacity-90"
            >
              <FaPlus /> Create Purchase Plan
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="max-h-[62vh] overflow-y-auto overscroll-contain">
            <table className="min-w-[2200px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 backdrop-blur">
                <tr className="text-left text-[11px] font-bold text-black-800">
                  <th className="px-3 py-3 w-[70px] text-center">SL</th>
                  <th className="px-3 py-3 w-[140px]">Date</th>
                  <th className="px-3 py-3 w-[220px]">Store</th>
                  <th className="px-3 py-3 w-[200px]">Division</th>
                  <th className="px-3 py-3 w-[240px]">Section</th>
                  <th className="px-3 py-3 w-[220px]">Department</th>
                  <th className="px-3 py-3 w-[260px]">Vendor</th>
                  <th className="px-3 py-3 w-[200px]">Brand</th>
                  <th className="px-3 py-3 w-[140px]">Size</th>
                  <th className="px-3 py-3 w-[120px]">Stock</th>
                  <th className="px-3 py-3 w-[120px]">Purchase</th>
                  <th className="px-3 py-3 w-[160px]">Trend %</th>
                  <th className="px-3 py-3 w-[140px]">Seasonality %</th>
                  <th className="px-3 py-3 w-[180px] text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={cn("border-b border-[#D6DEE8]", idx % 2 === 0 ? "bg-white/60" : "bg-white/40")}
                  >
                    <td className="px-3 py-2 text-center font-semibold text-black-700">{idx + 1}</td>
                    <td className="px-3 py-2">{r.date || "—"}</td>
                    <td className="px-3 py-2">{r.store || "—"}</td>
                    <td className="px-3 py-2">{r.division || "—"}</td>
                    <td className="px-3 py-2">{r.section || "—"}</td>
                    <td className="px-3 py-2">{r.department || "—"}</td>
                    <td className="px-3 py-2">{r.vendor || "—"}</td>
                    <td className="px-3 py-2">{r.brand || "—"}</td>
                    <td className="px-3 py-2">{r.size || "—"}</td>
                    <td className="px-3 py-2 text-right">{Math.max(0, Math.round(num(r.stock)))}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-blue-700">
                      {Math.max(0, Math.round(num(r.purchase)))}
                    </td>
                    <td className="px-3 py-2">{clamp(r.trendPct, -1000, 1000).toFixed(1)}%</td>
                    <td className="px-3 py-2">{clamp(r.seasonalityPct, 50, 200)}%</td>

                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50"
                        >
                          <FaEdit /> Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteRow(r.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-sm text-black-600">
                      No plans found for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-[#186fda] bg-white/70 px-4 py-3 text-sm flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="font-semibold text-black-800">
            Total Stock: <span className="font-extrabold">{totals.totalStock}</span>
          </div>
          <div className="font-semibold text-black-800">
            Total Purchase: <span className="font-extrabold text-blue-700">{totals.totalPurchase}</span>
          </div>
        </div>
      </div>

      {/* ===== Modal ===== */}
      <ModalShell
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          setEditId(null);
          setError("");
        }}
        title={isEditMode ? "Edit Purchase Plan" : "Create Purchase Plan"}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ✅ FIXED DATE FIELD: auto set + disabled + correct type */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Date *</label>
            <input
              type="date"
              value={form.date}
              disabled
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed outline-none"
            />
          </div>

          {/* ...keep your remaining fields exactly same... */}
          {/* Store */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Store *</label>
            <select
              value={form.store}
              onChange={(e) => setForm((p) => ({ ...p, store: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="">Select Store</option>
              {STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Division */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Division *</label>
            <select
              value={form.division}
              onChange={(e) => setForm((p) => ({ ...p, division: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="">Select Division</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Section *</label>
            <select
              value={form.section}
              onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
              disabled={!form.division}
              className={cn(
                "mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                form.division
                  ? "border-blue-500 bg-white focus:ring-2 focus:ring-sky-300"
                  : "border-blue-500 bg-black-100 text-black-500 cursor-not-allowed"
              )}
            >
              <option value="">{form.division ? "Select Section" : "Select Division first"}</option>
              {formSections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Department *</label>
            <select
              value={form.department}
              onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
              disabled={!form.section}
              className={cn(
                "mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                form.section
                  ? "border-blue-500 bg-white focus:ring-2 focus:ring-sky-300"
                  : "border-blue-500 bg-black-100 text-black-500 cursor-not-allowed"
              )}
            >
              <option value="">{form.section ? "Select Department" : "Select Section first"}</option>
              {formDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Vendor *</label>
            <select
              value={form.vendor}
              onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="">Select Vendor</option>
              {VENDORS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* Size */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Size {isSizeRequired ? "*" : ""}</label>

            {sizeOptions.length > 0 ? (
              <select
                value={form.size}
                onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              >
                <option value="">Select Size</option>
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.size}
                onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
                placeholder="e.g., 1kg / 500ml / S / 32"
                className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              />
            )}

            <div className="mt-2 text-[11px] font-semibold text-black-500">
              {sizeOptions.length > 0 ? "Auto size list available for this selection." : "No size list mapped — you can type manually."}
            </div>
          </div>

          {/* Stock */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Stock</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.stock}
              onMouseDown={stopReselectOnMouseDown}
              onFocus={smartFocusSelectZero}
              onChange={(e) => {
                let v = e.target.value;
                if (!/^\d*$/.test(v)) return;
                v = stripLeadingZeros(v);
                setForm((p) => ({ ...p, stock: v }));
              }}
              onBlur={() => setForm((p) => ({ ...p, stock: p.stock === "" ? "0" : p.stock }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* Purchase */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Purchase</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.purchase}
              onMouseDown={stopReselectOnMouseDown}
              onFocus={smartFocusSelectZero}
              onChange={(e) => {
                let v = e.target.value;
                if (!/^\d*$/.test(v)) return;
                v = stripLeadingZeros(v);
                setForm((p) => ({ ...p, purchase: v }));
              }}
              onBlur={() => setForm((p) => ({ ...p, purchase: p.purchase === "" ? "0" : p.purchase }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* Trend */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Trend %</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.trendPct}
              onMouseDown={stopReselectOnMouseDown}
              onFocus={smartFocusSelectZero}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^-?\d*\.?\d*$/.test(v)) return;
                setForm((p) => ({ ...p, trendPct: v }));
              }}
              onBlur={() => setForm((p) => ({ ...p, trendPct: p.trendPct === "" ? "0" : p.trendPct }))}
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {/* Seasonality */}
          <div className="rounded-2xl border border-blue-500 bg-white p-4">
            <label className="text-xs font-black text-black-700">Seasonality %</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.seasonalityPct}
              onMouseDown={stopReselectOnMouseDown}
              onFocus={smartFocusSelectZero}
              onChange={(e) => {
                let v = e.target.value;
                if (!/^\d*$/.test(v)) return;
                v = stripLeadingZeros(v);
                setForm((p) => ({ ...p, seasonalityPct: v }));
              }}
              onBlur={() =>
                setForm((p) => ({
                  ...p,
                  seasonalityPct: p.seasonalityPct === "" ? "100" : p.seasonalityPct,
                }))
              }
              className="mt-2 w-full rounded-xl border border-blue-500 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {error && (
            <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 pt-2 sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="w-full sm:w-auto rounded-xl border border-blue-500 bg-white px-4 py-2 text-sm font-black text-black-700 hover:bg-black-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveFromModal}
              className="w-full sm:w-auto rounded-xl bg-blue-900 px-4 py-2 text-sm font-black text-white hover:opacity-95"
            >
              {isEditMode ? "Update Purchase Plan" : "Save Purchase Plan"}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}


