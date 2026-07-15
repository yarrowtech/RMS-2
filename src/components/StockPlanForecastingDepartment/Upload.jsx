import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState } from "react";
import { FaFileUpload } from "react-icons/fa";

export default function Upload() {
  const [salesCount, setSalesCount] = useState(0);
  const [stockCount, setStockCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const API_BASE = `${APP_API_URL}`; 

  const uploadFiles = async (e, type) => {
    const files = e.target.files;
    if (!files.length) return;

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/upload/${type}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.detail || `Upload failed with status ${res.status}`;
        alert(`❌ ${msg}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (type === "sales") setSalesCount(data.count || 0);
      if (type === "stock") setStockCount(data.count || 0);

      alert(
        `✅ ${type.toUpperCase()} data uploaded successfully.\nInserted rows: ${data.count}`
      );
    } catch (err) {
      console.error("Upload error:", err);
      alert("⚠️ Upload failed. Check backend connection or file format.");
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset file input so same file can be uploaded again
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        📤 Upload Sales & Stock Data
      </h2>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* ─── Sales Upload ─── */}
        <div className="rounded-xl border p-4 bg-white shadow hover:shadow-md transition">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FaFileUpload className="text-blue-600" /> Upload Sales Data
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                <b>Required Columns:</b> Store, Division, Section, Department, Vendor, BillQty
                <br />
                <b>Optional Columns:</b> Category1–Category6 (Ageing), RSP, Standard Rate
                <br />
                <b>Date Column:</b> Bill Date / Date (auto-detected)
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => uploadFiles(e, "sales")}
              disabled={loading}
              className="text-xs"
            />
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Uploaded rows (Sales): <b>{salesCount}</b>
          </p>
        </div>

        {/* ─── Stock Upload ─── */}
        <div className="rounded-xl border p-4 bg-white shadow hover:shadow-md transition">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FaFileUpload className="text-emerald-600" /> Upload Stock Data
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                <b>Required Columns:</b> Division, Section, Department, Vendor, ClosingQty
                <br />
                <b>Date Column:</b> Stock As On / As On Date / Date (auto-detected)
                <br />
                <b>Note:</b> ClosingAmt not needed anymore.
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => uploadFiles(e, "stock")}
              disabled={loading}
              className="text-xs"
            />
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Uploaded rows (Stock): <b>{stockCount}</b>
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-blue-500 mt-4 animate-pulse">
          ⏳ Uploading... Please wait
        </p>
      )}
    </div>
  );
}
