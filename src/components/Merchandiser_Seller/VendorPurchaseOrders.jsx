import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import ReactDOM from "react-dom";

/* ─────────── design tokens ─────────── */
const T = {
  navy:    "#0F1B2D", navyMid: "#1A2D47", card: "#FFFFFF",
  border:  "#E4EAF3", muted:   "#7A8BA4", label: "#3D5166",
  orange:  "#F76B15", coral:   "#FF4D6D", teal:  "#0CC6B6",
  violet:  "#7C3AED", amber:   "#F59E0B", sky:   "#0EA5E9",
  emerald: "#10B981", rose:    "#F43F5E",
  orangeSoft: "#FFF4ED", tealSoft: "#EDFAFA", violetSoft: "#F5F3FF",
  amberSoft:  "#FFFBEB", skySoft:  "#F0F9FF", emeraldSoft:"#ECFDF5",
  roseSoft:   "#FFF1F2",
};

const statusConfig = {
  Draft:           { bg: T.amberSoft,   text: "#92400E", dot: T.amber,   label: "Draft"          },
  SentToVendor:    { bg: T.skySoft,     text: "#0C4A6E", dot: T.sky,     label: "Sent to Vendor" },
  VendorSubmitted: { bg: T.violetSoft,  text: "#4C1D95", dot: T.violet,  label: "Submitted"      },
  WalkinAccepted:  { bg: T.emeraldSoft, text: "#064E3B", dot: T.emerald, label: "✓ Accepted"     },
  Approved:        { bg: T.emeraldSoft, text: "#064E3B", dot: T.emerald, label: "Approved"        },
  Rejected:        { bg: T.roseSoft,    text: "#881337", dot: T.rose,    label: "Rejected"        },
};

/* ─────────── helpers ─────────── */
function isHexColor(str) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test((str || "").trim());
}

function extractHexColor(str) {
  const match = (str || "").match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/);
  return match ? match[0] : null;
}

/* ─────────── flattenVendorProducts ─────────── */
function flattenVendorProducts(products) {
  const items = [];
  for (const p of products) {
    if (!p.has_variants) {
      items.push({
        sku:         p.sku || p.base_sku || "",
        barcode:     p.barcode || p.base_barcode || "",
        description: p.product_name,
        rate:        p.selling_price || p.mrp || 0,
        color:       "",
        size_label:  "",
        size_value:  "",
        stock:       p.quantity ?? 0,
        label:       p.product_name,
        sublabel:    `SKU: ${p.sku || p.base_sku || "—"} · BC: ${p.barcode || p.base_barcode || "—"} · Stock: ${p.quantity ?? 0}`,
      });
    } else {
      for (const v of (p.variants || [])) {
        const resolvedColor =
          v.color && !isHexColor(v.color) ? v.color :
          v.color && isHexColor(v.color)  ? v.color :
          extractHexColor(v.size_label)   ||
          extractHexColor(v.size_value)   || "";

        const cleanSizeLabel = v.size_label
          ? v.size_label.replace(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g, "").replace(/\s+/g, " ").trim()
          : "";

        const labelParts = [p.product_name];
        if (cleanSizeLabel) labelParts.push(cleanSizeLabel);
        if (labelParts.length === 1 && v.sku) {
          labelParts.push(v.sku.split("-").slice(-1)[0]);
        }

        items.push({
          sku:         v.sku     || "",
          barcode:     v.barcode || "",
          description: labelParts.join(" | "),
          rate:        v.selling_price || v.mrp || 0,
          color:       resolvedColor,
          size_label:  cleanSizeLabel,
          size_value:  v.size_value || "",
          stock:       v.stock ?? 0,
          label:       labelParts.join(" — "),
          sublabel: [
            `SKU: ${v.sku || "—"}`,
            `BC: ${v.barcode || "—"}`,
            v.size_value ? `Size: ${v.size_value}` : "",
            resolvedColor ? `Color: ${resolvedColor}` : "",
            `Stock: ${v.stock ?? 0}`,
          ].filter(Boolean).join(" · "),
        });
      }
    }
  }
  return items;
}

/* ─────────── DescriptionCell ─────────── */
function DescriptionCell({ text }) {
  if (!text) return <span style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>—</span>;

  const hexColor   = extractHexColor(text);
  const displayText = text.replace(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g, "").replace(/\s*[|·]\s*$/, "").trim();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {hexColor && (
        <span title={hexColor} style={{
          display: "inline-block", width: 16, height: 16,
          borderRadius: 4, flexShrink: 0,
          background: hexColor, border: "1.5px solid rgba(0,0,0,0.15)",
        }} />
      )}
      <span style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>
        {displayText}
      </span>
    </div>
  );
}

/* ─────────── sub-components ─────────── */
function StatusBadge({ status }) {
  const cfg = statusConfig[status] || { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF", label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 99,
      background: cfg.bg, color: cfg.text,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function IconBtn({ children, onClick, disabled, variant = "ghost", title }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "7px 14px", borderRadius: 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
    opacity: disabled ? 0.4 : 1,
  };
  const variants = {
    ghost:   { background: "#F1F5F9", color: T.label },
    primary: { background: `linear-gradient(135deg, ${T.orange}, ${T.coral})`, color: "#fff" },
    teal:    { background: `linear-gradient(135deg, ${T.teal}, #0891B2)`, color: "#fff" },
    violet:  { background: `linear-gradient(135deg, ${T.violet}, #9333EA)`, color: "#fff" },
    outline: { background: "transparent", color: T.orange, border: `1.5px solid ${T.orange}` },
  };
  return (
    <button onClick={!disabled ? onClick : undefined} style={{ ...base, ...variants[variant] }} title={title}>
      {children}
    </button>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th style={{
      textAlign: align, padding: "10px 14px",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
      color: T.muted, textTransform: "uppercase",
      background: "#F8FAFD", borderBottom: `1px solid ${T.border}`,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>{children}</th>
  );
}

function Td({ children, align = "left", mono = false }) {
  return (
    <td style={{
      padding: "10px 14px", fontSize: 13, color: T.navy,
      textAlign: align, borderBottom: `1px solid ${T.border}`,
      fontFamily: mono ? "'JetBrains Mono', monospace" : "'Plus Jakarta Sans', sans-serif",
    }}>{children}</td>
  );
}

function SmartInput({ value, onChange, type = "text", readOnly = false, placeholder = "" }) {
  return (
    <input
      type={type} value={value ?? ""} readOnly={readOnly} placeholder={placeholder}
      onChange={onChange}
      style={{
        width: "100%", padding: "6px 10px",
        border: `1.5px solid ${readOnly ? T.border : "#CBD5E1"}`,
        borderRadius: 8, fontSize: 13,
        color: readOnly ? T.muted : T.navy,
        background: readOnly ? "#F8FAFD" : "#fff",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
      }}
    />
  );
}

/* ─────────── ProductSelect ─────────── */
function ProductSelect({ flatItems, value, onChange, onCreateNew }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const [pos,   setPos]   = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef   = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current   && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect       = triggerRef.current.getBoundingClientRect();
      const panelH     = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp     = spaceBelow < panelH && rect.top > panelH;
      setPos({
        top:   flipUp
          ? rect.top + window.scrollY - panelH - 4
          : rect.bottom + window.scrollY + 4,
        left:  rect.left + window.scrollX,
        width: rect.width,
        flipUp,
      });
    }
    setOpen(o => !o);
  };

  const selected = flatItems.find(f => (f.sku || "").trim() === (value || "").trim());

  const filtered = useMemo(() => {
    if (!query.trim()) return flatItems.slice(0, 200);
    const q = query.toLowerCase();
    return flatItems.filter(f =>
      (f.label       || "").toLowerCase().includes(q) ||
      (f.sku         || "").toLowerCase().includes(q) ||
      (f.barcode     || "").includes(q)               ||
      (f.size_label  || "").toLowerCase().includes(q) ||
      (f.description || "").toLowerCase().includes(q)
    ).slice(0, 200);
  }, [query, flatItems]);

  const panel = open && ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={{
        position: "absolute", top: pos.top, left: pos.left,
        width: Math.max(pos.width, 320), zIndex: 999999,
        background: "#fff",
        borderRadius: pos.flipUp ? "10px 10px 4px 4px" : "4px 4px 10px 10px",
        border: `1.5px solid ${T.border}`,
        boxShadow: "0 8px 28px rgba(15,27,45,0.22)",
        overflow: "visible",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div style={{ padding: "7px 9px", borderBottom: `1px solid ${T.border}`,
        borderRadius: "inherit", borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          background: "#F8FAFD", borderRadius: 7, padding: "5px 9px" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={T.muted} strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            autoFocus value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, SKU, barcode…"
            style={{
              border: "none", outline: "none", background: "transparent",
              fontSize: 12, color: T.navy, width: "100%",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          />
        </div>
      </div>

      {/* ⚠️ NEW — "Create new product" entry, always visible at the top of
          the panel. Previously, a vendor with an empty or incomplete
          catalog had NOTHING to select — this was the actual blocker, not
          just "matching is tedious." Clicking this switches the row into
          create-new mode instead of picking from flatItems. */}
      {onCreateNew && (
        <button
          onMouseDown={(e) => { e.preventDefault(); onCreateNew(); setOpen(false); setQuery(""); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "9px 11px", border: "none", cursor: "pointer",
            background: T.orangeSoft, borderBottom: `1px solid ${T.border}`,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.orange}
            strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>
            Create new product — not in my catalog yet
          </span>
        </button>
      )}

      <div style={{
        padding: "4px 10px", background: "#F8FAFD",
        borderBottom: `1px solid ${T.border}`,
        fontSize: 10, fontWeight: 700, color: T.muted,
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        {flatItems.length === 0
          ? "No catalogue items yet — create one above"
          : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`}
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {flatItems.length === 0 ? null : filtered.length === 0 ? (
          <div style={{ padding: "18px 14px", textAlign: "center", fontSize: 12, color: T.muted }}>
            No products match your search.
          </div>
        ) : filtered.map((item, i) => {
          const isSelected = (item.sku || "").trim() === (value || "").trim();
          return (
            <div
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item.sku);
                setOpen(false);
                setQuery("");
              }}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 11px", cursor: "pointer",
                borderBottom: `1px solid ${T.border}`,
                background: isSelected ? T.orangeSoft : "#fff",
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F8FAFD"; }}
              onMouseLeave={e => { e.currentTarget.style.background = isSelected ? T.orangeSoft : "#fff"; }}
            >
              {item.color ? (
                <div style={{
                  width: 24, height: 24, borderRadius: 5, flexShrink: 0,
                  background: item.color, border: "1.5px solid rgba(0,0,0,0.10)",
                }} title={item.color} />
              ) : (
                <div style={{
                  width: 24, height: 24, borderRadius: 5, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800,
                  background: `hsl(${(i * 53) % 360},55%,92%)`,
                  color:      `hsl(${(i * 53) % 360},50%,38%)`,
                }}>
                  {(item.label || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: T.navy,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>
                  {item.sku || "—"} · {item.barcode || "—"}
                </div>
              </div>
              {item.rate > 0 && (
                <div style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 700,
                  color: T.emerald, background: T.emeraldSoft,
                  borderRadius: 5, padding: "2px 6px",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  ₹{Number(item.rate).toLocaleString("en-IN")}
                </div>
              )}
              {isSelected && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={T.orange} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <div ref={triggerRef} onClick={openDropdown} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 8, cursor: "pointer",
        border: `1.5px solid ${open ? T.orange : "#CBD5E1"}`,
        background: "#fff", minHeight: 36,
        boxShadow: open ? `0 0 0 3px ${T.orange}18` : "none",
        transition: "all 0.15s",
      }}>
        {selected ? (
          <>
            {selected.color && (
              <span style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                background: selected.color, border: "1px solid rgba(0,0,0,0.12)",
                display: "inline-block",
              }} />
            )}
            <span style={{
              flex: 1, fontSize: 12, fontWeight: 600, color: T.navy,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {selected.label}
            </span>
            <span
              onMouseDown={e => {
                e.stopPropagation();
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              style={{ color: T.muted, fontSize: 15, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>
              ×
            </span>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 12, color: T.muted, fontStyle: "italic" }}>
              — Select product / variant —
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={T.muted} strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </>
        )}
      </div>
      {panel}
    </>
  );
}

/* ─────────── NewProductInline ─────────── */
/* ⚠️ NEW — the actual "build the catalogue while creating the PO" feature.
   Replaces the ProductSelect cell for a row in create-new mode. Vendor
   types just a name and rate — everything else (division, HSN, etc.)
   stays blank/default, same as add_product's own defaults, since none of
   that is essential to fulfil this one PO line. The product still gets
   created as a real, permanent catalogue entry (product_collection) — it
   isn't a throwaway, it's genuinely available to reuse and select
   normally on the next PO. */
function NewProductInline({ row, onFieldChange, onCancel }) {
  return (
    <div style={{
      border: `1.5px dashed ${T.orange}`, borderRadius: 8,
      padding: "8px 9px", background: T.orangeSoft,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          New product
        </span>
        <button onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
          style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>
          × cancel
        </button>
      </div>
      <input
        value={row.new_product_name || ""}
        onChange={(e) => onFieldChange("new_product_name", e.target.value)}
        placeholder="Product name *"
        style={{
          width: "100%", padding: "6px 8px", marginBottom: 5,
          border: `1.5px solid #CBD5E1`, borderRadius: 6, fontSize: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box",
        }}
      />
      <input
        value={row.new_product_sku || ""}
        onChange={(e) => onFieldChange("new_product_sku", e.target.value)}
        placeholder="SKU / barcode (optional — auto-generated if blank)"
        style={{
          width: "100%", padding: "6px 8px",
          border: `1.5px solid #CBD5E1`, borderRadius: 6, fontSize: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "16px 20px",
      borderTop: `3px solid ${accent}`, minWidth: 130,
    }}>
      <p style={{ margin: 0, fontSize: 11, color: T.muted, fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: T.navy,
        fontFamily: "'Bricolage Grotesque', sans-serif" }}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18, margin: "0 auto 20px",
        background: T.orangeSoft, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.orange}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
          <line x1="9" y1="16" x2="12" y2="16"/>
        </svg>
      </div>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.navy }}>No purchase orders yet</p>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: T.muted }}>Orders assigned to you will appear here.</p>
    </div>
  );
}

/* ─────────── POCard ─────────── */
function POCard({
  po, flatItems, expanded, onToggle,
  itemsDraft, onAddItem, onItemChange, onProductSelect,
  onSave, onSubmit, onPreFill, onToggleNewProduct, saving,
}) {
  const draft     = itemsDraft[po._id] || [];
  const canSubmit = po.status === "SentToVendor" || po.status === "WalkinAccepted";
  const isWalkin  = po.vendor_type === "walkin" || po.status === "WalkinAccepted";
  const totalVal  = (po.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);
  const retailerName = po.retailer_name || po.ownerSite || "Retailer";
  const buyerName = po.buyer_name || po.merchandiserName || "";
  const buyerTeam = po.buyer_team || po.teamName || "";

  const prevExpanded = useRef(false);

  useEffect(() => {
    if (expanded && !prevExpanded.current && canSubmit && (po.items || []).length > 0) {
      const hasSelections = draft.some(r => r.product_sku || r.barcode);
      if (!hasSelections) {
        onPreFill(po._id, po.items);
      }
    }
    prevExpanded.current = expanded;
  }, [expanded]); // eslint-disable-line

  return (
    <div style={{
      background: "#fff", border: `1px solid ${T.border}`,
      borderRadius: 18, overflow: "visible",
      boxShadow: expanded ? "0 8px 32px rgba(15,27,45,0.10)" : "0 2px 8px rgba(15,27,45,0.05)",
      transition: "box-shadow 0.2s",
    }}>
      <div style={{
        height: 4, borderRadius: "18px 18px 0 0",
        background: `linear-gradient(90deg, ${T.orange}, ${T.coral}, ${T.violet})`,
      }} />

      {/* header row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, padding: "18px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${T.orange}22, ${T.coral}22)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.orange}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.navy,
              fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {po.orderNo}
              {isWalkin && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 20,
                  background: T.amberSoft, color: "#92400E",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>Walk-in</span>
              )}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <StatusBadge status={po.status} />
              <span style={{ fontSize: 12, color: T.muted }}>
                {(po.items || []).length} item{po.items?.length !== 1 ? "s" : ""}
              </span>
              {totalVal > 0 && (
                <span style={{ fontSize: 12, color: T.muted }}>
                  · ₹{totalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <div style={{
              display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
              marginTop: 8, fontSize: 12, color: T.label,
            }}>
              <span style={{
                fontWeight: 700, color: T.violet, background: `${T.violet}12`,
                borderRadius: 999, padding: "3px 8px",
              }}>Raised by</span>
              <span style={{ fontWeight: 700, color: T.navy }}>{retailerName}</span>
              {buyerName && <span>· Buyer: {buyerName}</span>}
              {buyerTeam && <span>· {buyerTeam}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <IconBtn variant="ghost" onClick={onToggle}>
            {expanded
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
            }
            {expanded ? "Collapse" : "Expand"}
          </IconBtn>
          <IconBtn variant="teal" onClick={onSubmit} disabled={!canSubmit}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Submit PO
          </IconBtn>
        </div>
      </div>

      {/* expanded body */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>

          {/* Buyer's Order Items */}
          {(po.items || []).length > 0 && (
            <div style={{ padding: "20px 24px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: T.muted,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Buyer's Order Items
              </p>
              <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <Th>#</Th><Th>Barcode</Th><Th>Description</Th>
                      <Th align="center">Ordered Qty</Th><Th align="center">Amended Qty</Th>
                      <Th align="right">Buyer Rate</Th><Th align="right">Your Rate</Th>
                      <Th align="right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((it, i) => {
                      const vendorRate  = it.vendorRate || it.rate || 0;
                      const displayQty  = it.amendedQty || it.quantity || 0;
                      const total       = displayQty * vendorRate;
                      const hasVariance = it.variancePct && Math.abs(it.variancePct) > 0;
                      const varianceColor =
                        !hasVariance ? T.muted :
                        Math.abs(it.variancePct) > 10 ? T.rose :
                        Math.abs(it.variancePct) > 3  ? T.amber : T.emerald;
                      const isItemBc = (it.barcode || "").startsWith("ITEM/");

                      const descHex   = extractHexColor(it.description || "");
                      const cleanDesc = (it.description || "")
                        .replace(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g, "")
                        .replace(/\s*[|·]\s*$/, "").trim();

                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFD" }}>
                          <Td>{i + 1}</Td>
                          <Td mono>
                            {isItemBc ? (
                              <span style={{ color: T.muted, fontStyle: "italic", fontSize: 11 }}>
                                #{(it.barcode.split("/")[2] || "").replace(/^0+/, "") || "—"}
                              </span>
                            ) : (it.barcode || "—")}
                          </Td>
                          <Td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                              {descHex && (
                                <span title={descHex} style={{
                                  display: "inline-block", flexShrink: 0,
                                  width: 14, height: 14, borderRadius: 3,
                                  background: descHex, border: "1.5px solid rgba(0,0,0,0.15)",
                                }} />
                              )}
                              {cleanDesc}
                            </div>
                            {it.description && it.description.includes(" | ") && (
                              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                                {it.description.split(" | ").slice(1)
                                  .map(p => p.replace(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g, "").trim())
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                            {it.dueDate && (
                              <div style={{ fontSize: 10, color: T.sky, marginTop: 2 }}>Due: {it.dueDate}</div>
                            )}
                          </Td>
                          <Td align="center">{it.quantity || 0}</Td>
                          <Td align="center">
                            {it.amendedQty != null
                              ? <span style={{ fontWeight: 700, color: T.violet }}>{it.amendedQty}</span>
                              : <span style={{ color: T.muted }}>—</span>}
                          </Td>
                          <Td align="right">
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                              ₹{Number(it.buyerRate || it.rate || 0).toLocaleString("en-IN")}
                            </span>
                          </Td>
                          <Td align="right">
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }}>
                                ₹{Number(vendorRate).toLocaleString("en-IN")}
                              </span>
                              {hasVariance && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: varianceColor }}>
                                  {it.variancePct > 0 ? "+" : ""}{it.variancePct?.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </Td>
                          <Td align="right">
                            <span style={{ fontWeight: 600, color: T.emerald,
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                              ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={6} />
                      <td style={{ padding: "10px 14px", fontSize: 12, color: T.muted,
                        textAlign: "right", fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.05em" }}>Total</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700,
                        fontSize: 14, color: T.navy, borderTop: `2px solid ${T.border}`,
                        fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                        ₹{totalVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Add / Update Items */}
          {canSubmit && (
            <div style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.muted,
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Add / Update Items
                </p>
                <IconBtn variant="ghost" onClick={onAddItem}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Row
                </IconBtn>
              </div>

              {isWalkin ? (
                <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10,
                  background: T.amberSoft, border: `1px solid #FDE68A`, fontSize: 12, color: "#92400E" }}>
                  <b>📦 Walk-in PO — Action required:</b> For each row below, the amber box shows
                  what the buyer ordered. Select <b>your matching product</b> from your catalog,
                  or click <b>"Create new product"</b> if it's not in your catalogue yet — it'll
                  be added to your catalogue permanently and used for this order. Confirm quantity
                  and rate, then click <b>Save Items</b> followed by <b>Submit PO</b>.
                </div>
              ) : (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
                  background: T.skySoft, border: `1px solid #BAE6FD`, fontSize: 12, color: "#0C4A6E" }}>
                  ℹ Variant products are listed individually — select the exact size and colour you are supplying.
                </div>
              )}

              {draft.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "28px 16px",
                  background: "#F8FAFD", borderRadius: 12,
                  border: `2px dashed ${T.border}`,
                }}>
                  <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
                    No draft rows yet. Click <strong>Add Row</strong> to begin.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ borderRadius: 12, overflow: "visible", border: `1px solid ${T.border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                      <thead>
                        <tr>
                          <Th>Your Product / Variant</Th>
                          <Th>Barcode</Th>
                          <Th>Buyer Requested</Th>
                          <Th align="center">Qty</Th>
                          <Th align="right">Your Rate (₹)</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.map((item, idx) => {
                          const buyerRef = item.buyer_description || item.description || "";
                          const selectedProduct = flatItems.find(
                            f => (f.sku || "").trim() === (item.product_sku || "").trim()
                          );

                          return (
                            <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#FAFBFD" }}>
                              {/* Product selector — OR inline new-product creator */}
                              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`,
                                minWidth: 240, position: "relative", overflow: "visible" }}>
                                {item.is_new_product ? (
                                  <NewProductInline
                                    row={item}
                                    onFieldChange={(field, val) => onItemChange(idx, field, val)}
                                    onCancel={() => onToggleNewProduct(idx, false)}
                                  />
                                ) : (
                                  <ProductSelect
                                    flatItems={flatItems}
                                    value={item.product_sku || ""}
                                    onChange={(sku) => onProductSelect(idx, sku)}
                                    onCreateNew={() => onToggleNewProduct(idx, true)}
                                  />
                                )}
                              </td>

                              {/* Barcode — auto-filled from selected OR newly created product */}
                              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, minWidth: 140 }}>
                                {item.is_new_product ? (
                                  <span style={{ fontSize: 11, color: T.orange, fontStyle: "italic" }}>
                                    Will be generated on save
                                  </span>
                                ) : item.barcode ? (
                                  <div>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace",
                                      fontSize: 12, color: T.navy }}>
                                      {item.barcode}
                                    </span>
                                    <div style={{ fontSize: 10, color: T.emerald, marginTop: 2 }}>✓ Barcode assigned</div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: T.amber, fontStyle: "italic" }}>⚠ Select product →</span>
                                )}
                              </td>

                              {/* Buyer's requested description — read-only reference */}
                              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, minWidth: 200 }}>
                                {buyerRef ? (
                                  <div>
                                    <div style={{
                                      padding: "5px 9px", borderRadius: 7,
                                      background: T.amberSoft, border: `1px solid #FDE68A`,
                                      marginBottom: selectedProduct ? 5 : 0,
                                    }}>
                                      <div style={{
                                        fontSize: 9, fontWeight: 700, color: "#92400E",
                                        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2,
                                      }}>
                                        Buyer wants
                                      </div>
                                      <DescriptionCell text={buyerRef} />
                                    </div>

                                    {selectedProduct && (
                                      <div style={{
                                        display: "flex", alignItems: "center", gap: 5,
                                        padding: "4px 8px", borderRadius: 6,
                                        background: T.emeraldSoft, border: `1px solid #6EE7B7`,
                                      }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                          stroke={T.emerald} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                        <span style={{ fontSize: 10, fontWeight: 600, color: "#064E3B",
                                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {selectedProduct.label}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>
                                    — no reference —
                                  </span>
                                )}
                              </td>

                              {/* Qty */}
                              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, minWidth: 80 }}>
                                <SmartInput
                                  type="number" value={item.quantity ?? ""}
                                  onChange={(e) => onItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                                />
                              </td>

                              {/* Rate */}
                              <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, minWidth: 100 }}>
                                <SmartInput
                                  type="number" value={item.rate ?? ""}
                                  onChange={(e) => onItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <IconBtn variant="primary" onClick={onSave} disabled={saving}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      {saving ? "Creating products & saving…" : "Save Items"}
                    </IconBtn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── main component ─────────── */
export default function VendorPurchaseOrders({ vendorName }) {
  const [orders,     setOrders]     = useState([]);
  const [flatItems,  setFlatItems]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState(null);
  const [itemsDraft, setItemsDraft] = useState({});
  const [saving,     setSaving]     = useState(false);

  const getToken = () =>
    localStorage.getItem("access_token") ||
    localStorage.getItem("vendor_token") ||
    localStorage.getItem("token") || "";

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) { alert("Session expired. Please log in again."); return; }

        const res  = await axios.get(
          `${APP_API_URL}/api/vendors/my-purchaseorders`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = Array.isArray(res.data) ? res.data : [];
        setOrders(data);

        try {
          const prodRes = await axios.get(
            `${APP_API_URL}/api/products/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const raw = prodRes.data?.data || prodRes.data || [];
          const flattened = flattenVendorProducts(Array.isArray(raw) ? raw : []);
          setFlatItems(flattened);
        } catch (e) {
          console.error("[VendorPO] Failed to load products:", e);
          setFlatItems([]);
        }
      } catch (err) {
        console.error("Failed to load purchase orders:", err);
        alert("Failed to load purchase orders. Please try again.");
      } finally { setLoading(false); }
    };
    fetchOrders();
  }, []);

  const refreshOrders = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(
        `${APP_API_URL}/api/vendors/my-purchaseorders`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Refresh failed:", err); }
  };

  // ⚠️ NEW — reload the vendor's own catalogue after creating new products
  // on save, so flatItems (and thus the ProductSelect dropdown for OTHER
  // rows / future POs) includes them without needing a full page refresh.
  const refreshFlatItems = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const prodRes = await axios.get(
        `${APP_API_URL}/api/products/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw = prodRes.data?.data || prodRes.data || [];
      setFlatItems(flattenVendorProducts(Array.isArray(raw) ? raw : []));
    } catch (e) {
      console.error("[VendorPO] Failed to refresh products:", e);
    }
  };

  const toggleExpand = (id) => setExpanded(expanded === id ? null : id);

  const addNewItem = (poId) => {
    setItemsDraft(prev => ({
      ...prev,
      [poId]: [...(prev[poId] || []),
        { product_sku: "", barcode: "", description: "", buyer_description: "", quantity: 0, rate: 0 }],
    }));
  };

  const preFillDraft = (poId, poItems) => {
    const rows = (poItems || [])
      .filter(it => !it.removed)
      .map(it => ({
        product_sku:       "",
        barcode:           "",
        description:       it.description || "",
        buyer_description: it.description || "",
        quantity:          it.amendedQty || it.quantity || 0,
        rate:              it.rate || 0,
      }));
    if (rows.length > 0)
      setItemsDraft(prev => ({ ...prev, [poId]: rows }));
  };

  const handleItemChange = (poId, index, field, value) => {
    setItemsDraft(prev => {
      const updated = [...(prev[poId] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [poId]: updated };
    });
  };

  const handleProductSelect = (poId, index, sku) => {
    setItemsDraft(prev => {
      const updated = [...(prev[poId] || [])];
      if (!sku) {
        updated[index] = { ...updated[index], product_sku: "", barcode: "" };
      } else {
        const item = flatItems.find(f => (f.sku || "").trim() === sku.trim());
        updated[index] = {
          ...updated[index],
          product_sku: sku,
          barcode:     item?.barcode || "",
          rate:        updated[index].rate || item?.rate || 0,
        };
      }
      return { ...prev, [poId]: updated };
    });
  };

  // ⚠️ NEW — switches a row into/out of "create new product" mode.
  // Turning it ON clears any existing product_sku/barcode selection (the
  // row can't be both "an existing product" and "a new one" at once).
  // Turning it OFF clears the new-product fields so stale name/sku text
  // doesn't linger if the vendor picks an existing product afterward.
  const handleToggleNewProduct = (poId, index, isNew) => {
    setItemsDraft(prev => {
      const updated = [...(prev[poId] || [])];
      if (isNew) {
        updated[index] = {
          ...updated[index],
          is_new_product: true,
          product_sku: "", barcode: "",
          new_product_name: updated[index].buyer_description || "",
          new_product_sku: "",
        };
      } else {
        updated[index] = {
          ...updated[index],
          is_new_product: false,
          new_product_name: "", new_product_sku: "",
        };
      }
      return { ...prev, [poId]: updated };
    });
  };

  // ⚠️ NEW — creates a real product_collection entry via POST
  // /api/products/add for one draft row, then returns the barcode so the
  // PO item payload can use it. Uses the row's rate for
  // cost_price/mrp/selling_price alike, since the vendor is only asked
  // for one rate at creation time, not three. Starting stock is
  // deliberately 0 — see the fix note directly on createProductForRow
  // below for why.
  // ⚠️ FIXED: this previously sent quantity: row.quantity (the PO's
  // ordered amount) as the new product's starting stock. That's wrong —
  // it recorded stock the moment the PO item was saved, before anything
  // was physically received. The only real stock-movement path in this
  // whole system is grn_routes.py's update_inventory(), triggered by an
  // actual GRN posting after physical receipt (confirmed: neither this
  // route nor PO submission touch inventory_collection/product_collection
  // stock anywhere). If this product later goes through a real GRN,
  // sync_product_stock_from_grn's logic is `new_qty = current_qty +
  // inward_qty` — meaning a non-zero starting quantity here would get
  // double-counted once GRN posts the same units for real. New products
  // now start at 0, exactly like a product an admin adds manually with
  // no stock yet — consistent with the existing-product path, which
  // never touches "current stock" at PO-creation time either.
  const createProductForRow = async (row) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("product_name", row.new_product_name.trim());
    fd.append("cost_price", String(row.rate || 0));
    fd.append("mrp", String(row.rate || 0));
    fd.append("selling_price", String(row.rate || 0));
    fd.append("quantity", "0");
    if (row.new_product_sku && row.new_product_sku.trim()) {
      fd.append("barcode_override", row.new_product_sku.trim());
    }
    const res = await axios.post(`${APP_API_URL}/api/products/add`, fd, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
    });
    return res.data; // { message, sku, barcode }
  };

  const saveItemsToPO = async (poId) => {
    const items = itemsDraft[poId] || [];
    if (items.length === 0) return alert("Add at least one item first.");

    const newProductRows = items.filter(it => it.is_new_product);
    for (const row of newProductRows) {
      if (!row.new_product_name || !row.new_product_name.trim()) {
        return alert("Every new product needs a name before saving.");
      }
    }

    setSaving(true);
    try {
      // ⚠️ NEW — create any new products FIRST, sequentially (each needs
      // its own vendor_tenant_id resolution and barcode uniqueness check
      // server-side; doing this in parallel risked two rows racing on the
      // same auto-generated SKU suffix). Build the final payload only
      // after every new product has a real barcode.
      const resolvedItems = [];
      for (const it of items) {
        if (it.is_new_product) {
          const created = await createProductForRow(it);
          resolvedItems.push({
            product_sku: created.sku || "",
            barcode:     created.barcode || "",
            description: it.description || it.new_product_name,
            quantity:    Number(it.quantity) || 0,
            rate:        Number(it.rate) || 0,
          });
        } else {
          resolvedItems.push({
            product_sku: it.product_sku || "",
            barcode:     it.barcode     || "",
            description: it.description || "",
            quantity:    Number(it.quantity) || 0,
            rate:        Number(it.rate)     || 0,
          });
        }
      }

      const token = getToken();
      const res = await axios.post(
        `${APP_API_URL}/purchaseorders/${poId}/items`,
        { items: resolvedItems },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || "Items saved successfully!");
      if (newProductRows.length > 0) await refreshFlatItems();
      await refreshOrders();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save items");
    } finally {
      setSaving(false);
    }
  };

  const submitPO = async (poId) => {
    if (!window.confirm("Submit this PO for buyer approval?")) return;
    try {
      const token = getToken();
      const res = await axios.post(
        `${APP_API_URL}/purchaseorders/${poId}/submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || "PO submitted successfully!");
      await refreshOrders();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.action_required === "buyer_override") {
        const blocked = detail.blocked_items || [];
        const lines   = blocked.map(it =>
          `• ${it.description || it.barcode}: PO rate ₹${it.buyer_rate} → Your rate ₹${it.vendor_rate} (${it.variance_pct > 0 ? "+" : ""}${it.variance_pct}%)`
        );
        alert(
          `❌ Submission blocked — price variance > 10% on ${blocked.length} item(s):\n\n` +
          lines.join("\n") +
          `\n\n📋 Tell the buyer to click "Override Price" on PO ${orders.find(o => o._id === poId || o.id === poId)?.orderNo || poId}.\n\nOnce overridden, come back and click Submit PO again.`
        );
      } else {
        alert(typeof detail === "string" ? detail : "Failed to submit PO");
      }
    }
  };

  const totalPOs   = orders.length;
  const pendingPOs = orders.filter(o => o.status === "SentToVendor" || o.status === "WalkinAccepted").length;
  const submitted  = orders.filter(o => o.status === "VendorSubmitted").length;
  const totalItems = orders.reduce((s, o) => s + (o.items?.length || 0), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #F8FAFD 0%, #FFF4ED 50%, #F5F3FF 100%)",
        padding: "32px 24px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: `linear-gradient(135deg, ${T.orange}, ${T.coral})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 6px 20px ${T.orange}44`,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <div>
                <h1 style={{
                  margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.15,
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  background: `linear-gradient(120deg, ${T.navy}, ${T.orange})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  Purchase Orders
                </h1>
                {vendorName && (
                  <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
                    Vendor: <strong style={{ color: T.label }}>{vendorName}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {!loading && orders.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
              <StatCard label="Total POs"   value={totalPOs}   accent={T.orange}  />
              <StatCard label="Awaiting Me" value={pendingPOs} accent={T.sky}     />
              <StatCard label="Submitted"   value={submitted}  accent={T.violet}  />
              <StatCard label="Total Items" value={totalItems} accent={T.emerald} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 64 }}>
              <div style={{
                width: 40, height: 40, border: `3px solid ${T.border}`,
                borderTop: `3px solid ${T.orange}`, borderRadius: "50%",
                margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: T.muted, fontSize: 14 }}>Loading purchase orders…</p>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 18 }}>
              <EmptyState />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {orders.map((po) => {
                const poKey = po._id || po.id;
                return (
                  <POCard
                    key={poKey}
                    po={{ ...po, _id: poKey }}
                    flatItems={flatItems}
                    expanded={expanded === poKey}
                    onToggle={() => toggleExpand(poKey)}
                    itemsDraft={itemsDraft}
                    onAddItem={() => addNewItem(poKey)}
                    onItemChange={(idx, field, val) => handleItemChange(poKey, idx, field, val)}
                    onProductSelect={(idx, sku) => handleProductSelect(poKey, idx, sku)}
                    onToggleNewProduct={(idx, isNew) => handleToggleNewProduct(poKey, idx, isNew)}
                    onSave={() => saveItemsToPO(poKey)}
                    onSubmit={() => submitPO(poKey)}
                    onPreFill={(id, items) => preFillDraft(id, items)}
                    saving={saving}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
