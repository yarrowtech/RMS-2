import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config/api.js";

// The unit field used to be a hardcoded 5-item dropdown (pcs, set, kg, g,
// ltr) with no way to add anything else — no "box"/"roll"/"dozen" for a
// hardware or bakery business, and no clean way to enter "ltr" even though
// it WAS on the list, since the list itself couldn't grow. This fetches the
// tenant's known units (built-ins + anything they've typed before, saved
// server-side by products.py's /api/products/units) and lets them type a
// brand-new one inline — it's remembered for next time automatically.
const authHeaders = () => {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const FALLBACK_UNITS = ["pcs", "set", "kg", "g", "ltr", "l", "ml", "m", "box", "pair"];
const ADD_NEW = "__add_new_unit__";

export default function UnitSelect({ value, onChange, className = "" }) {
  const [units, setUnits] = useState(FALLBACK_UNITS);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products/units`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((res) => { if (Array.isArray(res.units) && res.units.length) setUnits(res.units); })
      .catch(() => {});
  }, []);

  const commitDraft = () => {
    const unit = draft.trim();
    if (unit) {
      if (!units.includes(unit)) setUnits((u) => [...u, unit]);
      onChange(unit);
    }
    setAdding(false);
    setDraft("");
  };

  if (adding) {
    return (
      <input
        autoFocus
        className={className}
        value={draft}
        placeholder="e.g. litre, box, dozen"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(); } if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
      />
    );
  }

  return (
    <select
      className={className}
      value={units.includes(value) ? value : ""}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) { setAdding(true); return; }
        onChange(e.target.value);
      }}
    >
      {!units.includes(value) && value && <option value={value}>{value}</option>}
      {units.map((u) => <option key={u} value={u}>{u}</option>)}
      <option value={ADD_NEW}>+ Add new unit…</option>
    </select>
  );
}
