



/**
 * BarcodeStickerPrint.jsx — BOLD READABLE VERSION
 *
 * Bigger fonts, less barcode height, more text space.
 * Label: 38×38mm = 144×144px
 * Roll: 2 labels side by side, page = 79×38mm
 *
 * NOTE: the skipped/overlapping label issue on the GT800 turned out to be
 * a gap-sensor calibration drift on the printer itself, not a CSS page
 * size problem (this is a known issue on this printer family — see Zebra's
 * support docs on "extra blank label" issues). Recalibrate the printer
 * (hold Feed while powering on until the LED finishes its blink sequence)
 * and use the simple, one-physical-row-per-page approach below.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";

function useJsBarcode() {
  const [ready, setReady] = useState(!!window.JsBarcode);
  useEffect(() => {
    if (window.JsBarcode) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

function extractBaseName(raw = "") {
  return (raw.split("|")[0] || raw).trim();
}
function toAging(dateStr = "") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)}`;
}
function formatSize(sz = "") {
  if (!sz) return "";
  if (/^\d+$/.test(String(sz).trim())) return String(sz).trim();
  const map = { small:"S", medium:"M", large:"L", "x-large":"XL", xl:"XL", xxl:"XXL", xs:"XS" };
  return map[sz.toLowerCase()] || String(sz).toUpperCase();
}
function labelFields(item) {
  const skuRaw = (item.sku || "").toUpperCase();
  const sku = skuRaw.replace(/-[0-9A-Fa-f]{6}$/, "").slice(0, 18);
  return {
    bc:       item.barcode || "",
    division: extractBaseName(item.name || item.product || "").toUpperCase().slice(0, 18),
    sku,
    aging:    item.aging || toAging(item.grn_date || ""),
    brand:    (item.brand || item.vendor_name || "").toUpperCase().slice(0, 10),
    category: (item.section || item.department || "").toUpperCase().slice(0, 10),
    mrp:      item.rate || item.mrp || 0,
    size:     formatSize(item.size_label || item.color || ""),
  };
}

// Label: 38×38mm at 96dpi = 144×144px
const LW    = 144;
const LH    = 144;
const GAP   = 11;          // 3mm gap between labels
const ROLL_W = LW + GAP + LW; // 299px ≈ 79mm

/* ── React barcode for preview ───────────────────────────────────── */
function BarcodeImage({ value, height = 36, width = 1.1 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.JsBarcode || !value) return;
    try {
      window.JsBarcode(ref.current, value, {
        format:"CODE128", width, height,
        fontSize:7.5, margin:0, displayValue:true,
        fontOptions:"bold", font:"Arial", textMargin:1,
        lineColor:"#000", background:"#fff",
      });
    } catch { if (ref.current) ref.current.innerHTML = ""; }
  }, [value, height, width]);
  return <svg ref={ref} style={{ width:"100%", height:"auto", display:"block" }} />;
}

/* ── Single label — BOLD CLEAR layout ───────────────────────────── */
function LabelContent({ item, storeName }) {
  const { bc, division, sku, aging, brand, category, mrp, size } = labelFields(item);
  const store = storeName ? storeName.toUpperCase() : "";

  return (
    <div style={{
      width: LW, height: LH,
      display: "flex", flexDirection: "column",
      padding: "3px 5px 3px",
      boxSizing: "border-box",
      background: "#fff",
      fontFamily: "Arial, sans-serif",
      overflow: "hidden",
    }}>

      {/* Store name */}
      {store && (
        <div style={{
          fontSize: 7, fontWeight: 900, textAlign: "center",
          textTransform: "uppercase", letterSpacing: "0.05em",
          borderBottom: "0.8px solid #000",
          paddingBottom: 1, marginBottom: 2, flexShrink: 0,
        }}>
          {store}
        </div>
      )}

      {/* Barcode — smaller height to leave more room for text */}
      <div style={{ flexShrink: 0 }}>
        {bc
          ? <BarcodeImage value={bc} height={36} width={1.1} />
          : <div style={{ height: 36, border: "1px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#aaa" }}>No barcode</div>
        }
      </div>

      {/* Divider */}
      <div style={{ height: "0.8px", background: "#000", margin: "2px 0 2px", flexShrink: 0 }} />

      {/* Division — LARGE BOLD */}
      <div style={{
        fontSize: 11, fontWeight: 900, color: "#000",
        lineHeight: 1.15, letterSpacing: "0.02em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        flexShrink: 0, marginBottom: 1,
      }}>
        {division || "—"}
      </div>

      {/* SKU + Aging — same line, clear font */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        flexShrink: 0, marginBottom: 1, overflow: "hidden",
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 700, color: "#000",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {sku || "—"}
        </span>
        {aging && (
          <span style={{ fontSize: 8.5, fontWeight: 700, color: "#000", flexShrink: 0, marginLeft: 4 }}>
            {aging}
          </span>
        )}
      </div>

      {/* Brand + Category — same line */}
      {(brand || category) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          flexShrink: 0, marginBottom: 2, overflow: "hidden",
        }}>
          <span style={{
            fontSize: 8.5, fontWeight: 700, color: "#000",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}>
            {brand}
          </span>
          {category && (
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "#000",
              flexShrink: 0, marginLeft: 4,
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: "55%",
            }}>
              {category}
            </span>
          )}
        </div>
      )}

      {/* MRP + Size — BIGGEST, most important */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#000", letterSpacing: "-0.02em" }}>
          {mrp > 0 ? `Rs.${Number(mrp).toLocaleString("en-IN")}/--` : ""}
        </span>
        {size && (
          <span style={{ fontSize: 14, fontWeight: 900, color: "#000" }}>
            {size}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Build print HTML ────────────────────────────────────────────── */
function buildPrintHTML(printItems, storeName, jsUrl) {
  function oneLabelHTML(item, svgId) {
    const { bc, division, sku, aging, brand, category, mrp, size } = labelFields(item);
    const store = storeName ? storeName.toUpperCase() : "";

    const storeLine = store
      ? `<div style="font-size:7px;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:0.05em;border-bottom:0.8px solid #000;padding-bottom:1px;margin-bottom:2px;flex-shrink:0;">${store}</div>`
      : "";

    const barcodeEl = bc
      ? `<svg id="${svgId}" data-bc="${bc}" style="width:100%;height:auto;display:block;"></svg>`
      : `<div style="height:36px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:7px;color:#aaa;">No barcode</div>`;

    return `<div style="width:${LW}px;height:${LH}px;display:flex;flex-direction:column;padding:3px 5px 3px;box-sizing:border-box;background:#fff;font-family:Arial,sans-serif;overflow:hidden;">
      ${storeLine}
      <div style="flex-shrink:0;">${barcodeEl}</div>
      <div style="height:0.8px;background:#000;margin:2px 0 2px;flex-shrink:0;"></div>
      <div style="font-size:11px;font-weight:900;color:#000;line-height:1.15;letter-spacing:0.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;margin-bottom:1px;">${division||"—"}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-shrink:0;margin-bottom:1px;overflow:hidden;">
        <span style="font-size:8.5px;font-weight:700;color:#000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${sku||"—"}</span>
        ${aging?`<span style="font-size:8.5px;font-weight:700;color:#000;flex-shrink:0;margin-left:4px;">${aging}</span>`:""}
      </div>
      ${(brand||category)?`<div style="display:flex;justify-content:space-between;align-items:baseline;flex-shrink:0;margin-bottom:2px;overflow:hidden;">
        <span style="font-size:8.5px;font-weight:700;color:#000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${brand}</span>
        ${category?`<span style="font-size:8.5px;font-weight:700;color:#000;flex-shrink:0;margin-left:4px;overflow:hidden;text-overflow:ellipsis;max-width:55%;">${category}</span>`:""}
      </div>`:""}
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-shrink:0;">
        <span style="font-size:13px;font-weight:900;color:#000;letter-spacing:-0.02em;">${mrp>0?`Rs.${Number(mrp).toLocaleString("en-IN")}/--`:""}</span>
        ${size?`<span style="font-size:14px;font-weight:900;color:#000;">${size}</span>`:""}
      </div>
    </div>`;
  }

  // Pair items into label-rows of 2 (left + right column on the roll)
  const rows = [];
  for (let i = 0; i < printItems.length; i += 2) {
    rows.push([printItems[i], printItems[i + 1] || null]);
  }

  const svgMap = [];
  let svgIdx = 0;

  const rowsHTML = rows.map((pair, rowIdx) => {
    const id1 = `bc_${svgIdx++}`;
    const id2 = pair[1] ? `bc_${svgIdx++}` : null;
    svgMap.push({ id: id1, bc: pair[0].barcode || "" });
    if (pair[1]) svgMap.push({ id: id2, bc: pair[1].barcode || "" });

    // page-break ONLY between rows, NOT after last row — each page is
    // exactly one physical label-row (38mm). Requires the printer's gap
    // sensor to be calibrated to the actual roll; see header note.
    const isLast = rowIdx === rows.length - 1;
    const pb = isLast ? "" : "page-break-after:always;break-after:page;";

    return `<div style="display:flex;flex-direction:row;width:${ROLL_W}px;height:${LH}px;margin:0;padding:0;background:#fff;${pb}">
      ${oneLabelHTML(pair[0], id1)}
      <div style="width:${GAP}px;flex-shrink:0;background:#fff;"></div>
      ${pair[1] ? oneLabelHTML(pair[1], id2) : `<div style="width:${LW}px;height:${LH}px;background:#fff;"></div>`}
    </div>`;
  }).join("\n");

  const barcodeInits = svgMap.map(({ id, bc }) => !bc ? "" :
    `try{var e=document.getElementById("${id}");if(e)JsBarcode(e,"${bc}",{format:"CODE128",width:1.1,height:36,fontSize:7.5,margin:0,displayValue:true,fontOptions:"bold",font:"Arial",textMargin:1,lineColor:"#000",background:"#fff"});}catch(ex){}`
  ).join("\n");

  const rollWmm = Math.round(ROLL_W / 96 * 25.4); // 79mm
  const rollHmm = Math.round(LH / 96 * 25.4);     // 38mm
  const totalH  = rows.length * LH;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Labels</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  @page { size:${rollWmm}mm ${rollHmm}mm; margin:0; }
  html, body {
    margin:0 !important; padding:0 !important;
    background:#fff;
    width:${ROLL_W}px;
    height:${totalH}px;
    max-height:${totalH}px;
    overflow:hidden;
  }
</style>
</head>
<body>
${rowsHTML}
<script src="${jsUrl}"><\/script>
<script>
window.onload = function() {
  ${barcodeInits}
  setTimeout(function(){ window.print(); }, 800);
};
<\/script>
</body>
</html>`;
}

/* ── Main component ───────────────────────────────────────────────── */
export default function BarcodeStickerPrint({ items = [], onClose, storeName = "" }) {
  useJsBarcode();
  const [copies,  setCopies]  = useState(1);
  const [stName,  setStName]  = useState(storeName);
  const [showAll, setShowAll] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t   = setTimeout(() => setVisible(true), 10);
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  const printItems = [];
  for (const item of items) {
    for (let i = 0; i < copies; i++) printItems.push(item);
  }

  const totalRows = Math.ceil(printItems.length / 2);
  const preview   = showAll ? printItems : printItems.slice(0, 8);

  const handlePrint = useCallback(() => {
    const jsUrl = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js";
    const html  = buildPrintHTML(printItems, stName, jsUrl);
    const win   = window.open("", "_blank", "width=500,height=400");
    if (!win) { alert("Pop-up blocked — allow pop-ups for this site."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }, [printItems, stName]);

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:99998, background:"rgba(10,14,22,0.7)", backdropFilter:"blur(6px)", transition:"opacity .2s", opacity:visible?1:0 }} />
      <div onClick={e=>e.stopPropagation()} style={{
        position:"fixed", top:"50%", left:"50%",
        transform:visible?"translate(-50%,-50%) scale(1)":"translate(-50%,-48%) scale(0.96)",
        zIndex:99999, width:"calc(100vw - 32px)", maxWidth:860, maxHeight:"92vh",
        display:"flex", flexDirection:"column", borderRadius:18, background:"#fff",
        border:"1px solid #E4EAF3", boxShadow:"0 32px 80px rgba(10,14,22,0.3)",
        overflow:"hidden", transition:"transform .28s cubic-bezier(.16,1,.3,1), opacity .22s",
        opacity:visible?1:0,
      }}>

        {/* Header */}
        <div style={{ flexShrink:0, padding:"16px 22px 12px", background:"linear-gradient(135deg,#0F1B2D,#1A2D47)", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"#F59E0B22", border:"1px solid #F59E0B44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏷️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>Print Labels</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:1 }}>
              {items.length} item{items.length!==1?"s":""} · {printItems.length} label{printItems.length!==1?"s":""} · {totalRows} row{totalRows!==1?"s":""} on roll
            </div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#94A3B8", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Controls */}
        <div style={{ flexShrink:0, padding:"14px 22px", borderBottom:"1px solid #F1F5F9", background:"#F8FAFD", display:"flex", flexWrap:"wrap", gap:14, alignItems:"flex-end" }}>
          <div>
            <label style={{ display:"block", fontSize:9, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Copies per Item</label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => setCopies(c=>Math.max(1,c-1))} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #E4EAF3", background:"#fff", cursor:"pointer", fontSize:20, fontWeight:700, color:"#475569", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
              <span style={{ fontSize:22, fontWeight:800, color:"#0F1B2D", minWidth:36, textAlign:"center" }}>{copies}</span>
              <button onClick={() => setCopies(c=>Math.min(50,c+1))} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #E4EAF3", background:"#fff", cursor:"pointer", fontSize:20, fontWeight:700, color:"#475569", display:"flex", alignItems:"center", justifyContent:"center" }}>＋</button>
            </div>
          </div>

          <div style={{ flex:1, minWidth:140 }}>
            <label style={{ display:"block", fontSize:9, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Store Name (optional)</label>
            <input value={stName} onChange={e=>setStName(e.target.value)} placeholder="e.g. New Market Store"
              style={{ width:"100%", padding:"7px 12px", borderRadius:8, border:"1.5px solid #E4EAF3", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>

          <button onClick={handlePrint} style={{
            padding:"10px 28px", borderRadius:10, border:"none",
            background:"linear-gradient(135deg,#D97706,#B45309)",
            color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer",
            boxShadow:"0 4px 14px rgba(217,119,6,0.4)",
            display:"flex", alignItems:"center", gap:8, flexShrink:0,
          }}>
            🖨️ Print
          </button>
        </div>

        {/* Tip */}
        <div style={{ flexShrink:0, padding:"8px 22px", background:"#FFFBEB", borderBottom:"1px solid #FDE68A", fontSize:11, color:"#92400E", fontWeight:600 }}>
          💡 Print dialog → Printer: <strong>ZDesigner GT800 (EPL)</strong> · Paper: <strong>79×38mm</strong> · Margins: <strong>None</strong> · Scale: <strong>100%</strong>
        </div>

        {/* Preview */}
        <div style={{ flex:1, overflowY:"auto", minHeight:0, padding:"16px 22px", background:"#F1F5F9" }}>
          <div style={{ marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#64748B" }}>
              Preview — {preview.length} of {printItems.length} label{printItems.length!==1?"s":""}
            </span>
            {printItems.length > preview.length && (
              <button onClick={() => setShowAll(v=>!v)} style={{ fontSize:11, fontWeight:700, color:"#6366F1", background:"none", border:"none", cursor:"pointer" }}>
                {showAll?"Show less":`Show all ${printItems.length}`}
              </button>
            )}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Array.from({ length: Math.ceil(preview.length / 2) }).map((_, rowIdx) => (
              <div key={rowIdx} style={{ display:"flex", gap:GAP, background:"#e5e7eb", padding:8, borderRadius:10, border:"1px solid #d1d5db", width:"fit-content" }}>
                {[0,1].map(col => {
                  const item = preview[rowIdx * 2 + col];
                  return item
                    ? <div key={col} style={{ border:"1px solid #9ca3af", borderRadius:3, overflow:"hidden", background:"#fff" }}>
                        <LabelContent item={item} storeName={stName} />
                      </div>
                    : <div key={col} style={{ width:LW, height:LH, background:"#f3f4f6", border:"1px dashed #d1d5db", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:10, color:"#9ca3af" }}>blank</span>
                      </div>;
                })}
              </div>
            ))}
          </div>

          <div style={{ marginTop:12, fontSize:10, color:"#94A3B8", textAlign:"center" }}>
            2 labels per row on roll. Odd copies = right column blank on last row.
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}








