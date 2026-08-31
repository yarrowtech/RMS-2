import React, { useState } from "react";
import { FaFileImport, FaTimes, FaDownload, FaCheckCircle, FaExclamationTriangle, FaFileUpload } from "react-icons/fa";
import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

const API = APP_API_URL;

function getAdminToken() {
  return (
    localStorage.getItem("admin_token")  ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")        ||
    ""
  );
}

// Bulk migration of an existing catalogue/stock count into RMS — for a
// retailer who already has inventory in a spreadsheet or another system.
// Two-step, same as the backend: upload → review (nothing written yet) →
// confirm (only the valid, reviewed rows are written).
export default function InventoryBulkImport({ onClose, onImported }) {
  const [step, setStep] = useState("upload"); // upload | review | done
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { rows, valid_rows, error_rows, needs_store_selection }
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");
  const [result, setResult] = useState(null);

  const headers = { Authorization: `Bearer ${getAdminToken()}` };

  const loadStores = async () => {
    try {
      const res = await fetch(`${API}/hq/stores`, { headers });
      const data = await res.json().catch(() => ({}));
      const flat = (data.data || []).flatMap(s => [s, ...(s.branches || [])]);
      setStores(flat);
      if (flat.length === 1) setStoreId(flat[0].id);
    } catch {
      // Store selector just stays empty — the row-level "store_id required"
      // error from /commit will surface if the caller doesn't pick one.
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/inventory-import/preview`, { method: "POST", headers, body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not read this file.");
      setPreview(data);
      if (data.needs_store_selection) await loadStores();
      setStep("review");
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const validRows = preview.rows.filter(r => !r.errors.length);
    if (!validRows.length) return;
    if (preview.needs_store_selection && !storeId) {
      setError("Pick which store this stock belongs to.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/inventory-import/commit`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId || null,
          rows: validRows.map((row) => {
            const { errors: _errors, row_no: _rowNo, ...rest } = row;
            return rest;
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Import failed.");
      setResult(data);
      setStep("done");
      onImported?.();
    } catch (e) {
      setError(e.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const validCount = preview?.rows?.filter(r => !r.errors.length).length || 0;
  const errorCount = preview?.rows?.filter(r => r.errors.length).length || 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 820, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaFileImport style={{ color: "#4F46E5" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: 0 }}>Bulk Import Inventory</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Migrate an existing catalogue/stock count from a spreadsheet</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16 }}><FaTimes /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 }}>
              {error}
            </div>
          )}

          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <a
                href={`${API}/inventory-import/template`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "8px 14px", borderRadius: 10, border: "1px solid #C7D2FE", background: "#EEF2FF", color: "#4F46E5", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                <FaDownload /> Download CSV template
              </a>
              <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Fill in <strong>product_name</strong>, <strong>unit</strong> and <strong>opening_qty</strong> at minimum — everything else is optional.
                Leave <strong>sku</strong>/<strong>barcode</strong> blank to have RMS generate them, or fill them in to keep the identifiers already printed on your existing stock.
              </p>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 16px", borderRadius: 14, border: "2px dashed #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}>
                <FaFileUpload style={{ fontSize: 26, color: "#94A3B8" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{file ? file.name : "Click to choose a CSV or Excel file"}</span>
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              <button
                onClick={handleUpload}
                disabled={!file || busy}
                style={{ alignSelf: "flex-end", padding: "10px 20px", borderRadius: 10, border: "none", background: !file || busy ? "#C7D2FE" : "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700, cursor: !file || busy ? "not-allowed" : "pointer" }}
              >
                {busy ? "Reading…" : "Preview"}
              </button>
            </div>
          )}

          {step === "review" && preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
                  <FaCheckCircle /> {validCount} ready to import
                </span>
                {errorCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                    <FaExclamationTriangle /> {errorCount} skipped (fix and re-upload if needed)
                  </span>
                )}
              </div>

              {preview.needs_store_selection && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Which store does this stock belong to?</label>
                  <select value={storeId} onChange={e => setStoreId(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13 }}>
                    <option value="">Select a store…</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.type === "branch" ? " (branch)" : ""}</option>)}
                  </select>
                </div>
              )}

              <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#F8FAFC" }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Row</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Product</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Cost</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.row_no} style={{ borderTop: "1px solid #F1F5F9", background: r.errors.length ? "#FEF2F2" : "transparent" }}>
                        <td style={{ padding: "7px 10px", color: "#94A3B8" }}>{r.row_no}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0f172a" }}>{r.product_name || <em style={{ color: "#94A3B8" }}>—</em>}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>{r.opening_qty}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>₹{r.cost_price}</td>
                        <td style={{ padding: "7px 10px", color: r.errors.length ? "#B91C1C" : "#059669" }}>
                          {r.errors.length ? r.errors.join("; ") : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button onClick={() => { setStep("upload"); setPreview(null); setFile(null); }} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                  Back
                </button>
                <button
                  onClick={handleCommit}
                  disabled={busy || !validCount}
                  style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: busy || !validCount ? "#C7D2FE" : "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy || !validCount ? "not-allowed" : "pointer" }}
                >
                  {busy ? "Importing…" : `Import ${validCount} item${validCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}

          {step === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FaCheckCircle style={{ color: "#059669", fontSize: 24 }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", margin: 0 }}>{result.imported} item{result.imported === 1 ? "" : "s"} imported into {result.store?.name}</p>
              {result.skipped > 0 && <p style={{ fontSize: 12.5, color: "#B91C1C", margin: 0 }}>{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped — see errors above before re-uploading them separately.</p>}
              <button onClick={onClose} style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
