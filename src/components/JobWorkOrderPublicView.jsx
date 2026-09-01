import React, { useEffect, useState } from "react";
import { FaBoxOpen, FaFilePdf, FaTshirt } from "react-icons/fa";
import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import { downloadTechPackPdf } from "./Production/TechPackLibrary.jsx";

const API_BASE = APP_API_URL;

// ─────────────────────────────────────────────────────────────────────────────
// JobWorkOrderPublicView.jsx
// Public page — no login required. A walk-in job worker (no vendor portal
// account) opens this from the link in their order email/WhatsApp message.
// Shows the job work order AND, if one was linked, the full tech pack —
// same content a registered vendor already sees in VendorJobWork.jsx.
//
// Route (see App.jsx):
//   <Route path="/job-work-view/:token" element={<JobWorkOrderPublicView />} />
// ─────────────────────────────────────────────────────────────────────────────

function getTokenFromPath() {
  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1] || "";
}

function InfoRow({ label, value }) {
  return (
    <tr>
      <td style={{ padding: "6px 18px 6px 0", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "6px 0", color: "#0f172a" }}>{value || "-"}</td>
    </tr>
  );
}

function TechPackContent({ pack }) {
  if (!pack) return null;
  const images = [...new Set([...(pack.sketch_images || []), ...(pack.reference_images || [])])];
  return (
    <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
            Tech Pack {pack.tech_pack_no ? `· ${pack.tech_pack_no}` : ""} {pack.version ? `(v${pack.version})` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
            {[pack.theme_name, pack.collection, pack.designer_name].filter(Boolean).join(" · ") || pack.style_name}
          </p>
        </div>
        <button
          onClick={() => downloadTechPackPdf(pack)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "#4F46E5", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          <FaFilePdf /> Download Tech Pack PDF
        </button>
      </div>

      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {images.slice(0, 6).map((src, i) => (
            <img key={i} src={src} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0" }} />
          ))}
        </div>
      )}

      {Array.isArray(pack.measurement_rows) && pack.measurement_rows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "0 0 4px" }}>MEASUREMENTS</p>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ background: "#EEF2FF" }}>
                <th style={{ textAlign: "left", padding: "5px 8px" }}>Point of Measure</th>
                {(pack.sizes || []).map((s, i) => <th key={i} style={{ textAlign: "right", padding: "5px 8px" }}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {pack.measurement_rows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "5px 8px" }}>{row.point_of_measure || row.pom || ""}</td>
                  {(pack.sizes || []).map((s, j) => <td key={j} style={{ textAlign: "right", padding: "5px 8px" }}>{row[s] ?? row.values?.[j] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(pack.trims_items) && pack.trims_items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "0 0 4px" }}>TRIMS</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155" }}>
            {pack.trims_items.map((t, i) => <li key={i}>{[t.name, t.spec, t.qty && `qty ${t.qty}`].filter(Boolean).join(" — ")}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(pack.colourways) && pack.colourways.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "0 0 4px" }}>COLOURWAYS</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pack.colourways.map((c, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155" }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid #CBD5E1", background: c.hex || c.color || "#ccc" }} />
                {c.name || c.color}
              </span>
            ))}
          </div>
        </div>
      )}

      {[
        ["Fabric notes", pack.fabric_notes],
        ["Construction notes", pack.construction_notes],
        ["Artwork notes", pack.artwork_notes],
        ["Trims & labels notes", pack.trims_labels_notes],
      ].filter(([, v]) => v).map(([label, value]) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "0 0 2px" }}>{label.toUpperCase()}</p>
          <p style={{ fontSize: 12.5, color: "#334155", margin: 0, whiteSpace: "pre-wrap" }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function JobWorkOrderPublicView() {
  const token = getTokenFromPath();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    fetch(`${API_BASE}/api/job-work/orders/public/${token}`)
      .then(r => r.json().then(j => ({ ok: r.ok, ...j })))
      .then(j => {
        if (!j.ok) setError(j.detail || "This link is invalid or has expired.");
        else setOrder(j.data);
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 }}>Loading order…</div>;
  }
  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: "center", background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #E2E8F0" }}>
          <p style={{ fontWeight: 700, color: "#B91C1C", fontSize: 15, margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E2E8F0", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaBoxOpen style={{ color: "#4F46E5" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Job Work Order {order.order_no}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>from {order.retailer_name}</p>
            </div>
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 13.5, width: "100%" }}>
            <tbody>
              <InfoRow label="Job worker" value={order.job_worker_name} />
              <InfoRow label="Work type" value={order.job_work_type} />
              <InfoRow label="Finished product" value={order.finished_product} />
              <InfoRow label="Expected quantity" value={`${order.expected_quantity} ${order.unit || ""}`} />
              <InfoRow label="Due date" value={order.due_date} />
              {order.remarks && <InfoRow label="Remarks" value={order.remarks} />}
            </tbody>
          </table>
        </div>

        {(order.design_lines || []).map((line, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #E2E8F0", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FaTshirt style={{ color: "#64748b" }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                {line.design_no || line.product_type || `Design line ${i + 1}`} {line.quantity ? `· ${line.quantity} pcs` : ""}
              </p>
            </div>
            {line.tech_pack ? (
              <TechPackContent pack={line.tech_pack} />
            ) : (
              <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "8px 0 0" }}>No tech pack linked to this design line — contact {order.retailer_name} for design references.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
