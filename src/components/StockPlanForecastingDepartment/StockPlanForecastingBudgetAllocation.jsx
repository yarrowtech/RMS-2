import React, { useEffect, useMemo, useState } from "react";
import { FaCoins, FaFilePdf, FaEdit, FaTrash } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const num = (v) => {
  const x = Number(v || 0);
  return Number.isNaN(x) ? 0 : x;
};
const clamp0 = (v) => Math.max(0, v);
const money = (v) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(clamp0(num(v)));
const statusOf = (budget, planned) =>
  clamp0(num(planned)) > clamp0(num(budget)) ? "OVER" : "OK";

const DIVISION_SECTIONS = {
  Accessories: ["Gift & Novelties", "Jewellery & Ornaments"],
  Mens: ["Menswear", "Footwear"],
  Ladies: ["Ethnic", "Western"],
  Kids: ["Boys", "Girls"],
};

const SECTION_DEPARTMENTS = {
  "Gift & Novelties": ["Toys", "Stationery", "Gift Items"],
  "Jewellery & Ornaments": ["Imitation", "Silver", "Ornaments"],
  Menswear: ["Shirts", "Trousers", "Denim"],
  Footwear: ["Sports", "Casual", "Formal"],
  Ethnic: ["Saree", "Salwar", "Kurti"],
  Western: ["Tops", "Dresses", "Jeans"],
  Boys: ["T-Shirts", "Jeans", "Shorts"],
  Girls: ["Frocks", "Tops", "Leggings"],
};

const VENDORS = ["Vendor A", "Vendor B", "Vendor C"];

function FieldRow({ label, required, error, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 py-1">
      <div className="text-[11px] font-semibold text-black-700 leading-7">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </div>
      <div>
        {children}
        {error ? <div className="mt-0.5 text-[10px] text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}

function ComboInput({ value, onChange, placeholder, listId, options = [] }) {
  return (
    <div>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 rounded-md border border-slate-500 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-slate-300"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

function NumInput({ value, onChange }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => {
        const v = clamp0(Number(e.target.value || 0));
        onChange(String(v));
      }}
      className="w-full h-8 rounded-md border border-slate-500 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-slate-300"
    />
  );
}

function AddBudgetPopup({ open, onClose, onSave, initialRow }) {
  const [f, setF] = useState({
    division: "",
    section: "",
    department: "",
    vendor: "",
    budget: "0",
    planned: "0",
  });
  const [err, setErr] = useState({});

  useEffect(() => {
    if (!open) return;
    setErr({});
    if (initialRow) {
      setF({
        division: initialRow.division || "",
        section: initialRow.section || "",
        department: initialRow.department || "",
        vendor: initialRow.vendor || "",
        budget: String(clamp0(num(initialRow.budget))),
        planned: String(clamp0(num(initialRow.planned))),
      });
    } else {
      setF({
        division: "",
        section: "",
        department: "",
        vendor: "",
        budget: "0",
        planned: "0",
      });
    }
  }, [open, initialRow]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const divisionOptions = useMemo(() => Object.keys(DIVISION_SECTIONS), []);
  const sectionOptions = useMemo(() => {
    const direct = DIVISION_SECTIONS[f.division];
    if (direct?.length) return direct;
    return Array.from(new Set(Object.values(DIVISION_SECTIONS).flat()));
  }, [f.division]);

  const departmentOptions = useMemo(() => {
    const direct = SECTION_DEPARTMENTS[f.section];
    if (direct?.length) return direct;
    return Array.from(new Set(Object.values(SECTION_DEPARTMENTS).flat()));
  }, [f.section]);

  const validate = () => {
    const e = {};
    const req = (k) => {
      if (!String(f[k] || "").trim()) e[k] = "Required";
    };
    req("division");
    req("section");
    req("department");
    req("vendor");
    req("budget");
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate()) return;

    const budget = clamp0(Math.round(num(f.budget)));
    const planned = clamp0(Math.round(num(f.planned)));

    onSave?.({
      division: f.division.trim(),
      section: f.section.trim(),
      department: f.department.trim(),
      vendor: f.vendor.trim(),
      budget,
      planned,
    });

    onClose?.();
  };

  if (!open) return null;

  const b = clamp0(Math.round(num(f.budget)));
  const p = clamp0(Math.round(num(f.planned)));
  const bal = clamp0(b - p);
  const st = statusOf(b, p);

  return (
    <div className="fixed inset-0 z-[99999] bg-black/40">
      <div className="absolute inset-0 bg-white overflow-auto">
        <div className="h-12 border-b border-blue-500 bg-blue-100 flex items-center justify-between px-3">
          <div className="flex items-center gap-2 font-extrabold text-black-700 text-sm">
            <FaCoins className="text-amber-600" />
            {initialRow ? "Edit Budget" : "Add Budget"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              className="h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-md border border-blue-500 bg-white text-black-700 hover:bg-slate-100 font-black text-xs"
              title="Close"
            >
              ✖
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="max-w-[840px] mx-auto border border-blue-500 rounded-lg bg-blue overflow-hidden">
            <div className="px-3 py-1.5 border-b border-blue-500 text-[11px] font-extrabold text-black-700">
              Entry Details
            </div>

            <div className="p-3">
              <FieldRow label="Division" required error={err.division}>
                <ComboInput
                  value={f.division}
                  onChange={(v) =>
                    setF((pp) => ({ ...pp, division: v, section: "", department: "" }))
                  }
                  placeholder="Division"
                  listId="dl_division"
                  options={divisionOptions}
                />
              </FieldRow>

              <FieldRow label="Section" required error={err.section}>
                <ComboInput
                  value={f.section}
                  onChange={(v) => setF((pp) => ({ ...pp, section: v, department: "" }))}
                  placeholder="Section"
                  listId="dl_section"
                  options={sectionOptions}
                />
              </FieldRow>

              <FieldRow label="Department" required error={err.department}>
                <ComboInput
                  value={f.department}
                  onChange={(v) => setF((pp) => ({ ...pp, department: v }))}
                  placeholder="Department"
                  listId="dl_department"
                  options={departmentOptions}
                />
              </FieldRow>

              <FieldRow label="Vendor" required error={err.vendor}>
                <ComboInput
                  value={f.vendor}
                  onChange={(v) => setF((pp) => ({ ...pp, vendor: v }))}
                  placeholder="Vendor"
                  listId="dl_vendor"
                  options={VENDORS}
                />
              </FieldRow>

              <FieldRow label="Budget (₹)" required error={err.budget}>
                <NumInput value={f.budget} onChange={(v) => setF((pp) => ({ ...pp, budget: v }))} />
              </FieldRow>

              <FieldRow label="Planned (₹)">
                <NumInput
                  value={f.planned}
                  onChange={(v) => setF((pp) => ({ ...pp, planned: v }))}
                />
              </FieldRow>

              <div className="mt-2 grid grid-cols-[140px_1fr] items-center gap-2">
                <div className="text-[11px] font-semibold text-black-700">Balance</div>
                <div className="text-xs font-bold text-black-900 flex items-center gap-2">
                  ₹ {money(bal)}
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-extrabold ${
                      st === "OVER"
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    {st}
                  </span>
                </div>
              </div>

              {st === "OVER" ? (
                <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  Planned is greater than Budget. Balance shown as 0.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Component ---------------- */
export default function StockPlanForecastingBudgetAllocation() {
  const [rows, setRows] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const editRow = useMemo(() => rows.find((r) => r.id === editId) || null, [rows, editId]);

  const totals = useMemo(() => {
    const totalBudget = rows.reduce((s, r) => s + clamp0(num(r.budget)), 0);
    const totalPlanned = rows.reduce((s, r) => s + clamp0(num(r.planned)), 0);
    const totalBalance = clamp0(totalBudget - totalPlanned);
    const overCount = rows.filter(
      (r) => clamp0(num(r.planned)) > clamp0(num(r.budget))
    ).length;

    return { totalBudget, totalPlanned, totalBalance, overCount };
  }, [rows]);

  const openCreate = () => {
    setEditId(null);
    setPopupOpen(true);
  };

  const openEdit = (id) => {
    setEditId(id);
    setPopupOpen(true);
  };

  const saveRow = (payload) => {
    if (editId) {
      setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, ...payload } : r)));
    } else {
      const id = `b_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setRows((prev) => [...prev, { id, ...payload }]);
    }
    setEditId(null);
  };

  const deleteRow = (id) => {
    if (!window.confirm("Delete this row?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editId === id) setEditId(null);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(14);
    doc.text("Budget Allocation", 14, 14);

    doc.setFontSize(10);
    doc.text(
      `Total Budget: ₹ ${money(totals.totalBudget)}   Planned: ₹ ${money(
        totals.totalPlanned
      )}   Balance: ₹ ${money(totals.totalBalance)}   OVER: ${totals.overCount}`,
      14,
      22
    );

    autoTable(doc, {
      startY: 28,
      head: [
        [
          "Sl No",
          "Division",
          "Section",
          "Department",
          "Vendor",
          "Budget",
          "Planned",
          "Balance",
          "Status",
        ],
      ],
      body: rows.map((r, i) => {
        const b = clamp0(Math.round(num(r.budget)));
        const p = clamp0(Math.round(num(r.planned)));
        const bal = clamp0(b - p);
        const st = statusOf(b, p);
        return [
          String(i + 1),
          r.division || "",
          r.section || "",
          r.department || "",
          r.vendor || "",
          `₹ ${money(b)}`,
          `₹ ${money(p)}`,
          `₹ ${money(bal)}`,
          st,
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 245, 245], textColor: [30, 41, 59] },
    });

    doc.save("Budget_Allocation.pdf");
  };

  const colClass = "px-4 py-3 whitespace-nowrap";
  const minTableWidth = "min-w-[1250px]"; 

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-700">
        <span className="font-extrabold text-slate-900">Budget Allocation</span>
        <span>
          Total Budget: <b>₹ {money(totals.totalBudget)}</b>
        </span>
        <span>
          Planned: <b>₹ {money(totals.totalPlanned)}</b>
        </span>
        <span>
          Balance:{" "}
          <b className={totals.overCount ? "text-red-600" : "text-emerald-600"}>
            ₹ {money(totals.totalBalance)}
          </b>
        </span>
        {totals.overCount ? (
          <span className="text-red-600 font-extrabold">OVER: {totals.overCount}</span>
        ) : null}
      </div>

      <div className="rounded-xl border border-blue-600/60 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2 text-sm text-black-700 font-bold border-b border-blue-600 flex items-center justify-between">
          <span>Table</span>

          <div className="flex items-center gap-2">
           <button
            type="button"
            onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openCreate();
         }}
            className="h-10 px-5 rounded-md bg-orange-600 text-white text-sm font-bold
            shadow-sm hover:bg-orange-700 active:scale-[0.99] transition"
             >
           + Add Budget
          </button>

        <button
          type="button"
          onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          exportPDF();
       }}
           className="h-10 px-5 rounded-md bg-blue-600 text-white text-sm font-bold
            shadow-sm hover:bg-blue-700 active:scale-[0.99] transition inline-flex items-center gap-2"
         >
          <FaFilePdf className="text-white" />
          Export to PDF
         </button>

          </div>
        </div>

  
        <div className="h-[190px] overflow-auto">
          <table className={`${minTableWidth} w-full text-sm`}>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-blue-500">
              <tr className="text-[12px] font-extrabold text-black-700">
                <th className={`${colClass} text-left`}>SL NO</th>
                <th className={`${colClass} text-left`}>Division</th>
                <th className={`${colClass} text-left`}>Section</th>
                <th className={`${colClass} text-left`}>Department</th>
                <th className={`${colClass} text-left`}>Vendor</th>
                <th className={`${colClass} text-right`}>Budget</th>
                <th className={`${colClass} text-right`}>Planned</th>
                <th className={`${colClass} text-right`}>Balance</th>
                <th className={`${colClass} text-center`}>Status</th>
                <th className={`${colClass} text-center`}>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="h-[120px] text-center text-slate-500">
                    No budget added yet. Click <b>Add Budget</b>.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const b = clamp0(Math.round(num(r.budget)));
                  const p = clamp0(Math.round(num(r.planned)));
                  const bal = clamp0(b - p);
                  const st = statusOf(b, p);
                  const over = st === "OVER";

                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className={`${colClass} text-left font-semibold text-slate-900`}>
                        {i + 1}
                      </td>
                      <td className={`${colClass} text-left`}>{r.division || "—"}</td>
                      <td className={`${colClass} text-left`}>{r.section || "—"}</td>
                      <td className={`${colClass} text-left`}>{r.department || "—"}</td>
                      <td className={`${colClass} text-left`}>{r.vendor || "—"}</td>
                      <td className={`${colClass} text-right font-semibold`}>
                        ₹ {money(b)}
                      </td>
                      <td className={`${colClass} text-right`}>₹ {money(p)}</td>
                      <td
                        className={`${colClass} text-right font-bold ${
                          over ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        ₹ {money(bal)}
                      </td>
                      <td className={`${colClass} text-center`}>
                        <span
                          className={
                            "text-[11px] font-extrabold px-2 py-1 rounded-full border " +
                            (over
                              ? "text-red-700 bg-red-50 border-red-200"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200")
                          }
                        >
                          {st}
                        </span>
                      </td>
                      <td className={`${colClass} text-center`}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(r.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-extrabold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(r.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popup */}
      <AddBudgetPopup
        open={popupOpen}
        onClose={() => {
          setPopupOpen(false);
          setEditId(null);
        }}
        onSave={saveRow}
        initialRow={editRow}
      />
    </div>
  );
}
