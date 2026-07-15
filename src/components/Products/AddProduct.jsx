import { API_BASE_URL as APP_API_URL } from "../../config/api.js";


import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE = `${APP_API_URL}`;
const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL"];
const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces" },
  { value: "set", label: "Set"    },
  { value: "kg",  label: "Kg"     },
  { value: "g",   label: "Gram"   },
  { value: "ltr", label: "Liter"  },
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
const calcProfit      = (cp, sp) => toNum(sp) - toNum(cp);
const calcMarginPct   = (cp, sp) => { const c=toNum(cp),s=toNum(sp); return c>0&&s>0 ? ((s-c)/c)*100 : null; };
const calcDiscountPct = (mrp, sp) => { const m=toNum(mrp),s=toNum(sp); return m>0&&s>0&&s<m ? ((m-s)/m)*100 : null; };
const calcTotalValue  = (sp, qty) => toNum(sp) * toInt(qty);
const fmt = (n) => (Math.abs(n) < 0.005 ? "0.00" : n.toFixed(2));

// ─── Empty shapes ───
const emptyPricing      = () => ({ cost_price:"", mrp:"", selling_price:"", quantity:"", unit:"pcs" });
const emptyProduct      = () => ({ product_name:"", division:"", section:"", department:"", ...emptyPricing(), description:"", specification:"", has_variants:false, variant_type:"color", variants:[], images:[] });
const emptyColorVariant = (color) => ({ color, ...emptyPricing() });
const emptyColorForSize = (color) => ({ color, ...emptyPricing() });
const emptySizeVariant  = (size)  => ({ size, custom_size:"", colors:[] });

// ─────────────────────────────────────────
// CSS — Warm amber / orange theme
// ─────────────────────────────────────────
const S = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    /* Amber / orange core */
    --amber:     #b713f8;
    --amber-lt:  #b69bff;
    --amber-dk:  #a318ff;
    --orange:    #f97316;
    --orange-dk: #ea580c;
    --peach:     #fed7aa;
    --cream:     rgb(230, 170, 253);
    --warm-50:   #fff7ed;
    --warm-100:  #ffedd5;
    --warm-200:  #fed7aa;
    --warm-300:  #fdba74;

    /* Neutrals — warm-tinted */
    --stone-50:  #fafaf9;
    --stone-100: #f5f5f4;
    --stone-200: #e7e5e4;
    --stone-300: #d6d3d1;
    --stone-500: #78716c;
    --stone-700: #44403c;
    --stone-900: #1c1917;

    /* Semantic */
    --green:    #059669;
    --green-bg: #ecfdf5;
    --green-bd: #6ee7b7;
    --green-txt:#065f46;
    --red:      #dc2626;
    --red-bg:   #fef2f2;
    --red-bd:   #fca5a5;
    --red-txt:  #991b1b;
    --vio:      #7c3aed;
    --vio-bg:   #f5f3ff;
    --vio-bd:   #c4b5fd;
    --vio-txt:  #4c1d95;

    --white: #ffffff;
    --dark:  #1c1917;

    --sans: 'Sora', sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --r:  10px;
    --R:  16px;
    --xl: 20px;
  }

  /* ── Root ── */
  .ap-root {
    min-height: 100vh;
    font-family: var(--sans);
    color: var(--stone-900);
    padding: 36px 20px 120px;
    background: var(--warm-50);
    background-image:
      radial-gradient(ellipse 70% 40% at 20% 0%, rgba(251,191,36,0.18) 0%, transparent 55%),
      radial-gradient(ellipse 50% 35% at 85% 100%, rgba(249,115,22,0.12) 0%, transparent 50%);
  }
  .ap-wrap { max-width: 880px; margin: 0 auto; }

  /* ── Header ── */
  .ap-head {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    margin-bottom: 28px;
    background: var(--white);
    border: 1.5px solid var(--warm-200);
    border-radius: var(--xl);
    padding: 22px 32px;
    box-shadow: 0 4px 24px rgba(245,158,11,0.10), 0 1px 4px rgba(0,0,0,0.04);
  }
  .ap-title {
    font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: var(--dark);
  }
  .ap-title span {
    background: linear-gradient(95deg, var(--amber-dk) 0%, var(--orange) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .ap-badge {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    color: var(--orange-dk);
    background: var(--warm-100);
    border: 1.5px solid var(--warm-300);
    border-radius: 999px; padding: 5px 16px;
    letter-spacing: 0.8px;
  }

  /* ── Product card ── */
  .ap-card {
    background: var(--white);
    border: 1.5px solid var(--stone-200);
    border-radius: var(--xl);
    padding: 30px 32px;
    margin-bottom: 20px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(245,158,11,0.04);
    animation: rise 0.4s cubic-bezier(0.22,1,0.36,1) both;
    position: relative;
    overflow: hidden;
  }
  /* warm top stripe */
  .ap-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--amber) 0%, var(--orange) 60%, transparent 100%);
  }
  @keyframes rise { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

  /* ── Card header ── */
  .ap-card-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 26px; gap: 12px;
  }
  .ap-card-meta { display: flex; align-items: center; gap: 14px; }
  .ap-card-num {
    width: 34px; height: 34px; border-radius: 10px;
    background: var(--warm-100);
    border: 1.5px solid var(--warm-300);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    color: var(--amber-dk); flex-shrink: 0;
  }
  .ap-card-name { font-size: 15px; font-weight: 600; color: var(--stone-900); }
  .ap-del {
    background: var(--red-bg); border: 1px solid var(--red-bd);
    color: var(--red); border-radius: var(--r);
    padding: 6px 15px; font-size: 12px; font-weight: 500;
    cursor: pointer; font-family: var(--sans); transition: all 0.18s;
  }
  .ap-del:hover { background: #fee2e2; border-color: #f87171; }

  /* ── Section label — plain styled text, no bar ── */
  .ap-sec {
    font-size: 10px; font-weight: 700;
    letter-spacing: 2.5px; text-transform: uppercase;
    color: var(--amber-dk);
    margin: 0 0 16px;
    display: block;
  }
  /* thin warm rule beneath */
  .ap-sec-rule {
    height: 1.5px;
    margin: -10px 0 18px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--warm-200), transparent);
  }

  /* ── Fields ── */
  .ap-fg { margin-bottom: 16px; }
  .ap-lbl {
    display: block; font-size: 11px; font-weight: 600;
    color: var(--stone-500); text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 7px;
  }

  /* Main inputs */
  .ap-in {
    width: 100%;
    background: var(--stone-50);
    border: 1.5px solid var(--stone-200);
    border-radius: var(--r);
    padding: 11px 14px;
    font-family: var(--sans); font-size: 14px; font-weight: 400;
    color: var(--stone-900);
    outline: none; transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
    appearance: none; -webkit-appearance: none;
  }
  .ap-in::placeholder { color: var(--stone-300); }
  .ap-in:hover:not(:focus) { border-color: var(--stone-300); background: var(--white); }
  .ap-in:focus {
    border-color: var(--amber);
    background: var(--white);
    box-shadow: 0 0 0 3px rgba(245,158,11,0.14);
  }
  select.ap-in {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23d97706' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 13px center;
    padding-right: 36px; cursor: pointer;
  }
  select.ap-in option { background: #fff; color: var(--stone-900); }
  textarea.ap-in { resize: vertical; line-height: 1.65; }
  .ap-mono { font-family: var(--mono) !important; font-size: 13px !important; }

  /* Small variant inputs */
  .ap-vin {
    width: 100%;
    background: var(--stone-50);
    border: 1.5px solid var(--stone-200);
    border-radius: 8px;
    padding: 9px 11px;
    font-family: var(--sans); font-size: 13px; font-weight: 400;
    color: var(--stone-900);
    outline: none; transition: border-color 0.18s, box-shadow 0.18s;
    appearance: none; -webkit-appearance: none;
  }
  .ap-vin:focus { border-color: var(--amber); box-shadow: 0 0 0 2px rgba(245,158,11,0.12); }
  .ap-vin::placeholder { color: var(--stone-300); }
  select.ap-vin {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23d97706' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 26px; cursor: pointer;
  }
  select.ap-vin option { background: #fff; }

  /* Grids */
  .g3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .g2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
  @media(max-width:680px){ .g3{grid-template-columns:1fr 1fr} }
  @media(max-width:440px){ .g3,.g2{grid-template-columns:1fr} }

  /* Divider */
  .ap-div {
    height: 1px; margin: 24px 0;
    background: var(--stone-100);
  }

  /* ── Calc panel ── */
  .ap-calc {
    margin-top: 10px; margin-bottom: 12px; padding: 11px 15px;
    border-radius: var(--r);
    background: var(--green-bg);
    border: 1px solid var(--green-bd);
    display: flex; flex-wrap: wrap; align-items: center;
    gap: 6px 14px; font-family: var(--mono); font-size: 12px;
    color: var(--green-txt);
  }
  .ap-calc.loss {
    background: var(--red-bg); border-color: var(--red-bd); color: var(--red-txt);
  }
  .ap-calc-item { display: flex; align-items: center; gap: 5px; }
  .ap-calc-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; opacity: 0.65; }
  .ap-calc-val   { font-size: 13px; font-weight: 600; }
  .ap-calc-sep   { color: var(--green-bd); font-size: 12px; }
  .ap-calc.loss .ap-calc-sep { color: var(--red-bd); }
  .ap-calc-badge {
    font-size: 10px; font-weight: 600; padding: 2px 9px; border-radius: 999px;
    background: rgba(0,0,0,0.05);
  }

  /* ── Variant toggle row ── */
  .ap-tog-row { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .ap-tog-lbl {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
    font-size: 14px; font-weight: 500; color: var(--stone-900); user-select: none;
  }
  .ap-chk {
    width: 17px; height: 17px;
    accent-color: var(--amber-dk);
    cursor: pointer;
  }

  /* Variant type selector */
  .ap-vsel {
    background: var(--warm-50);
    border: 1.5px solid var(--warm-300);
    border-radius: var(--r); padding: 7px 30px 7px 12px;
    font-family: var(--sans); font-size: 13px; font-weight: 500;
    color: var(--amber-dk); outline: none; cursor: pointer; transition: all 0.18s;
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23d97706' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .ap-vsel:focus { box-shadow: 0 0 0 3px rgba(245,158,11,0.15); border-color: var(--amber); }
  .ap-vsel option { background: #fff; color: var(--stone-900); }

  /* ── Color grids ── */
  .ap-cgrid {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 14px;
    background: var(--stone-50); border: 1.5px solid var(--stone-200);
    border-radius: var(--R); max-height: 160px; overflow-y: auto;
  }
  .ap-cgrid-sm {
    display: flex; flex-wrap: wrap; gap: 4px; padding: 10px;
    background: var(--stone-50); border: 1.5px solid var(--stone-200);
    border-radius: var(--r); max-height: 98px; overflow-y: auto;
  }
  .ap-sw {
    width: 20px; height: 20px; border-radius: 5px; cursor: pointer;
    border: 2px solid transparent; padding: 0; flex-shrink: 0;
    transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .ap-sw:hover  { transform: scale(1.3); position: relative; z-index: 2; }
  .ap-sw.on     { border-color: var(--stone-900); transform: scale(1.24); box-shadow: 0 0 0 2px rgba(0,0,0,0.15); position: relative; z-index: 2; }
  .ap-sw-sm     { width: 16px; height: 16px; border-radius: 4px; cursor: pointer; border: 2px solid transparent; padding: 0; flex-shrink: 0; transition: transform 0.12s, border-color 0.12s; }
  .ap-sw-sm:hover{ transform: scale(1.22); }
  .ap-sw-sm.on  { border-color: var(--stone-900); transform: scale(1.18); box-shadow: 0 0 0 2px rgba(0,0,0,0.12); }

  /* ── Color-only variant card ── */
  .ap-vcard {
    background: var(--warm-50);
    border: 1.5px solid var(--warm-200);
    border-radius: var(--R); padding: 18px 20px; margin-bottom: 12px;
  }
  .ap-vcard-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .ap-vcard-dot  { width: 22px; height: 22px; border-radius: 6px; border: 2px solid rgba(0,0,0,0.08); flex-shrink: 0; }
  .ap-vcard-name { font-size: 12px; font-weight: 500; color: var(--stone-500); font-family: var(--mono); }
  .ap-price-row  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .ap-inv-row    { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .ap-stat-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media(max-width:560px){ .ap-price-row{grid-template-columns:1fr 1fr} }

  /* ── Stat mini cards ── */
  .ap-stat { border-radius: var(--r); padding: 10px 14px; }
  .ap-stat-em  { background: var(--green-bg); border: 1px solid var(--green-bd); }
  .ap-stat-vio { background: var(--vio-bg);   border: 1px solid var(--vio-bd);   }
  .ap-stat-red { background: var(--red-bg);   border: 1px solid var(--red-bd);   }
  .ap-stat-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .ap-stat-em  .ap-stat-title { color: var(--green-txt); }
  .ap-stat-vio .ap-stat-title { color: var(--vio-txt);   }
  .ap-stat-red .ap-stat-title { color: var(--red-txt);   }
  .ap-stat-val { font-family: var(--mono); font-size: 14px; font-weight: 600; }
  .ap-stat-em  .ap-stat-val { color: var(--green-txt); }
  .ap-stat-vio .ap-stat-val { color: var(--vio-txt);   }
  .ap-stat-red .ap-stat-val { color: var(--red-txt);   }

  /* ── Size buttons ── */
  .ap-sz-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .ap-szbtn {
    border: 1.5px solid var(--stone-200); border-radius: 8px; padding: 7px 18px;
    cursor: pointer; font-family: var(--mono); font-size: 13px; font-weight: 500;
    color: var(--stone-500); background: var(--white); transition: all 0.15s;
  }
  .ap-szbtn:hover { border-color: var(--amber); color: var(--amber-dk); background: var(--warm-50); }
  .ap-szbtn.on {
    background: var(--warm-100); border-color: var(--amber-dk);
    color: var(--amber-dk); font-weight: 700;
    box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
  }

  /* ── Expanded size block ── */
  .ap-szexpand {
    background: var(--warm-50); border: 1.5px solid var(--warm-200);
    border-radius: var(--R); padding: 20px 22px; margin-bottom: 14px;
  }
  .ap-szexpand-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
  }
  .ap-szexpand-meta { display: flex; align-items: center; gap: 10px; }
  .ap-sz-pill {
    background: var(--warm-100); border: 1.5px solid var(--warm-300);
    color: var(--amber-dk); font-family: var(--mono); font-size: 13px; font-weight: 600;
    padding: 4px 14px; border-radius: 8px;
  }
  .ap-sz-count { font-size: 12px; color: var(--stone-500); }
  .ap-sz-remove {
    background: var(--red-bg); border: 1px solid var(--red-bd); color: var(--red);
    border-radius: var(--r); padding: 5px 13px; font-size: 11px; font-weight: 500;
    cursor: pointer; font-family: var(--sans); transition: all 0.18s;
  }
  .ap-sz-remove:hover { background: #fee2e2; }

  /* ── Size+color mini card ── */
  .ap-sccard {
    background: var(--white); border: 1px solid var(--stone-200);
    border-radius: var(--r); padding: 13px 14px;
  }
  .ap-sccard-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .ap-sc-sz {
    background: var(--warm-100); border: 1px solid var(--warm-300);
    font-family: var(--mono); font-size: 10px; font-weight: 600;
    color: var(--amber-dk); padding: 2px 7px; border-radius: 4px;
  }
  .ap-sc-custom {
    background: var(--stone-100); border: 1px solid var(--stone-200);
    font-family: var(--mono); font-size: 10px; color: var(--stone-500);
    padding: 2px 7px; border-radius: 4px;
  }
  .ap-scprice  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .ap-scinv    { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .ap-scstats  { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .ap-sccard .ap-stat { padding: 7px 10px; }
  .ap-sccard .ap-stat-val { font-size: 12px; }
  .ap-scgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  @media(max-width:600px){ .ap-scgrid{grid-template-columns:1fr} }
  @media(max-width:480px){ .ap-scprice{grid-template-columns:1fr 1fr} }

  /* ── Image upload ── */
  .ap-drop {
    border: 2px dashed var(--warm-300); border-radius: var(--R); padding: 28px 20px;
    text-align: center; cursor: pointer; position: relative;
    background: var(--warm-50); transition: all 0.18s; overflow: hidden;
  }
  .ap-drop:hover { border-color: var(--amber); background: var(--warm-100); }
  .ap-drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .ap-drop-icon { font-size: 28px; margin-bottom: 8px; }
  .ap-drop-txt  { font-size: 13px; color: var(--stone-500); }
  .ap-drop-txt strong { color: var(--amber-dk); font-weight: 600; }
  .ap-drop-hint { font-size: 11px; color: var(--stone-300); margin-top: 5px; }
  .ap-fchips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .ap-fchip {
    background: var(--warm-100); border: 1px solid var(--warm-300);
    color: var(--amber-dk); border-radius: 6px;
    padding: 4px 12px; font-size: 11px; font-family: var(--mono); font-weight: 500;
  }

  /* ── Actions ── */
  .ap-actions { display: flex; align-items: center; gap: 14px; margin-top: 28px; flex-wrap: wrap; }
  .ap-add {
    display: flex; align-items: center; gap: 9px;
    background: var(--white); border: 1.5px solid var(--stone-200);
    color: var(--stone-700); border-radius: var(--R); padding: 11px 24px;
    font-family: var(--sans); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
  }
  .ap-add:hover { border-color: var(--amber); color: var(--amber-dk); background: var(--warm-50); }

  .ap-save {
    display: flex; align-items: center; gap: 10px;
    background: linear-gradient(135deg, var(--amber-dk) 0%, var(--orange) 100%);
    border: none; color: #fff; border-radius: var(--R); padding: 12px 36px;
    font-family: var(--sans); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 18px rgba(249,115,22,0.32);
  }
  .ap-save:hover:not(:disabled) {
    background: linear-gradient(135deg, #b45309 0%, var(--orange-dk) 100%);
    transform: translateY(-1px);
    box-shadow: 0 8px 26px rgba(249,115,22,0.4);
  }
  .ap-save:disabled { opacity: 0.45; cursor: not-allowed; }
  .ap-spin {
    width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to{transform:rotate(360deg)} }

  /* scrollbars */
  .ap-cgrid::-webkit-scrollbar, .ap-cgrid-sm::-webkit-scrollbar { width: 4px; }
  .ap-cgrid::-webkit-scrollbar-track, .ap-cgrid-sm::-webkit-scrollbar-track { background: transparent; }
  .ap-cgrid::-webkit-scrollbar-thumb, .ap-cgrid-sm::-webkit-scrollbar-thumb { background: var(--warm-200); border-radius: 2px; }
`;

// ─────────────────────────────────────────
// Section header — plain styled text + thin rule
// ─────────────────────────────────────────
function Sec({ label }) {
  return (
    <>
      <span className="ap-sec">{label}</span>
      <div className="ap-sec-rule" />
    </>
  );
}

// ─────────────────────────────────────────
// CalcPanel
// ─────────────────────────────────────────
function CalcPanel({ cp, mrp, sp, qty, small = false }) {
  const profit   = calcProfit(cp, sp);
  const margin   = calcMarginPct(cp, sp);
  const discount = calcDiscountPct(mrp, sp);
  const total    = qty ? calcTotalValue(sp, qty) : null;

  if (toNum(cp) <= 0 || toNum(sp) <= 0) return null;
  const isLoss = profit < 0;

  return (
    <div className={`ap-calc${isLoss ? " loss" : ""}`}
      style={small ? { fontSize: 11, padding: "8px 12px", marginTop: 8, marginBottom: 8 } : {}}>
      <div className="ap-calc-item">
        <span className="ap-calc-label">Profit</span>
        <span className="ap-calc-val">₹{fmt(profit)}</span>
      </div>
      <span className="ap-calc-sep">·</span>
      {margin !== null && (
        <>
          <div className="ap-calc-item">
            <span className="ap-calc-label">Margin</span>
            <span className="ap-calc-val">{fmt(margin)}%</span>
          </div>
          <span className="ap-calc-badge">
            {isLoss ? "⚠ Loss" : margin >= 20 ? "✓ Healthy" : "↑ Low"}
          </span>
        </>
      )}
      {discount !== null && (
        <>
          <span className="ap-calc-sep">·</span>
          <div className="ap-calc-item">
            <span className="ap-calc-label">Disc off MRP</span>
            <span className="ap-calc-val">{fmt(discount)}%</span>
          </div>
        </>
      )}
      {total !== null && total > 0 && (
        <>
          <span className="ap-calc-sep">·</span>
          <div className="ap-calc-item">
            <span className="ap-calc-label">Stock Value</span>
            <span className="ap-calc-val">₹{fmt(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// StatCards
// ─────────────────────────────────────────
function StatCards({ cp, sp, qty }) {
  const profit = calcProfit(cp, sp);
  const total  = calcTotalValue(sp, qty);
  const isLoss = profit < 0;
  if (toNum(cp) <= 0 || toNum(sp) <= 0) return null;
  return (
    <div className="ap-stat-row">
      <div className={`ap-stat ${isLoss ? "ap-stat-red" : "ap-stat-em"}`}>
        <p className="ap-stat-title">Unit {isLoss ? "Loss" : "Margin"}</p>
        <p className="ap-stat-val">₹{fmt(profit)}</p>
      </div>
      <div className="ap-stat ap-stat-vio">
        <p className="ap-stat-title">Total Value</p>
        <p className="ap-stat-val">₹{fmt(total)}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ColorGrid
// ─────────────────────────────────────────
function ColorGrid({ selected = [], onToggle, compact = false }) {
  const isOn = (c) => selected.some((x) => x.color === c);
  return (
    <div className={compact ? "ap-cgrid-sm" : "ap-cgrid"}>
      {WEB_SAFE_COLORS.map((c) => (
        <button key={c} type="button" title={c}
          className={`${compact ? "ap-sw-sm" : "ap-sw"}${isOn(c) ? " on" : ""}`}
          style={{ backgroundColor: c }}
          onClick={() => onToggle(c)} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Color-only variant card
// ─────────────────────────────────────────
function ColorVariantCard({ variant, onChange }) {
  return (
    <div className="ap-vcard">
      <div className="ap-vcard-head">
        <span className="ap-vcard-dot" style={{ backgroundColor: variant.color }} />
        <span className="ap-vcard-name">{variant.color}</span>
      </div>
      <div className="ap-price-row">
        <div>
          <label className="ap-lbl">Cost Price (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="0.00" value={variant.cost_price} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("cost_price", sanitizeNum(e.target.value, ""))} />
        </div>
        <div>
          <label className="ap-lbl">MRP (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="0.00" value={variant.mrp} onKeyDown={preventInvalidKeys}
            onChange={(e) => {
              const v = sanitizeNum(e.target.value, "");
              onChange("mrp", v);
              if (!variant.selling_price) onChange("selling_price", v);
            }} />
        </div>
        <div>
          <label className="ap-lbl">Selling Price (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="Auto from MRP" value={variant.selling_price} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("selling_price", sanitizeNum(e.target.value, ""))} />
        </div>
      </div>
      <CalcPanel cp={variant.cost_price} mrp={variant.mrp} sp={variant.selling_price} qty={variant.quantity} small />
      <div className="ap-inv-row">
        <div>
          <label className="ap-lbl">Quantity</label>
          <input type="number" min="0" step="1" className="ap-vin ap-mono"
            placeholder="0" value={variant.quantity} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("quantity", sanitizeInt(e.target.value, ""))} />
        </div>
        <div>
          <label className="ap-lbl">Unit</label>
          <select className="ap-vin" value={variant.unit} onChange={(e) => onChange("unit", e.target.value)}>
            {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <StatCards cp={variant.cost_price} sp={variant.selling_price} qty={variant.quantity} />
    </div>
  );
}

// ─────────────────────────────────────────
// Size+Color mini card
// ─────────────────────────────────────────
function SizeColorMiniCard({ size, customSize, colorObj, onChange }) {
  const profit   = calcProfit(colorObj.cost_price, colorObj.selling_price);
  const total    = calcTotalValue(colorObj.selling_price, colorObj.quantity);
  const isLoss   = profit < 0;
  const showStats = toNum(colorObj.cost_price) > 0 && toNum(colorObj.selling_price) > 0;

  return (
    <div className="ap-sccard">
      <div className="ap-sccard-head">
        <span className="ap-sc-sz">{size}</span>
        {customSize && <span className="ap-sc-custom">{customSize}</span>}
        <span style={{ width:13, height:13, borderRadius:3, border:"1.5px solid rgba(0,0,0,0.1)",
          backgroundColor:colorObj.color, display:"inline-block", flexShrink:0 }} />
        <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--stone-500)" }}>
          {colorObj.color}
        </span>
      </div>
      <div className="ap-scprice">
        <div>
          <label className="ap-lbl" style={{ fontSize: 9 }}>Cost (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="0.00" value={colorObj.cost_price} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("cost_price", sanitizeNum(e.target.value, ""))} />
        </div>
        <div>
          <label className="ap-lbl" style={{ fontSize: 9 }}>MRP (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="0.00" value={colorObj.mrp} onKeyDown={preventInvalidKeys}
            onChange={(e) => {
              const v = sanitizeNum(e.target.value, "");
              onChange("mrp", v);
              if (!colorObj.selling_price) onChange("selling_price", v);
            }} />
        </div>
        <div>
          <label className="ap-lbl" style={{ fontSize: 9 }}>Selling (₹)</label>
          <input type="number" min="0" step="0.01" className="ap-vin ap-mono"
            placeholder="Auto" value={colorObj.selling_price} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("selling_price", sanitizeNum(e.target.value, ""))} />
        </div>
      </div>
      <CalcPanel cp={colorObj.cost_price} mrp={colorObj.mrp} sp={colorObj.selling_price} qty={colorObj.quantity} small />
      <div className="ap-scinv">
        <div>
          <label className="ap-lbl" style={{ fontSize: 9 }}>Quantity</label>
          <input type="number" min="0" step="1" className="ap-vin ap-mono"
            placeholder="0" value={colorObj.quantity} onKeyDown={preventInvalidKeys}
            onChange={(e) => onChange("quantity", sanitizeInt(e.target.value, ""))} />
        </div>
        <div>
          <label className="ap-lbl" style={{ fontSize: 9 }}>Unit</label>
          <select className="ap-vin" value={colorObj.unit} onChange={(e) => onChange("unit", e.target.value)}>
            {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      {showStats && (
        <div className="ap-scstats">
          <div className={`ap-stat ${isLoss ? "ap-stat-red" : "ap-stat-em"}`}>
            <p className="ap-stat-title">{isLoss ? "Loss" : "Margin"}</p>
            <p className="ap-stat-val">₹{fmt(profit)}</p>
          </div>
          <div className="ap-stat ap-stat-vio">
            <p className="ap-stat-title">Total</p>
            <p className="ap-stat-val">₹{fmt(total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Expanded size block
// ─────────────────────────────────────────
function ExpandedSizeBlock({ sizeVariant, onRemove, onCustomSize, onToggleColor, onColorField }) {
  return (
    <div className="ap-szexpand">
      <div className="ap-szexpand-head">
        <div className="ap-szexpand-meta">
          <span className="ap-sz-pill">{sizeVariant.size}</span>
          <span className="ap-sz-count">
            {sizeVariant.colors.length} color{sizeVariant.colors.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button type="button" className="ap-sz-remove" onClick={onRemove}>✕ Remove</button>
      </div>
      <div className="ap-fg">
        <label className="ap-lbl">Custom Size Value</label>
        <input type="text" className="ap-in" placeholder="e.g. 30 / 32 / Free Size"
          value={sizeVariant.custom_size} onChange={(e) => onCustomSize(e.target.value)} />
      </div>
      <div className="ap-fg">
        <label className="ap-lbl">Select Colors ({sizeVariant.colors.length} selected)</label>
        <ColorGrid compact selected={sizeVariant.colors} onToggle={onToggleColor} />
      </div>
      {sizeVariant.colors.length > 0 && (
        <div className="ap-scgrid">
          {sizeVariant.colors.map((cObj) => (
            <SizeColorMiniCard key={cObj.color} size={sizeVariant.size}
              customSize={sizeVariant.custom_size} colorObj={cObj}
              onChange={(field, value) => onColorField(cObj.color, field, value)} />
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
  const [products, setProducts]       = useState([emptyProduct()]);
  const [mappingData, setMappingData] = useState({});
  const [divisions, setDivisions]     = useState([]);
  const [sections, setSections]       = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/api/product-mapping/grouped`)
      .then((res) => {
        const data = res.data.data || {};
        setMappingData(data);
        setDivisions([...new Set(Object.keys(data).flatMap((pt) => Object.keys(data[pt])))]);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const div = products[0]?.division;
    if (!div) { setSections([]); setDepartments([]); return; }
    const s = new Set();
    Object.values(mappingData).forEach((pt) => { if (pt[div]) Object.keys(pt[div]).forEach((k) => s.add(k)); });
    setSections([...s]); setDepartments([]);
  }, [products[0]?.division, mappingData]);

  useEffect(() => {
    const div = products[0]?.division, sec = products[0]?.section;
    if (!div || !sec) { setDepartments([]); return; }
    const d = new Set();
    Object.values(mappingData).forEach((pt) => { if (pt[div]?.[sec]) pt[div][sec].forEach((v) => d.add(v)); });
    setDepartments([...d]);
  }, [products[0]?.section, products[0]?.division, mappingData]);

  const handleChange = (i, f, v) => {
    const u = [...products]; u[i][f] = v;
    if (f === "division") { u[i].section = ""; u[i].department = ""; }
    if (f === "section")  { u[i].department = ""; }
    if (f === "mrp" && !u[i].selling_price) u[i].selling_price = v;
    setProducts(u);
  };

  const handleImages  = (i, files) => { const u=[...products]; u[i].images=Array.from(files); setProducts(u); };
  const addProduct    = () => setProducts((p) => [...p, emptyProduct()]);
  const removeProduct = (i) => setProducts((p) => p.filter((_,x) => x !== i));

  const toggleColor = (i, color) => {
    const u = [...products];
    const ei = u[i].variants.findIndex((v) => v.color === color);
    if (ei !== -1) u[i].variants.splice(ei, 1);
    else u[i].variants.push(emptyColorVariant(color));
    setProducts([...u]);
  };
  const updateColorField = (i, color, field, value) => {
    const u = [...products];
    u[i].variants = u[i].variants.map((v) => v.color !== color ? v : { ...v, [field]: value });
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
    u[i].variants = u[i].variants.map((v) => v.size !== size ? v : { ...v, custom_size: value });
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
      return { ...v, colors: v.colors.map((c) => c.color !== color ? c : { ...c, [field]: value }) };
    });
    setProducts(u);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      for (const p of products) {
        const fd = new FormData();
        let variants = [];
        if (p.has_variants) {
          if (p.variant_type === "color") {
            variants = p.variants.map((v) => ({
              color: v.color, cost_price: toNum(v.cost_price), mrp: toNum(v.mrp),
              selling_price: toNum(v.selling_price) || toNum(v.mrp),
              stock: toInt(v.quantity, 0), unit: v.unit,
            }));
          } else {
            variants = p.variants.map((sv) => ({
              size_label: sv.size, size_value: sv.custom_size || "",
              colors: sv.colors.map((c) => ({
                color: c.color, cost_price: toNum(c.cost_price), mrp: toNum(c.mrp),
                selling_price: toNum(c.selling_price) || toNum(c.mrp),
                stock: toInt(c.quantity, 0), unit: c.unit,
              })),
            }));
          }
        }
        fd.append("product_name",  p.product_name);
        fd.append("division",      p.division);
        fd.append("section",       p.section);
        fd.append("department",    p.department);
        fd.append("description",   p.description);
        fd.append("specification", p.specification);
        fd.append("has_variants",  String(p.has_variants));
        fd.append("variant_type",  p.has_variants ? p.variant_type : "none");
        if (!p.has_variants) {
          fd.append("cost_price",    toNum(p.cost_price));
          fd.append("mrp",           toNum(p.mrp));
          fd.append("selling_price", toNum(p.selling_price) || toNum(p.mrp));
          fd.append("quantity",      toInt(p.quantity, 0));
          fd.append("unit",          p.unit);
        }
        fd.append("variants", JSON.stringify(variants));
        (p.images || []).forEach((f) => fd.append("images", f));
        await axios.post(`${API_BASE}/api/products/add`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      alert("✅ Products added successfully");
      navigate("/products");
    } catch { alert("❌ Error adding products"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{S}</style>
      <div className="ap-root">
        <div className="ap-wrap">

          <div className="ap-head">
            <h1 className="ap-title">Add <span>Products</span></h1>
            <div className="ap-badge">{products.length} ITEM{products.length !== 1 ? "S" : ""}</div>
          </div>

          <form onSubmit={handleSubmit}>
            {products.map((form, idx) => (
              <div key={idx} className="ap-card" style={{ animationDelay: `${idx * 0.06}s` }}>

                <div className="ap-card-head">
                  <div className="ap-card-meta">
                    <div className="ap-card-num">{String(idx + 1).padStart(2, "0")}</div>
                    <span className="ap-card-name">{form.product_name || "New Product"}</span>
                  </div>
                  {products.length > 1 && (
                    <button type="button" className="ap-del" onClick={() => removeProduct(idx)}>✕ Remove</button>
                  )}
                </div>

                {/* IDENTITY */}
                <Sec label="Identity" />
                <div className="ap-fg">
                  <label className="ap-lbl">Product Name *</label>
                  <input type="text" className="ap-in" placeholder="e.g. Classic Polo Shirt"
                    value={form.product_name} required
                    onChange={(e) => handleChange(idx, "product_name", e.target.value)} />
                </div>
                <div className="g3 ap-fg">
                  <div>
                    <label className="ap-lbl">Division *</label>
                    <select className="ap-in" value={form.division} required
                      onChange={(e) => handleChange(idx, "division", e.target.value)}>
                      <option value="">Select</option>
                      {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="ap-lbl">Section</label>
                    <select className="ap-in" value={form.section}
                      onChange={(e) => handleChange(idx, "section", e.target.value)}>
                      <option value="">Select</option>
                      {sections.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="ap-lbl">Department</label>
                    <select className="ap-in" value={form.department}
                      onChange={(e) => handleChange(idx, "department", e.target.value)}>
                      <option value="">Select</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ap-div" />

                {/* PRICING + INVENTORY — no-variant only */}
                {!form.has_variants && (
                  <>
                    <Sec label="Pricing" />
                    <div className="g3 ap-fg">
                      <div>
                        <label className="ap-lbl">Cost Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="ap-in ap-mono"
                          placeholder="0.00" value={form.cost_price} onKeyDown={preventInvalidKeys}
                          onChange={(e) => handleChange(idx, "cost_price", sanitizeNum(e.target.value, ""))} />
                      </div>
                      <div>
                        <label className="ap-lbl">MRP (₹)</label>
                        <input type="number" min="0" step="0.01" className="ap-in ap-mono"
                          placeholder="0.00" value={form.mrp} onKeyDown={preventInvalidKeys}
                          onChange={(e) => handleChange(idx, "mrp", sanitizeNum(e.target.value, ""))} />
                      </div>
                      <div>
                        <label className="ap-lbl">Selling Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="ap-in ap-mono"
                          placeholder="Auto from MRP" value={form.selling_price} onKeyDown={preventInvalidKeys}
                          onChange={(e) => handleChange(idx, "selling_price", sanitizeNum(e.target.value, ""))} />
                      </div>
                    </div>
                    <CalcPanel cp={form.cost_price} mrp={form.mrp} sp={form.selling_price} qty={form.quantity} />

                    <div className="ap-div" />

                    <Sec label="Inventory" />
                    <div className="g2 ap-fg">
                      <div>
                        <label className="ap-lbl">Quantity</label>
                        <input type="number" min="0" step="1" className="ap-in ap-mono"
                          placeholder="0" value={form.quantity} onKeyDown={preventInvalidKeys}
                          onChange={(e) => handleChange(idx, "quantity", sanitizeInt(e.target.value, ""))} />
                      </div>
                      <div>
                        <label className="ap-lbl">Unit</label>
                        <select className="ap-in" value={form.unit}
                          onChange={(e) => handleChange(idx, "unit", e.target.value)}>
                          {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="ap-div" />
                  </>
                )}

                {/* DETAILS */}
                <Sec label="Details" />
                <div className="ap-fg">
                  <label className="ap-lbl">Description</label>
                  <textarea className="ap-in" rows={3} placeholder="Short product description…"
                    value={form.description}
                    onChange={(e) => handleChange(idx, "description", e.target.value)} />
                </div>
                <div className="ap-fg">
                  <label className="ap-lbl">Specification</label>
                  <textarea className="ap-in" rows={3} placeholder="Material, dimensions, care instructions…"
                    value={form.specification}
                    onChange={(e) => handleChange(idx, "specification", e.target.value)} />
                </div>

                <div className="ap-div" />

                {/* VARIANTS */}
                <Sec label="Variants" />
                <div className="ap-fg">
                  <div className="ap-tog-row">
                    <label className="ap-tog-lbl">
                      <input type="checkbox" className="ap-chk" checked={form.has_variants}
                        onChange={(e) => {
                          handleChange(idx, "has_variants", e.target.checked);
                          handleChange(idx, "variants", []);
                        }} />
                      Enable Variants
                    </label>
                    {form.has_variants && (
                      <select className="ap-vsel" value={form.variant_type}
                        onChange={(e) => {
                          handleChange(idx, "variant_type", e.target.value);
                          handleChange(idx, "variants", []);
                        }}>
                        <option value="color">Color only</option>
                        <option value="size_color">Size + Color</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* COLOR ONLY */}
                {form.has_variants && form.variant_type === "color" && (
                  <div className="ap-fg">
                    <label className="ap-lbl" style={{ marginBottom: 10 }}>
                      Select Colors
                      {form.variants.length > 0 &&
                        <span style={{ marginLeft: 8, fontFamily:"var(--mono)", color:"var(--amber-dk)", fontWeight:400 }}>
                          ({form.variants.length} selected)
                        </span>}
                    </label>
                    <ColorGrid selected={form.variants} onToggle={(c) => toggleColor(idx, c)} />
                    {form.variants.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        {form.variants.map((v) => (
                          <ColorVariantCard key={v.color} variant={v}
                            onChange={(field, value) => updateColorField(idx, v.color, field, value)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SIZE + COLOR */}
                {form.has_variants && form.variant_type === "size_color" && (
                  <div className="ap-fg">
                    <label className="ap-lbl" style={{ marginBottom: 10 }}>Select Sizes</label>
                    <div className="ap-sz-row">
                      {SIZE_OPTIONS.map((sz) => (
                        <button key={sz} type="button"
                          className={`ap-szbtn${form.variants.some((v) => v.size === sz) ? " on" : ""}`}
                          onClick={() => toggleSize(idx, sz)}>
                          {sz}
                        </button>
                      ))}
                    </div>
                    {form.variants.map((sv) => (
                      <ExpandedSizeBlock key={sv.size} sizeVariant={sv}
                        onRemove={() => toggleSize(idx, sv.size)}
                        onCustomSize={(val) => updateCustomSize(idx, sv.size, val)}
                        onToggleColor={(c) => toggleColorForSize(idx, sv.size, c)}
                        onColorField={(c, field, val) => updateSizeColorField(idx, sv.size, c, field, val)} />
                    ))}
                  </div>
                )}

                <div className="ap-div" />

                {/* IMAGES */}
                <Sec label="Images" />
                <div className="ap-fg">
                  <div className="ap-drop">
                    <input type="file" multiple accept="image/*"
                      onChange={(e) => handleImages(idx, e.target.files)} />
                    <div className="ap-drop-icon">📁</div>
                    <p className="ap-drop-txt"><strong>Click to browse</strong> or drag &amp; drop images here</p>
                    <p className="ap-drop-hint">PNG · JPG · WEBP — multiple files allowed</p>
                  </div>
                  {form.images.length > 0 && (
                    <div className="ap-fchips">
                      {form.images.map((f, i) => <span key={i} className="ap-fchip">✓ {f.name}</span>)}
                    </div>
                  )}
                </div>

              </div>
            ))}

            <div className="ap-actions">
              <button type="button" className="ap-add" onClick={addProduct}>
                <span style={{ fontSize: 16 }}>＋</span> Add Another Product
              </button>
              <button type="submit" className="ap-save" disabled={loading}>
                {loading && <span className="ap-spin" />}
                {loading ? "Saving…" : "Save All Products"}
              </button>
            </div>
          </form>

        </div>
      </div>
    </>
  );
}