import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useMemo, useState } from "react";
import { FaDownload, FaFileAlt, FaFileUpload, FaHistory, FaRedo } from "react-icons/fa";

const fmtDateTime = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const typeClass = (type) =>
  type === "stock"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

export default function Upload() {
  const [activeTab, setActiveTab] = useState("upload");
  const [historyType, setHistoryType] = useState("all");
  const [salesCount, setSalesCount] = useState(0);
  const [stockCount, setStockCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const API_BASE = `${APP_API_URL}`;

  const fetchUploadedFiles = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/api/upload/files`);
      if (!res.ok) throw new Error(`History failed with status ${res.status}`);
      const data = await res.json();
      setUploadedFiles(Array.isArray(data.files) ? data.files : []);
    } catch (err) {
      console.error("Upload history error:", err);
      setUploadedFiles([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") fetchUploadedFiles();
  }, [activeTab]);

  const filteredFiles = useMemo(() => {
    if (historyType === "all") return uploadedFiles;
    return uploadedFiles.filter((file) => file.type === historyType);
  }, [uploadedFiles, historyType]);

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
        alert(`Upload failed: ${msg}`);
        return;
      }

      const data = await res.json();
      if (type === "sales") setSalesCount(data.count || 0);
      if (type === "stock") setStockCount(data.count || 0);
      await fetchUploadedFiles();

      alert(`${type.toUpperCase()} data uploaded successfully. Inserted rows: ${data.count}`);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Check backend connection or file format.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const downloadFile = (file) => {
    if (!file?.downloadable) return;
    window.open(`${API_BASE}/api/upload/files/${file.id}/download`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Data Upload Center</h2>
          <p className="text-sm text-slate-600">Upload planning files and review the uploaded file register separately.</p>
        </div>

        <div className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition sm:flex-none ${
              activeTab === "upload" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Upload Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition sm:flex-none ${
              activeTab === "history" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Uploaded Files
          </button>
        </div>
      </div>

      {activeTab === "upload" && (
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
            <FaFileUpload className="text-blue-600" /> Upload Sales & Stock Data
          </h3>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-4 shadow transition hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FaFileUpload className="text-blue-600" /> Upload Sales Data
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    <b>Required Columns:</b> Store, Division, Section, Department, Vendor, BillQty
                    <br />
                    <b>Optional Columns:</b> Category1-Category6 (Ageing), RSP, Standard Rate
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

            <div className="rounded-xl border bg-white p-4 shadow transition hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FaFileUpload className="text-emerald-600" /> Upload Stock Data
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
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

          {loading && <p className="mt-4 animate-pulse text-sm text-blue-600">Uploading... Please wait</p>}
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <FaHistory className="text-blue-600" /> Uploaded Files
              </h3>
              <p className="text-sm text-slate-500">Sales and stock file register from this upload center.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {["all", "sales", "stock"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setHistoryType(type)}
                  className={`rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                    historyType === type ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"
                  }`}
                >
                  {type === "all" ? "All" : type}
                </button>
              ))}
              <button
                type="button"
                onClick={fetchUploadedFiles}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <FaRedo /> Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">File name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Collection</th>
                  <th className="px-4 py-3 text-right">Inserted rows</th>
                  <th className="px-4 py-3 text-left">Uploaded at</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <FaFileAlt className="text-slate-400" />
                        <span className="max-w-[320px] truncate" title={file.filename}>{file.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${typeClass(file.type)}`}>
                        {file.type || "file"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{file.collection || "-"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{file.inserted_rows ?? 0}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDateTime(file.uploaded_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadFile(file)}
                        disabled={!file.downloadable}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold ${
                          file.downloadable
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                        title={file.downloadable ? "Download original uploaded file" : "Old upload record has no stored file"}
                      >
                        <FaDownload /> Download
                      </button>
                    </td>
                  </tr>
                ))}

                {!filteredFiles.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                      {historyLoading ? "Loading uploaded files..." : "No uploaded files found for this view."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
