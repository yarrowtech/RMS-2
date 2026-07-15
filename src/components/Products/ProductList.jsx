import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = `${APP_API_URL}`;

// ─── Helpers ───
const fmt = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "—" : `₹${num.toFixed(2)}`;
};
const calcMargin = (cp, sp) => {
  const c = parseFloat(cp), s = parseFloat(sp);
  if (!c || !s || c <= 0) return null;
  return (((s - c) / c) * 100).toFixed(1);
};

// ─────────────────────────────────────────
// CSS
// ─────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --amber:     #f59e0b;
    --amber-lt:  #fcd34d;
    --amber-dk:  #d97706;
    --orange:    #f97316;
    --orange-dk: #ea580c;
    --warm-50:   #fff7ed;
    --warm-100:  #ffedd5;
    --warm-200:  #fed7aa;
    --warm-300:  #fdba74;
    --stone-50:  #fafaf9;
    --stone-100: #f5f5f4;
    --stone-200: #e7e5e4;
    --stone-300: #d6d3d1;
    --stone-400: #a8a29e;
    --stone-500: #78716c;
    --stone-700: #44403c;
    --stone-900: #1c1917;
    --green-bg:  #ecfdf5;
    --green-bd:  #6ee7b7;
    --green-txt: #065f46;
    --red-bg:    #fef2f2;
    --red-bd:    #fca5a5;
    --red-txt:   #991b1b;
    --vio-bg:    #f5f3ff;
    --vio-bd:    #c4b5fd;
    --vio-txt:   #4c1d95;
    --blue-bg:   #eff6ff;
    --blue-bd:   #93c5fd;
    --blue-txt:  #1e40af;
    --white:     #ffffff;
    --sans: 'Sora', sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --r: 10px; --R: 16px; --xl: 20px;
  }

  /* ── Page ── */
  .pl-root {
    min-height: 100vh; font-family: var(--sans); color: var(--stone-900);
    padding: 36px 24px 80px;
    background: var(--warm-50);
    background-image:
      radial-gradient(ellipse 70% 40% at 20% 0%, rgba(251,191,36,0.15) 0%, transparent 55%),
      radial-gradient(ellipse 50% 35% at 85% 100%, rgba(249,115,22,0.10) 0%, transparent 50%);
  }

  /* ── Header ── */
  .pl-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; margin-bottom: 28px;
    background: var(--white); border: 1.5px solid var(--warm-200);
    border-radius: var(--xl); padding: 20px 28px;
    box-shadow: 0 4px 24px rgba(245,158,11,0.09);
  }
  .pl-head-left { display: flex; align-items: center; gap: 14px; }
  .pl-head-icon {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--amber-dk), var(--orange));
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; box-shadow: 0 4px 12px rgba(249,115,22,0.3);
  }
  .pl-head-title { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: var(--stone-900); }
  .pl-head-sub { font-size: 12px; color: var(--stone-400); margin-top: 1px; }
  .pl-add-btn {
    display: flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, var(--amber-dk), var(--orange));
    color: #fff; border: none; border-radius: var(--r);
    padding: 10px 20px; font-family: var(--sans); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 14px rgba(249,115,22,0.28);
  }
  .pl-add-btn:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(249,115,22,0.36); }

  /* ── Search ── */
  .pl-search-wrap {
    margin-bottom: 20px;
    background: var(--white); border: 1.5px solid var(--stone-200);
    border-radius: var(--r); padding: 10px 16px;
    display: flex; align-items: center; gap: 10px;
    max-width: 420px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: border-color 0.18s;
  }
  .pl-search-wrap:focus-within { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
  .pl-search-icon { font-size: 14px; color: var(--stone-400); flex-shrink: 0; }
  .pl-search-wrap input {
    border: none; outline: none; width: 100%; font-family: var(--sans);
    font-size: 13px; color: var(--stone-900); background: transparent;
  }
  .pl-search-wrap input::placeholder { color: var(--stone-300); }

  /* ── Table card ── */
  .pl-table-card {
    background: var(--white); border: 1.5px solid var(--stone-200);
    border-radius: var(--xl); overflow: hidden;
    box-shadow: 0 2px 16px rgba(0,0,0,0.05);
  }
  .pl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .pl-table thead { background: linear-gradient(135deg, var(--amber-dk) 0%, var(--orange) 100%); }
  .pl-table thead th {
    padding: 14px 16px; text-align: left; color: #fff;
    font-weight: 600; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase;
    white-space: nowrap;
  }
  .pl-table thead th:last-child { text-align: center; }
  .pl-table tbody tr { border-bottom: 1px solid var(--stone-100); transition: background 0.15s; }
  .pl-table tbody tr:last-child { border-bottom: none; }
  .pl-table tbody tr:hover { background: var(--warm-50); }
  .pl-table td { padding: 13px 16px; vertical-align: middle; }

  .pl-sku {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    color: var(--amber-dk); background: var(--warm-100);
    border: 1px solid var(--warm-300); border-radius: 5px;
    padding: 3px 8px; white-space: nowrap; display: inline-block;
  }
  .pl-name { font-weight: 600; color: var(--stone-900); }
  .pl-meta { font-size: 11px; color: var(--stone-400); margin-top: 2px; }

  .pl-vtag {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: var(--warm-100); border: 1px solid var(--warm-300); color: var(--amber-dk);
  }
  .pl-vtag-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--orange); }

  .pl-img-stack { display: flex; align-items: center; gap: 6px; }
  .pl-img-thumb {
    width: 38px; height: 38px; border-radius: 8px; object-fit: cover;
    border: 1.5px solid var(--stone-200); box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .pl-img-more {
    width: 38px; height: 38px; border-radius: 8px;
    background: var(--stone-100); border: 1.5px solid var(--stone-200);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 600; color: var(--stone-500);
  }

  .pl-action-btns { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .pl-btn-view {
    background: var(--warm-100); border: 1px solid var(--warm-300);
    color: var(--amber-dk); border-radius: 8px; padding: 6px 12px;
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s; white-space: nowrap;
  }
  .pl-btn-view:hover { background: var(--warm-200); }
  .pl-btn-edit {
    background: var(--blue-bg); border: 1px solid var(--blue-bd);
    color: var(--blue-txt); border-radius: 8px; padding: 6px 12px;
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s;
  }
  .pl-btn-edit:hover { background: #dbeafe; }
  .pl-btn-del {
    background: var(--red-bg); border: 1px solid var(--red-bd);
    color: var(--red-txt); border-radius: 8px; padding: 6px 10px;
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s;
  }
  .pl-btn-del:hover { background: #fee2e2; }

  .pl-empty { padding: 56px 20px; text-align: center; color: var(--stone-400); }
  .pl-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.4; }
  .pl-empty-txt { font-size: 14px; font-weight: 500; }

  /* ── Modal overlay ── */
  .pl-overlay {
    position: fixed; inset: 0; background: rgba(28,25,23,0.55);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; padding: 20px;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  /* ── Modal box ── */
  .pl-modal {
    background: var(--white); border-radius: var(--xl);
    width: 100%; max-width: 780px; max-height: 88vh;
    display: flex; flex-direction: column;
    box-shadow: 0 24px 60px rgba(0,0,0,0.22), 0 0 0 1px rgba(245,158,11,0.1);
    animation: slideUp 0.22s cubic-bezier(0.22,1,0.36,1);
    overflow: hidden;
  }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

  /* Modal header */
  .pl-modal-head {
    padding: 22px 26px 18px;
    border-bottom: 1.5px solid var(--stone-100);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    flex-shrink: 0;
    background: linear-gradient(135deg, var(--warm-50) 0%, var(--white) 100%);
  }
  .pl-modal-head-left { display: flex; flex-direction: column; gap: 6px; }
  .pl-modal-title { font-size: 18px; font-weight: 800; color: var(--stone-900); letter-spacing: -0.3px; }
  .pl-modal-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .pl-modal-sku {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    color: var(--amber-dk); background: var(--warm-100);
    border: 1px solid var(--warm-300); border-radius: 5px; padding: 3px 9px;
  }
  .pl-modal-barcode {
    font-family: var(--mono); font-size: 11px; color: var(--stone-500);
    background: var(--stone-100); border: 1px solid var(--stone-200);
    border-radius: 5px; padding: 3px 9px;
  }
  .pl-close-btn {
    background: var(--stone-100); border: 1px solid var(--stone-200);
    color: var(--stone-500); border-radius: 8px; padding: 6px 10px;
    font-size: 14px; cursor: pointer; transition: all 0.15s; flex-shrink: 0;
    font-family: var(--sans);
  }
  .pl-close-btn:hover { background: var(--red-bg); border-color: var(--red-bd); color: var(--red-txt); }

  /* Modal body — scrollable */
  .pl-modal-body {
    padding: 22px 26px; overflow-y: auto; flex: 1;
  }
  .pl-modal-body::-webkit-scrollbar { width: 5px; }
  .pl-modal-body::-webkit-scrollbar-track { background: transparent; }
  .pl-modal-body::-webkit-scrollbar-thumb { background: var(--warm-200); border-radius: 3px; }

  /* Info grid */
  .pl-info-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin-bottom: 20px;
  }
  @media(max-width:560px){ .pl-info-grid{grid-template-columns:1fr 1fr} }
  .pl-info-cell {
    background: var(--stone-50); border: 1px solid var(--stone-200);
    border-radius: var(--r); padding: 10px 13px;
  }
  .pl-info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--stone-400); margin-bottom: 4px; }
  .pl-info-val { font-size: 13px; font-weight: 600; color: var(--stone-900); }

  /* Simple product pricing row */
  .pl-price-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin-bottom: 20px;
  }
  @media(max-width:480px){ .pl-price-row{grid-template-columns:1fr 1fr} }
  .pl-price-card { border-radius: var(--r); padding: 12px 14px; }
  .pl-price-card.cp  { background: var(--stone-50); border: 1px solid var(--stone-200); }
  .pl-price-card.mrp { background: var(--vio-bg);   border: 1px solid var(--vio-bd); }
  .pl-price-card.sp  { background: var(--green-bg); border: 1px solid var(--green-bd); }
  .pl-price-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .pl-price-card.cp  .pl-price-label { color: var(--stone-500); }
  .pl-price-card.mrp .pl-price-label { color: var(--vio-txt); }
  .pl-price-card.sp  .pl-price-label { color: var(--green-txt); }
  .pl-price-val { font-family: var(--mono); font-size: 15px; font-weight: 700; }
  .pl-price-card.cp  .pl-price-val { color: var(--stone-700); }
  .pl-price-card.mrp .pl-price-val { color: var(--vio-txt); }
  .pl-price-card.sp  .pl-price-val { color: var(--green-txt); }
  .pl-margin-badge {
    margin-top: 3px; font-size: 10px; font-weight: 600;
    color: var(--green-txt);
  }
  .pl-margin-badge.loss { color: var(--red-txt); }

  /* Inventory strip */
  .pl-inv-strip {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    background: var(--blue-bg); border: 1px solid var(--blue-bd);
    border-radius: var(--r); padding: 10px 14px;
    margin-bottom: 20px; font-size: 13px; color: var(--blue-txt);
  }
  .pl-inv-strip b { font-family: var(--mono); }

  /* Images strip */
  .pl-images-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
  .pl-modal-img {
    width: 72px; height: 72px; object-fit: cover; border-radius: 10px;
    border: 1.5px solid var(--stone-200); box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    cursor: pointer; transition: transform 0.15s;
  }
  .pl-modal-img:hover { transform: scale(1.06); }

  /* Section heading inside modal */
  .pl-msec {
    font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: var(--amber-dk); margin-bottom: 12px; display: block;
  }
  .pl-msec-rule { height: 1.5px; margin: -6px 0 16px; background: linear-gradient(90deg, var(--warm-200), transparent); border-radius: 999px; }

  /* Description / specification */
  .pl-text-block {
    background: var(--stone-50); border: 1px solid var(--stone-200);
    border-radius: var(--r); padding: 12px 14px; font-size: 13px;
    color: var(--stone-700); line-height: 1.6; margin-bottom: 16px;
  }

  /* ── Variants table ── */
  .pl-vtable-wrap {
    border: 1.5px solid var(--stone-200); border-radius: var(--R);
    overflow: hidden; margin-bottom: 8px;
  }
  .pl-vtable { width: 100%; border-collapse: collapse; font-size: 12px; }
  .pl-vtable thead { background: linear-gradient(135deg, var(--amber-dk), var(--orange)); }
  .pl-vtable thead th {
    padding: 10px 12px; text-align: left; color: #fff;
    font-weight: 600; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase;
    white-space: nowrap;
  }
  .pl-vtable tbody tr { border-bottom: 1px solid var(--stone-100); transition: background 0.12s; }
  .pl-vtable tbody tr:last-child { border-bottom: none; }
  .pl-vtable tbody tr:hover { background: var(--warm-50); }
  .pl-vtable td { padding: 10px 12px; vertical-align: middle; }
  .pl-vtable .v-sku {
    font-family: var(--mono); font-size: 10px; font-weight: 500;
    color: var(--amber-dk); background: var(--warm-100);
    border: 1px solid var(--warm-300); border-radius: 4px;
    padding: 2px 7px; white-space: nowrap;
  }
  .pl-vtable .v-barcode {
    font-family: var(--mono); font-size: 10px; color: var(--stone-500);
    background: var(--stone-100); border: 1px solid var(--stone-200);
    border-radius: 4px; padding: 2px 7px; white-space: nowrap;
  }
  .pl-vtable .v-color-dot {
    display: inline-block; width: 16px; height: 16px; border-radius: 4px;
    border: 1.5px solid rgba(0,0,0,0.12); vertical-align: middle; margin-right: 6px;
  }
  .pl-vtable .v-color-hex {
    font-family: var(--mono); font-size: 10px; color: var(--stone-500);
    vertical-align: middle;
  }
  .pl-vtable .v-size-pill {
    background: var(--warm-100); border: 1px solid var(--warm-300);
    color: var(--amber-dk); font-family: var(--mono); font-size: 10px; font-weight: 600;
    padding: 2px 8px; border-radius: 4px;
  }
  .pl-vtable .v-price { font-family: var(--mono); font-size: 11px; font-weight: 500; color: var(--stone-700); }
  .pl-vtable .v-price.sp { color: var(--green-txt); font-weight: 600; }
  .pl-vtable .v-price.loss { color: var(--red-txt); }
  .pl-vtable .v-stock {
    font-family: var(--mono); font-size: 11px; font-weight: 600;
    color: var(--blue-txt); background: var(--blue-bg);
    border: 1px solid var(--blue-bd); border-radius: 4px; padding: 2px 8px;
    display: inline-block;
  }
  .pl-vtable .v-unit { font-size: 10px; color: var(--stone-400); }
  .pl-vtable .v-margin {
    font-size: 10px; font-weight: 600; font-family: var(--mono);
    padding: 2px 7px; border-radius: 4px;
  }
  .pl-vtable .v-margin.ok  { background: var(--green-bg); color: var(--green-txt); border: 1px solid var(--green-bd); }
  .pl-vtable .v-margin.low { background: var(--warm-100); color: var(--amber-dk); border: 1px solid var(--warm-300); }
  .pl-vtable .v-margin.loss{ background: var(--red-bg); color: var(--red-txt); border: 1px solid var(--red-bd); }

  /* variant count badge */
  .pl-vcount {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; color: var(--stone-500);
    margin-bottom: 12px;
  }
  .pl-vcount-num {
    background: var(--warm-100); border: 1px solid var(--warm-300);
    color: var(--amber-dk); font-family: var(--mono); font-size: 11px;
    padding: 1px 8px; border-radius: 999px;
  }

  /* Modal footer */
  .pl-modal-foot {
    padding: 16px 26px; border-top: 1.5px solid var(--stone-100);
    display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0;
    background: var(--stone-50);
  }
  .pl-foot-btn {
    flex: 1; min-width: 120px;
    padding: 10px 18px; border-radius: var(--r); font-family: var(--sans);
    font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.18s;
  }
  .pl-foot-btn.edit {
    background: linear-gradient(135deg, var(--amber-dk), var(--orange));
    color: #fff; box-shadow: 0 3px 12px rgba(249,115,22,0.25);
  }
  .pl-foot-btn.edit:hover { box-shadow: 0 6px 18px rgba(249,115,22,0.35); transform: translateY(-1px); }
  .pl-foot-btn.inv-view {
    background: var(--blue-bg); border: 1px solid var(--blue-bd); color: var(--blue-txt);
  }
  .pl-foot-btn.inv-view:hover { background: #dbeafe; }
  .pl-foot-btn.inv-edit {
    background: var(--green-bg); border: 1px solid var(--green-bd); color: var(--green-txt);
  }
  .pl-foot-btn.inv-edit:hover { background: #d1fae5; }

  /* Image lightbox */
  .pl-lightbox {
    position: fixed; inset: 0; background: rgba(0,0,0,0.82);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; cursor: pointer;
    animation: fadeIn 0.15s ease;
  }
  .pl-lightbox img {
    max-width: 90vw; max-height: 88vh;
    border-radius: var(--R); box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .pl-lightbox-close {
    position: absolute; top: 20px; right: 24px;
    font-size: 28px; color: #fff; cursor: pointer; opacity: 0.7;
    background: none; border: none; font-family: var(--sans);
  }
  .pl-lightbox-close:hover { opacity: 1; }
`;

// ─────────────────────────────────────────
// PriceCard — for simple products
// ─────────────────────────────────────────
function PriceCard({ label, value, type }) {
  return (
    <div className={`pl-price-card ${type}`}>
      <p className="pl-price-label">{label}</p>
      <p className="pl-price-val">{fmt(value)}</p>
    </div>
  );
}

// ─────────────────────────────────────────
// VariantRow — single row in variants table
// ─────────────────────────────────────────
function VariantRow({ v, variantType }) {
  const margin = calcMargin(v.cost_price, v.selling_price);
  const marginClass = margin === null ? "" : parseFloat(margin) < 0 ? "loss" : parseFloat(margin) >= 20 ? "ok" : "low";

  return (
    <tr>
      {/* SKU */}
      <td><span className="v-sku">{v.sku || "—"}</span></td>

      {/* Barcode */}
      <td><span className="v-barcode">{v.barcode || "—"}</span></td>

      {/* Size (size_color only) */}
      {variantType === "size_color" && (
        <td>
          <span className="v-size-pill">{v.size_label || "—"}</span>
          {v.size_value && (
            <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--stone-400)", marginLeft:5 }}>
              ({v.size_value})
            </span>
          )}
        </td>
      )}

      {/* Color */}
      <td>
        <span className="v-color-dot" style={{ backgroundColor: v.color || "transparent" }} />
        <span className="v-color-hex">{v.color || "—"}</span>
      </td>

      {/* Cost Price */}
      <td><span className="v-price">{fmt(v.cost_price)}</span></td>

      {/* MRP */}
      <td><span className="v-price">{fmt(v.mrp)}</span></td>

      {/* Selling Price */}
      <td>
        <span className={`v-price sp${parseFloat(v.selling_price) < parseFloat(v.cost_price) ? " loss" : ""}`}>
          {fmt(v.selling_price)}
        </span>
      </td>

      {/* Margin */}
      <td>
        {margin !== null
          ? <span className={`v-margin ${marginClass}`}>{margin}%</span>
          : <span style={{ color:"var(--stone-300)" }}>—</span>
        }
      </td>

      {/* Stock */}
      <td><span className="v-stock">{v.stock ?? 0}</span></td>

      {/* Unit */}
      <td><span className="v-unit">{v.unit || "pcs"}</span></td>
    </tr>
  );
}

// ─────────────────────────────────────────
// Product Detail Modal
// ─────────────────────────────────────────
function ProductModal({ product, onClose, onEdit, onInvView, onInvEdit }) {
  const [lightbox, setLightbox] = useState(null);

  const sku     = product.sku     || product.base_sku     || "—";
  const barcode = product.barcode || product.base_barcode || "—";
  const images  = product.images  || [];

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="pl-overlay" onClick={handleOverlayClick}>
      <div className="pl-modal">

        {/* Header */}
        <div className="pl-modal-head">
          <div className="pl-modal-head-left">
            <h2 className="pl-modal-title">{product.product_name}</h2>
            <div className="pl-modal-meta">
              <span className="pl-modal-sku">{sku}</span>
              <span className="pl-modal-barcode">🔖 {barcode}</span>
              {product.has_variants && (
                <span style={{
                  background: "var(--warm-100)", border: "1px solid var(--warm-300)",
                  color: "var(--amber-dk)", borderRadius: 999, padding: "2px 10px",
                  fontSize: 10, fontWeight: 700
                }}>
                  {product.variant_type === "color" ? "Color Variants" : "Size + Color Variants"}
                </span>
              )}
            </div>
          </div>
          <button className="pl-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="pl-modal-body">

          {/* Identity info */}
          <div className="pl-info-grid">
            {[
              ["Division",   product.division   || "—"],
              ["Section",    product.section    || "—"],
              ["Department", product.department || "—"],
              ["Created",    product.created_at
                ? new Date(product.created_at.$date || product.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
                : "—"
              ],
            ].map(([label, val]) => (
              <div key={label} className="pl-info-cell">
                <p className="pl-info-label">{label}</p>
                <p className="pl-info-val">{val}</p>
              </div>
            ))}
          </div>

          {/* ── Simple product pricing ── */}
          {!product.has_variants && (
            <>
              <span className="pl-msec">Pricing</span>
              <div className="pl-msec-rule" />
              <div className="pl-price-row">
                <PriceCard label="Cost Price"    value={product.cost_price}    type="cp"  />
                <PriceCard label="MRP"           value={product.mrp}           type="mrp" />
                <PriceCard label="Selling Price" value={product.selling_price} type="sp"  />
              </div>

              {/* Margin badge */}
              {(() => {
                const m = calcMargin(product.cost_price, product.selling_price);
                if (m === null) return null;
                const isLoss = parseFloat(m) < 0;
                return (
                  <div style={{
                    display:"inline-flex", alignItems:"center", gap:8,
                    background: isLoss ? "var(--red-bg)" : "var(--green-bg)",
                    border: `1px solid ${isLoss ? "var(--red-bd)" : "var(--green-bd)"}`,
                    borderRadius: "var(--r)", padding: "8px 14px", marginBottom: 20,
                    fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600,
                    color: isLoss ? "var(--red-txt)" : "var(--green-txt)"
                  }}>
                    <span style={{ fontSize: 10, opacity: 0.7, textTransform:"uppercase", letterSpacing: "0.8px" }}>Margin</span>
                    <span>{m}%</span>
                    <span style={{
                      fontSize: 10, padding: "1px 7px", borderRadius: 999,
                      background: "rgba(0,0,0,0.05)"
                    }}>
                      {isLoss ? "⚠ Loss" : parseFloat(m) >= 20 ? "✓ Healthy" : "↑ Low"}
                    </span>
                  </div>
                );
              })()}

              {/* Inventory strip */}
              <span className="pl-msec">Inventory</span>
              <div className="pl-msec-rule" />
              <div className="pl-inv-strip" style={{ marginBottom: 20 }}>
                <span>Stock</span>
                <b>{product.quantity ?? 0}</b>
                <span style={{ color:"var(--stone-400)", fontSize:11 }}>·</span>
                <span>Unit</span>
                <b>{product.unit || "pcs"}</b>
              </div>
            </>
          )}

          {/* ── Images ── */}
          {images.length > 0 && (
            <>
              <span className="pl-msec">Images</span>
              <div className="pl-msec-rule" />
              <div className="pl-images-row">
                {images.map((src, i) => (
                  <img key={i} src={src} alt="" className="pl-modal-img"
                    onClick={() => setLightbox(src)} />
                ))}
              </div>
            </>
          )}

          {/* ── Description / Specification ── */}
          {product.description && (
            <>
              <span className="pl-msec">Description</span>
              <div className="pl-msec-rule" />
              <div className="pl-text-block">{product.description}</div>
            </>
          )}
          {product.specification && (
            <>
              <span className="pl-msec">Specification</span>
              <div className="pl-msec-rule" />
              <div className="pl-text-block">{product.specification}</div>
            </>
          )}

          {/* ── Variants table ── */}
          {product.has_variants && (product.variants || []).length > 0 && (
            <>
              <span className="pl-msec">Variants</span>
              <div className="pl-msec-rule" />
              <div className="pl-vcount">
                <span className="pl-vcount-num">{product.variants.length}</span>
                variant{product.variants.length !== 1 ? "s" : ""} total
              </div>

              <div className="pl-vtable-wrap">
                <div style={{ overflowX: "auto" }}>
                  <table className="pl-vtable">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Barcode</th>
                        {product.variant_type === "size_color" && <th>Size</th>}
                        <th>Color</th>
                        <th>Cost (₹)</th>
                        <th>MRP (₹)</th>
                        <th>Selling (₹)</th>
                        <th>Margin</th>
                        <th>Stock</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((v, i) => (
                        <VariantRow key={i} v={v} variantType={product.variant_type} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="pl-modal-foot">
          <button className="pl-foot-btn edit"     onClick={onEdit}>✏ Edit Product</button>
          <button className="pl-foot-btn inv-view" onClick={onInvView}>📦 View Inventory</button>
          <button className="pl-foot-btn inv-edit" onClick={onInvEdit}>⚙ Edit Inventory</button>
        </div>

      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="pl-lightbox" onClick={() => setLightbox(null)}>
          <button className="pl-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Main ProductList
// ─────────────────────────────────────────
export default function ProductList() {
  const [products, setProducts]         = useState([]);
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/products/`);
      setProducts(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = products.filter((p) => {
    const sku     = (p.sku || p.base_sku || "").toLowerCase();
    const barcode = (p.barcode || p.base_barcode || "").toLowerCase();
    const q       = search.toLowerCase();
    return !q
      || p.product_name?.toLowerCase().includes(q)
      || sku.includes(q)
      || barcode.includes(q)
      || p.division?.toLowerCase().includes(q)
      || p.section?.toLowerCase().includes(q);
  });

  const deleteProduct = async (p) => {
    const sku = p.sku || p.base_sku;
    if (!window.confirm(`Delete "${p.product_name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/products/${sku}`);
      fetchProducts();
    } catch { alert("❌ Failed to delete product"); }
  };

  return (
    <>
      <style>{S}</style>
      <div className="pl-root">

        {/* Header */}
        <div className="pl-head">
          <div className="pl-head-left">
            <div className="pl-head-icon">📦</div>
            <div>
              <h1 className="pl-head-title">Product Master</h1>
              <p className="pl-head-sub">{products.length} product{products.length !== 1 ? "s" : ""} total</p>
            </div>
          </div>
          <button className="pl-add-btn" onClick={() => navigate("/products/add")}>
            ＋ Add Product
          </button>
        </div>

        {/* Search */}
        <div className="pl-search-wrap">
          <span className="pl-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, SKU, barcode, division…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--stone-400)", fontSize:14 }}>
              ✕
            </button>
          )}
        </div>

        {/* Table */}
        <div className="pl-table-card">
          <table className="pl-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Division</th>
                <th>Section / Dept</th>
                <th>Variants</th>
                <th>Images</th>
                <th style={{ textAlign:"center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="pl-empty">
                    <div className="pl-empty-icon">⏳</div>
                    <p className="pl-empty-txt">Loading products…</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pl-empty">
                    <div className="pl-empty-icon">📭</div>
                    <p className="pl-empty-txt">{search ? "No results found" : "No products yet"}</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const sku    = p.sku || p.base_sku || "—";
                  const images = p.images || [];

                  return (
                    <tr key={i}>
                      {/* SKU */}
                      <td><span className="pl-sku">{sku}</span></td>

                      {/* Product name */}
                      <td>
                        <p className="pl-name">{p.product_name}</p>
                        {p.description && (
                          <p className="pl-meta" style={{ maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {p.description}
                          </p>
                        )}
                      </td>

                      {/* Division */}
                      <td style={{ color:"var(--stone-700)", fontWeight:500 }}>{p.division || "—"}</td>

                      {/* Section / Dept */}
                      <td>
                        <p style={{ fontWeight:500, color:"var(--stone-700)" }}>{p.section || "—"}</p>
                        {p.department && <p className="pl-meta">{p.department}</p>}
                      </td>

                      {/* Variants */}
                      <td>
                        {p.has_variants ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            <span className="pl-vtag">
                              <span className="pl-vtag-dot" />
                              {p.variant_type === "color" ? "Color" : "Size + Color"}
                            </span>
                            <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--stone-400)" }}>
                              {(p.variants || []).length} variant{(p.variants || []).length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color:"var(--stone-300)", fontSize:12 }}>Simple</span>
                        )}
                      </td>

                      {/* Images */}
                      <td>
                        <div className="pl-img-stack">
                          {images.slice(0, 3).map((src, j) => (
                            <img key={j} src={src} alt="" className="pl-img-thumb" />
                          ))}
                          {images.length > 3 && (
                            <div className="pl-img-more">+{images.length - 3}</div>
                          )}
                          {images.length === 0 && (
                            <span style={{ fontSize:11, color:"var(--stone-300)" }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="pl-action-btns">
                          <button className="pl-btn-view" onClick={() => setSelectedProduct(p)}>
                            👁 View
                          </button>
                          <button className="pl-btn-edit" onClick={() => navigate(`/products/edit/${sku}`)}>
                            ✏ Edit
                          </button>
                          <button className="pl-btn-del" onClick={() => deleteProduct(p)}>
                            🗑
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

        {/* Modal */}
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onEdit={() => {
              navigate(`/products/edit/${selectedProduct.sku || selectedProduct.base_sku}`);
              setSelectedProduct(null);
            }}
            onInvView={() => {
              navigate(`/inventory/view/${selectedProduct.sku || selectedProduct.base_sku}`);
              setSelectedProduct(null);
            }}
            onInvEdit={() => {
              navigate(`/inventory/edit/${selectedProduct.sku || selectedProduct.base_sku}`);
              setSelectedProduct(null);
            }}
          />
        )}

      </div>
    </>
  );
}
