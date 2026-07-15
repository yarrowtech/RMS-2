import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = `${APP_API_URL}`;
const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL"];
const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces" },
  { value: "set", label: "Set" },
  { value: "kg", label: "Kg" },
  { value: "g", label: "Gram" },
  { value: "ltr", label: "Liter" },
];

const WEB_SAFE_COLORS = (() => {
  const hex = ["00", "33", "66", "99", "CC", "FF"];
  const colors = [];
  for (let r of hex) for (let g of hex) for (let b of hex) colors.push(`#${r}${g}${b}`);
  return colors;
})();

// ─── Number utilities ───
const preventInvalidKeys = (e) => {
  if (["e", "E", "-", "+"].includes(e.key)) e.preventDefault();
};

const sanitizeNum = (v, fallback = "") => {
  if (v === "" || v == null) return fallback;
  const c = String(v).replace(/[^\d.]/g, "");
  if (!c) return fallback;
  const parts = c.split(".");
  const n = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
  return Number.isNaN(Number(n)) ? fallback : n;
};

const sanitizeInt = (v, fallback = "") => {
  if (v === "" || v == null) return fallback;
  return String(v).replace(/[^\d]/g, "");
};

const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
};

const toInt = (v, fallback = 0) => {
  const c = String(v || "").replace(/[^\d]/g, "");
  const n = Number(c);
  return Number.isNaN(n) ? fallback : Math.max(0, n);
};

// ─── Business calculations ───
const calcProfit = (cp, sp) => toNum(sp) - toNum(cp);

const calcMarginPct = (cp, sp) => {
  const c = toNum(cp);
  const s = toNum(sp);
  return c > 0 && s > 0 ? ((s - c) / c) * 100 : null;
};

const calcDiscountPct = (mrp, sp) => {
  const m = toNum(mrp);
  const s = toNum(sp);
  return m > 0 && s > 0 && s < m ? ((m - s) / m) * 100 : null;
};

const calcTotalValue = (sp, qty) => toNum(sp) * toInt(qty);
const fmt = (n) => (Math.abs(n) < 0.005 ? "0.00" : Number(n).toFixed(2));

// ── Empty shapes ───
const emptyPricing = () => ({
  cost_price: "",
  mrp: "",
  selling_price: "",
  quantity: "",
  unit: "pcs",
});

const emptyProduct = () => ({
  product_name: "",
  division: "",
  section: "",
  department: "",
  hsn_code: "",
  gst_rate: "",          
  requires_expiry: false,
  expiry_date: "",        
  shelf_life_days: "",
  ...emptyPricing(),
  description: "",
  specification: "",
  has_variants: false,
  variant_type: "color",
  variants: [],
  images: [],
});

const GST_SLABS = [
  { value: "", label: "Select GST Rate" },
  { value: "0",  label: "0% — Exempt (food grains, salt, etc.)" },
  { value: "5",  label: "5% — (packaged food, tea, coffee)" },
  { value: "12", label: "12% — (butter, cheese, fruit juices)" },
  { value: "18", label: "18% — (most goods, electronics)" },
  { value: "28", label: "28% — (luxury, tobacco, aerated drinks)" },
];

const emptyColorVariant = (color) => ({ color, ...emptyPricing() });
const emptyColorForSize = (color) => ({ color, ...emptyPricing() });
const emptySizeVariant = (size) => ({ size, custom_size: "", colors: [] });

// UI helpers

function Sec({ label }) {
  return (
    <>
      <span className="mb-3 block text-[10px] font-bold uppercase tracking-[2.2px] text-indigo-700">
        {label}
      </span>
      <div className="mb-5 h-px rounded-full bg-gradient-to-r from-indigo-200 to-transparent" />
    </>
  );
}

function Label({ children, small = false }) {
  return (
    <label
      className={`mb-2 block font-semibold uppercase tracking-wide text-slate-500 ${
        small ? "text-[9px]" : "text-[11px]"
      }`}
    >
      {children}
    </label>
  );
}

function Input({ mono = false, className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 ${
        mono ? "font-mono" : ""
      } ${className}`}
    />
  );
}

function Select({ className = "", ...props }) {
  return (
    <select
      {...props}
      className={`w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 ${className}`}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 ${className}`}
    />
  );
}

function CalcPanel({ cp, mrp, sp, qty, small = false }) {
  const profit = calcProfit(cp, sp);
  const margin = calcMarginPct(cp, sp);
  const discount = calcDiscountPct(mrp, sp);
  const total = qty ? calcTotalValue(sp, qty) : null;

  if (toNum(cp) <= 0 || toNum(sp) <= 0) return null;
  const isLoss = profit < 0;

  return (
    <div
      className={`mt-2 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 font-mono ${
        isLoss
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      } ${small ? "text-[11px] px-3 py-2" : "text-xs"}`}
    >
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.9px] opacity-70">
          Profit
        </span>
        <span className="text-[13px] font-semibold">₹{fmt(profit)}</span>
      </div>

      {margin !== null && (
        <>
          <span className="opacity-40">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.9px] opacity-70">
              Margin
            </span>
            <span className="text-[13px] font-semibold">{fmt(margin)}%</span>
          </div>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold">
            {isLoss ? "⚠ Loss" : margin >= 20 ? "✓ Healthy" : "↑ Low"}
          </span>
        </>
      )}

      {discount !== null && (
        <>
          <span className="opacity-40">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.9px] opacity-70">
              Disc off MRP
            </span>
            <span className="text-[13px] font-semibold">{fmt(discount)}%</span>
          </div>
        </>
      )}

      {total !== null && total > 0 && (
        <>
          <span className="opacity-40">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.9px] opacity-70">
              Stock Value
            </span>
            <span className="text-[13px] font-semibold">₹{fmt(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function StatCards({ cp, sp, qty, compact = false }) {
  const profit = calcProfit(cp, sp);
  const total = calcTotalValue(sp, qty);
  const isLoss = profit < 0;
  if (toNum(cp) <= 0 || toNum(sp) <= 0) return null;

  const pad = compact ? "p-2" : "p-3";
  const title = compact ? "text-[9px]" : "text-[10px]";
  const val = compact ? "text-xs" : "text-sm";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div
        className={`rounded-xl border ${pad} ${
          isLoss
            ? "border-red-200 bg-red-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p
          className={`mb-1 ${title} font-bold uppercase tracking-[1px] ${
            isLoss ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {isLoss ? "Loss" : "Margin"}
        </p>
        <p
          className={`font-mono ${val} font-semibold ${
            isLoss ? "text-red-700" : "text-emerald-700"
          }`}
        >
          ₹{fmt(profit)}
        </p>
      </div>

      <div className={`rounded-xl border border-violet-200 bg-violet-50 ${pad}`}>
        <p className={`mb-1 ${title} font-bold uppercase tracking-[1px] text-violet-700`}>
          Total
        </p>
        <p className={`font-mono ${val} font-semibold text-violet-700`}>
          ₹{fmt(total)}
        </p>
      </div>
    </div>
  );
}

function ColorGrid({ selected = [], onToggle, compact = false }) {
  const isOn = (c) => selected.some((x) => x.color === c);

  return (
    <div
      className={`flex flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 ${
        compact ? "max-h-28 p-3" : "max-h-44 p-3"
      }`}
    >
      {WEB_SAFE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onToggle(c)}
          className={`shrink-0 rounded-md border-2 transition hover:scale-110 ${
            compact ? "h-4 w-4" : "h-5 w-5"
          } ${
            isOn(c)
              ? "border-slate-900 ring-2 ring-black/10"
              : "border-transparent"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function ColorVariantCard({ variant, onChange }) {
  return (
    <div className="mb-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className="h-5 w-5 rounded-md border-2 border-black/10"
          style={{ backgroundColor: variant.color }}
        />
        <span className="font-mono text-xs text-slate-500">{variant.color}</span>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Cost Price (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={variant.cost_price}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("cost_price", sanitizeNum(e.target.value, ""))}
          />
        </div>

        <div>
          <Label>MRP (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={variant.mrp}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => {
              const v = sanitizeNum(e.target.value, "");
              onChange("mrp", v);
              if (!variant.selling_price) onChange("selling_price", v);
            }}
          />
        </div>

        <div>
          <Label>Selling Price (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="Auto from MRP"
            value={variant.selling_price}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("selling_price", sanitizeNum(e.target.value, ""))}
          />
        </div>
      </div>

      <CalcPanel
        cp={variant.cost_price}
        mrp={variant.mrp}
        sp={variant.selling_price}
        qty={variant.quantity}
        small
      />

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Quantity</Label>
          <Input
            mono
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={variant.quantity}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("quantity", sanitizeInt(e.target.value, ""))}
          />
        </div>

        <div>
          <Label>Unit</Label>
          <Select
            value={variant.unit}
            onChange={(e) => onChange("unit", e.target.value)}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <StatCards cp={variant.cost_price} sp={variant.selling_price} qty={variant.quantity} />
    </div>
  );
}

function SizeColorMiniCard({ size, customSize, colorObj, onChange }) {
  const profit = calcProfit(colorObj.cost_price, colorObj.selling_price);
  const total = calcTotalValue(colorObj.selling_price, colorObj.quantity);
  const isLoss = profit < 0;
  const showStats = toNum(colorObj.cost_price) > 0 && toNum(colorObj.selling_price) > 0;

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
          {size}
        </span>

        {customSize && (
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
            {customSize}
          </span>
        )}

        <span
          className="inline-block h-[13px] w-[13px] shrink-0 rounded border border-black/10"
          style={{ backgroundColor: colorObj.color }}
        />
        <span className="font-mono text-[10px] text-slate-500">{colorObj.color}</span>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label small>Cost (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={colorObj.cost_price}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("cost_price", sanitizeNum(e.target.value, ""))}
            className="px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <Label small>MRP (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={colorObj.mrp}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => {
              const v = sanitizeNum(e.target.value, "");
              onChange("mrp", v);
              if (!colorObj.selling_price) onChange("selling_price", v);
            }}
            className="px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <Label small>Selling (₹)</Label>
          <Input
            mono
            type="number"
            min="0"
            step="0.01"
            placeholder="Auto"
            value={colorObj.selling_price}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("selling_price", sanitizeNum(e.target.value, ""))}
            className="px-3 py-2 text-[13px]"
          />
        </div>
      </div>

      <CalcPanel
        cp={colorObj.cost_price}
        mrp={colorObj.mrp}
        sp={colorObj.selling_price}
        qty={colorObj.quantity}
        small
      />

      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <Label small>Quantity</Label>
          <Input
            mono
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={colorObj.quantity}
            onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("quantity", sanitizeInt(e.target.value, ""))}
            className="px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <Label small>Unit</Label>
          <Select
            value={colorObj.unit}
            onChange={(e) => onChange("unit", e.target.value)}
            className="px-3 py-2 text-[13px]"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {showStats && (
        <StatCards
          cp={colorObj.cost_price}
          sp={colorObj.selling_price}
          qty={colorObj.quantity}
          compact
        />
      )}
    </div>
  );
}

function ExpandedSizeBlock({
  sizeVariant,
  onRemove,
  onCustomSize,
  onToggleColor,
  onColorField,
}) {
  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-indigo-200 bg-indigo-100 px-4 py-1 font-mono text-sm font-semibold text-indigo-700">
            {sizeVariant.size}
          </span>
          <span className="text-xs text-slate-500">
            {sizeVariant.colors.length} color{sizeVariant.colors.length !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
          onClick={onRemove}
        >
          ✕ Remove
        </button>
      </div>

      <div className="mb-4">
        <Label>Custom Size Value</Label>
        <Input
          type="text"
          placeholder="e.g. 30 / 32 / Free Size"
          value={sizeVariant.custom_size}
          onChange={(e) => onCustomSize(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <Label>Select Colors ({sizeVariant.colors.length} selected)</Label>
        <ColorGrid compact selected={sizeVariant.colors} onToggle={onToggleColor} />
      </div>

      {sizeVariant.colors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sizeVariant.colors.map((cObj) => (
            <SizeColorMiniCard
              key={cObj.color}
              size={sizeVariant.size}
              customSize={sizeVariant.custom_size}
              colorObj={cObj}
              onChange={(field, value) => onColorField(cObj.color, field, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────
export default function AddProduct() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([emptyProduct()]);
  const [mappingData, setMappingData] = useState({});
  const [divisions, setDivisions] = useState([]);
  const [sections, setSections] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/api/product-mapping/grouped`)
      .then((res) => {
        const data = res.data.data || {};
        setMappingData(data);
        setDivisions([
          ...new Set(Object.keys(data).flatMap((pt) => Object.keys(data[pt]))),
        ]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const div = products[0]?.division;
    if (!div) {
      setSections([]);
      setDepartments([]);
      return;
    }
    const s = new Set();
    Object.values(mappingData).forEach((pt) => {
      if (pt[div]) Object.keys(pt[div]).forEach((k) => s.add(k));
    });
    setSections([...s]);
    setDepartments([]);
  }, [products[0]?.division, mappingData]);

  useEffect(() => {
    const div = products[0]?.division;
    const sec = products[0]?.section;
    if (!div || !sec) {
      setDepartments([]);
      return;
    }
    const d = new Set();
    Object.values(mappingData).forEach((pt) => {
      if (pt[div]?.[sec]) pt[div][sec].forEach((v) => d.add(v));
    });
    setDepartments([...d]);
  }, [products[0]?.section, products[0]?.division, mappingData]);

  const handleChange = (i, f, v) => {
    const u = [...products];
    u[i][f] = v;
    if (f === "division") {
      u[i].section = "";
      u[i].department = "";
    }
    if (f === "section") {
      u[i].department = "";
    }
    if (f === "mrp" && !u[i].selling_price) u[i].selling_price = v;
    setProducts(u);
  };

  const handleImages = (i, files) => {
    const u = [...products];
    u[i].images = Array.from(files);
    setProducts(u);
  };

  const addProduct = () => setProducts((p) => [...p, emptyProduct()]);
  const removeProduct = (i) => setProducts((p) => p.filter((_, x) => x !== i));

  const toggleColor = (i, color) => {
    const u = [...products];
    const ei = u[i].variants.findIndex((v) => v.color === color);
    if (ei !== -1) u[i].variants.splice(ei, 1);
    else u[i].variants.push(emptyColorVariant(color));
    setProducts([...u]);
  };

  const updateColorField = (i, color, field, value) => {
    const u = [...products];
    u[i].variants = u[i].variants.map((v) =>
      v.color !== color ? v : { ...v, [field]: value }
    );
    setProducts(u);
  };

  const toggleSize = (i, size) => {
    const u = [...products];
    const ei = u[i].variants.findIndex((v) => v.size === size);
    if (ei !== -1) u[i].variants.splice(ei, 1);
    else u[i].variants.push(emptySizeVariant(size));
    setProducts([...u]);
  };

  const updateCustomSize = (i, size, value) => {
    const u = [...products];
    u[i].variants = u[i].variants.map((v) =>
      v.size !== size ? v : { ...v, custom_size: value }
    );
    setProducts(u);
  };

  const toggleColorForSize = (i, size, color) => {
    const u = [...products];
    const sv = u[i].variants.find((v) => v.size === size);
    if (!sv) return;
    const ci = sv.colors.findIndex((c) => c.color === color);
    if (ci !== -1) sv.colors.splice(ci, 1);
    else sv.colors.push(emptyColorForSize(color));
    setProducts([...u]);
  };

  const updateSizeColorField = (i, size, color, field, value) => {
    const u = [...products];
    u[i].variants = u[i].variants.map((v) => {
      if (v.size !== size) return v;
      return {
        ...v,
        colors: v.colors.map((c) =>
          c.color !== color ? c : { ...c, [field]: value }
        ),
      };
    });
    setProducts(u);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      for (const p of products) {
        const fd = new FormData();
        let variants = [];

        if (p.has_variants) {
          if (p.variant_type === "color") {
            variants = p.variants.map((v) => ({
              color: v.color,
              cost_price: toNum(v.cost_price),
              mrp: toNum(v.mrp),
              selling_price: toNum(v.selling_price) || toNum(v.mrp),
              stock: toInt(v.quantity, 0),
              unit: v.unit,
            }));
          } else {
            variants = p.variants.map((sv) => ({
              size_label: sv.size,
              size_value: sv.custom_size || "",
              colors: sv.colors.map((c) => ({
                color: c.color,
                cost_price: toNum(c.cost_price),
                mrp: toNum(c.mrp),
                selling_price: toNum(c.selling_price) || toNum(c.mrp),
                stock: toInt(c.quantity, 0),
                unit: c.unit,
              })),
            }));
          }
        }

        fd.append("product_name", p.product_name);
        fd.append("hsn_code", p.hsn_code || "");
        fd.append("gst_rate", p.gst_rate || "0");
        fd.append("requires_expiry",  String(p.requires_expiry));
        fd.append("expiry_date",      p.requires_expiry ? (p.expiry_date || "") : "");
        fd.append("shelf_life_days",  p.requires_expiry ? (p.shelf_life_days || "0") : "0");
        fd.append("division", p.division);
        fd.append("section", p.section);
        fd.append("department", p.department);
        fd.append("description", p.description);
        fd.append("specification", p.specification);
        fd.append("has_variants", String(p.has_variants));
        fd.append("variant_type", p.has_variants ? p.variant_type : "none");

        if (!p.has_variants) {
          fd.append("cost_price", toNum(p.cost_price));
          fd.append("mrp", toNum(p.mrp));
          fd.append("selling_price", toNum(p.selling_price) || toNum(p.mrp));
          fd.append("quantity", toInt(p.quantity, 0));
          fd.append("unit", p.unit);
        }

        fd.append("variants", JSON.stringify(variants));
        (p.images || []).forEach((f) => fd.append("images", f));

        const token = localStorage.getItem("token");

await axios.post(`${API_BASE}/api/products/add`, fd, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
      }

      alert("✅ Products added successfully");
      navigate("/products");
    } catch {
      alert("❌ Error adding products");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 pb-28 pt-6 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Add{" "}
            <span className="bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
              Products
            </span>
          </h1>

          <div className="w-fit rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-xs font-medium tracking-wider text-indigo-700">
            {products.length} ITEM{products.length !== 1 ? "S" : ""}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {products.map((form, idx) => (
            <div
              key={idx}
              className="relative mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-transparent" />

              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 font-mono text-xs text-indigo-700">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <span className="break-words text-sm font-semibold text-slate-900">
                    {form.product_name || "New Product"}
                  </span>
                </div>

                {products.length > 1 && (
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100"
                    onClick={() => removeProduct(idx)}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <Sec label="Identity" />

              <div className="mb-4">
                <Label>Product Name *</Label>
                <Input
                  type="text"
                  placeholder="e.g. Classic Polo Shirt"
                  value={form.product_name}
                  required
                  onChange={(e) => handleChange(idx, "product_name", e.target.value)}
                />
              </div>

{/*               
<div className="mb-4">
  <Label>HSN Code</Label>
  <Input
    type="text"
    placeholder="e.g. 6109 (optional)"
    value={form.hsn_code || ""}
    onChange={(e) => handleChange(idx, "hsn_code", e.target.value)}
    maxLength={8}
  />
  <p className="mt-1 text-[11px] text-slate-400">
    4–8 digit HSN code for GST classification. Leave blank if not applicable.
  </p>
</div> */}
            {/* HSN + GST row */}
<div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <Label>HSN Code</Label>
    <Input
      type="text"
      placeholder="e.g. 6109 (optional)"
      value={form.hsn_code || ""}
      onChange={(e) => handleChange(idx, "hsn_code", e.target.value)}
      maxLength={8}
    />
    <p className="mt-1 text-[11px] text-slate-400">
      4–8 digit code for GST classification
    </p>
  </div>

  <div>
    <Label>GST Rate</Label>
    <Select
      value={form.gst_rate}
      onChange={(e) => handleChange(idx, "gst_rate", e.target.value)}
    >
      {GST_SLABS.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </Select>
    {form.gst_rate && (
      <p className="mt-1 text-[11px] text-slate-400 font-mono">
        CGST {Number(form.gst_rate) / 2}% + SGST {Number(form.gst_rate) / 2}%
        &nbsp;·&nbsp; IGST {form.gst_rate}%
      </p>
    )}
  </div>
</div>

{/* Expiry flag + fields */}
<div className="mb-4">
  <label className="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      checked={form.requires_expiry}
      onChange={(e) => handleChange(idx, "requires_expiry", e.target.checked)}
      className="mt-0.5 h-4 w-4 accent-indigo-600"
    />
    <div>
      <span className="text-sm font-semibold text-slate-900">
        Requires Expiry Date
      </span>
      <p className="text-[11px] text-slate-400 mt-0.5">
        Enable for food, beverages, medicines, cosmetics.
      </p>
    </div>
  </label>

  {form.requires_expiry && (
    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 pl-7">
      <div>
        <Label>Initial Expiry Date *</Label>
        <Input
          type="date"
          value={form.expiry_date || ""}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => handleChange(idx, "expiry_date", e.target.value)}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Expiry date for the current stock being added
        </p>
      </div>

      <div>
        <Label>Default Shelf Life (days)</Label>
        <Input
          mono
          type="number"
          min="1"
          placeholder="e.g. 365"
          value={form.shelf_life_days || ""}
          onKeyDown={preventInvalidKeys}
          onChange={(e) =>
            handleChange(idx, "shelf_life_days", sanitizeInt(e.target.value, ""))
          }
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Used to auto-suggest expiry on future GRN entries
        </p>
      </div>
    </div>
  )}
</div>



              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <Label>Division *</Label>
                  <Select
                    value={form.division}
                    required
                    onChange={(e) => handleChange(idx, "division", e.target.value)}
                  >
                    <option value="">Select</option>
                    {divisions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Section</Label>
                  <Select
                    value={form.section}
                    onChange={(e) => handleChange(idx, "section", e.target.value)}
                  >
                    <option value="">Select</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Department</Label>
                  <Select
                    value={form.department}
                    onChange={(e) => handleChange(idx, "department", e.target.value)}
                  >
                    <option value="">Select</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="my-6 h-px bg-slate-100" />

              {!form.has_variants && (
                <>
                  <Sec label="Pricing" />

                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <Label>Cost Price (₹)</Label>
                      <Input
                        mono
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.cost_price}
                        onKeyDown={preventInvalidKeys}
                        onChange={(e) =>
                          handleChange(idx, "cost_price", sanitizeNum(e.target.value, ""))
                        }
                      />
                    </div>

                    <div>
                      <Label>MRP (₹)</Label>
                      <Input
                        mono
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.mrp}
                        onKeyDown={preventInvalidKeys}
                        onChange={(e) =>
                          handleChange(idx, "mrp", sanitizeNum(e.target.value, ""))
                        }
                      />
                    </div>

                    <div>
                      <Label>Selling Price (₹)</Label>
                      <Input
                        mono
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Auto from MRP"
                        value={form.selling_price}
                        onKeyDown={preventInvalidKeys}
                        onChange={(e) =>
                          handleChange(idx, "selling_price", sanitizeNum(e.target.value, ""))
                        }
                      />
                    </div>
                  </div>

                  <CalcPanel
                    cp={form.cost_price}
                    mrp={form.mrp}
                    sp={form.selling_price}
                    qty={form.quantity}
                  />

                  <div className="my-6 h-px bg-slate-100" />

                  <Sec label="Inventory" />

                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        mono
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={form.quantity}
                        onKeyDown={preventInvalidKeys}
                        onChange={(e) =>
                          handleChange(idx, "quantity", sanitizeInt(e.target.value, ""))
                        }
                      />
                    </div>

                    <div>
                      <Label>Unit</Label>
                      <Select
                        value={form.unit}
                        onChange={(e) => handleChange(idx, "unit", e.target.value)}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="my-6 h-px bg-slate-100" />
                </>
              )}

              <Sec label="Details" />

              <div className="mb-4">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  placeholder="Short product description…"
                  value={form.description}
                  onChange={(e) => handleChange(idx, "description", e.target.value)}
                />
              </div>

              <div className="mb-4">
                <Label>Specification</Label>
                <Textarea
                  rows={3}
                  placeholder="Material, dimensions, care instructions…"
                  value={form.specification}
                  onChange={(e) => handleChange(idx, "specification", e.target.value)}
                />
              </div>

              <div className="my-6 h-px bg-slate-100" />

              <Sec label="Variants" />

              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    checked={form.has_variants}
                    onChange={(e) => {
                      handleChange(idx, "has_variants", e.target.checked);
                      handleChange(idx, "variants", []);
                    }}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Enable Variants
                </label>

                {form.has_variants && (
                  <Select
                    className="w-full border-indigo-200 bg-indigo-50 font-medium text-indigo-700 focus:border-indigo-500 focus:ring-indigo-100 sm:w-auto"
                    value={form.variant_type}
                    onChange={(e) => {
                      handleChange(idx, "variant_type", e.target.value);
                      handleChange(idx, "variants", []);
                    }}
                  >
                    <option value="color">Color only</option>
                    <option value="size_color">Size + Color</option>
                  </Select>
                )}
              </div>

              {form.has_variants && form.variant_type === "color" && (
                <div className="mb-4">
                  <Label>
                    Select Colors{" "}
                    {form.variants.length > 0 && (
                      <span className="ml-2 font-mono font-normal text-indigo-700">
                        ({form.variants.length} selected)
                      </span>
                    )}
                  </Label>

                  <ColorGrid selected={form.variants} onToggle={(c) => toggleColor(idx, c)} />

                  {form.variants.length > 0 && (
                    <div className="mt-4">
                      {form.variants.map((v) => (
                        <ColorVariantCard
                          key={v.color}
                          variant={v}
                          onChange={(field, value) =>
                            updateColorField(idx, v.color, field, value)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.has_variants && form.variant_type === "size_color" && (
                <div className="mb-4">
                  <Label>Select Sizes</Label>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {SIZE_OPTIONS.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`rounded-lg border px-4 py-2 font-mono text-sm transition ${
                          form.variants.some((v) => v.size === sz)
                            ? "border-indigo-700 bg-indigo-100 font-bold text-indigo-700 ring-4 ring-indigo-100"
                            : "border-slate-200 bg-white text-slate-500 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                        onClick={() => toggleSize(idx, sz)}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>

                  {form.variants.map((sv) => (
                    <ExpandedSizeBlock
                      key={sv.size}
                      sizeVariant={sv}
                      onRemove={() => toggleSize(idx, sv.size)}
                      onCustomSize={(val) => updateCustomSize(idx, sv.size, val)}
                      onToggleColor={(c) => toggleColorForSize(idx, sv.size, c)}
                      onColorField={(c, field, val) =>
                        updateSizeColorField(idx, sv.size, c, field, val)
                      }
                    />
                  ))}
                </div>
              )}

              <div className="my-6 h-px bg-slate-100" />

              <Sec label="Images" />

              <div className="mb-4">
                <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 px-4 py-8 text-center transition hover:border-indigo-500 hover:bg-indigo-100">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => handleImages(idx, e.target.files)}
                  />
                  <div className="mb-2 text-3xl">📁</div>
                  <p className="text-sm text-slate-500">
                    <strong className="font-semibold text-indigo-700">
                      Click to browse
                    </strong>{" "}
                    or drag &amp; drop images here
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    PNG · JPG · WEBP — multiple files allowed
                  </p>
                </div>

                {form.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.images.map((f, i) => (
                      <span
                        key={i}
                        className="max-w-full break-all rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                      >
                        ✓ {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="sticky bottom-3 z-10 mt-7 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white/85 p-4 backdrop-blur sm:flex-row">
            <button
              type="button"
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 sm:w-auto"
              onClick={addProduct}
            >
              <span className="text-base">＋</span> Add Another Product
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-[1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {loading ? "Saving…" : "Save All Products"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}