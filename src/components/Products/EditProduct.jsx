import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = `${APP_API_URL}`;

/* ─────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #0a0a0b;
    --surface:     #111113;
    --surface2:    #18181c;
    --surface3:    #1f1f24;
    --border:      #27272d;
    --border2:     #32323a;
    --accent:      #6c63ff;
    --accent-l:    #8b85ff;
    --accent-glow: rgba(108,99,255,0.18);
    --accent-dim:  rgba(108,99,255,0.10);
    --gold:        #f5c842;
    --green:       #34d399;
    --red:         #f87171;
    --text:        #f1f1f3;
    --text2:       #a0a0aa;
    --text3:       #60606a;
    --font:        'Outfit', sans-serif;
    --mono:        'JetBrains Mono', monospace;
    --r:           8px;
    --r2:          12px;
    --ease:        cubic-bezier(0.4,0,0.2,1);
  }

  .ep { font-family: var(--font); background: var(--bg); min-height: 100vh; color: var(--text); }

  .ep-bar {
    position: sticky; top: 0; z-index: 200;
    background: rgba(10,10,11,0.85);
    backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid var(--border);
    padding: 0 32px; height: 60px;
    display: flex; align-items: center; justify-content: space-between;
    animation: barIn 0.35s var(--ease) both;
  }
  @keyframes barIn { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)} }

  .ep-bar-left  { display:flex; align-items:center; gap:14px; }
  .ep-bar-right { display:flex; align-items:center; gap:10px; }

  .ep-back {
    display:flex; align-items:center; gap:7px;
    background:none; border:1px solid var(--border2);
    color:var(--text2); font-family:var(--font); font-size:13px; font-weight:500;
    padding:6px 14px; border-radius:var(--r); cursor:pointer;
    transition:all .15s var(--ease);
  }
  .ep-back:hover { border-color:var(--accent-l); color:var(--accent-l); background:var(--accent-dim); }

  .ep-title { font-size:14px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text2); }

  .ep-sku-badge {
    font-family:var(--mono); font-size:11px; color:var(--accent-l);
    background:var(--accent-dim); border:1px solid rgba(108,99,255,.25);
    padding:3px 10px; border-radius:100px;
  }

  .ep-discard {
    background:none; border:1px solid var(--border2);
    color:var(--text2); font-family:var(--font); font-size:13px; font-weight:500;
    padding:7px 16px; border-radius:var(--r); cursor:pointer;
    transition:all .15s var(--ease);
  }
  .ep-discard:hover { border-color:var(--red); color:var(--red); background:rgba(248,113,113,.07); }

  .ep-save {
    display:flex; align-items:center; gap:8px;
    background:var(--accent); border:none; color:#fff;
    font-family:var(--font); font-size:13px; font-weight:600;
    padding:8px 22px; border-radius:var(--r); cursor:pointer;
    transition:all .15s var(--ease);
  }
  .ep-save:hover:not(:disabled) { background:var(--accent-l); box-shadow:0 0 24px var(--accent-glow); transform:translateY(-1px); }
  .ep-save:disabled { opacity:.5; cursor:not-allowed; transform:none; }

  .ep-layout {
    max-width:1160px; margin:0 auto;
    padding:32px 32px 80px;
    display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start;
  }
  @media(max-width:860px){
    .ep-layout{ grid-template-columns:1fr; padding:20px 16px 80px; }
    .ep-bar{ padding:0 16px; }
  }
  .ep-col { display:flex; flex-direction:column; gap:20px; }

  .ep-card {
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--r2); overflow:hidden;
    animation:cardUp .4s var(--ease) both;
  }
  @keyframes cardUp { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
  .ep-card:nth-child(2){animation-delay:.06s}
  .ep-card:nth-child(3){animation-delay:.12s}
  .ep-card:nth-child(4){animation-delay:.18s}

  .ep-ch {
    padding:14px 20px; border-bottom:1px solid var(--border);
    display:flex; align-items:center; gap:10px;
  }
  .ep-ci {
    width:30px; height:30px; border-radius:7px;
    background:var(--accent-dim); border:1px solid rgba(108,99,255,.2);
    display:flex; align-items:center; justify-content:center;
    font-size:14px; flex-shrink:0;
  }
  .ep-cl {
    font-size:11px; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; color:var(--text2);
  }
  .ep-cs {
    margin-left:auto; font-size:10px; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
    color:var(--text3); background:var(--surface2); border:1px solid var(--border);
    padding:2px 8px; border-radius:100px; display:flex; align-items:center; gap:4px;
  }
  .ep-cb { padding:20px; }

  .ep-field { margin-bottom:16px; }
  .ep-field:last-child { margin-bottom:0; }
  .ep-lbl {
    display:block; font-size:11px; font-weight:600; letter-spacing:.08em;
    text-transform:uppercase; color:var(--text3); margin-bottom:6px;
  }
  .ep-in, .ep-ta, .ep-sel {
    width:100%; background:var(--surface2); border:1px solid var(--border2);
    color:var(--text); font-family:var(--font); font-size:14px;
    padding:10px 14px; border-radius:var(--r); outline:none;
    transition:border-color .15s var(--ease),box-shadow .15s var(--ease);
  }
  .ep-in:focus,.ep-ta:focus,.ep-sel:focus {
    border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-dim);
  }
  .ep-in::placeholder,.ep-ta::placeholder { color:var(--text3); }
  .ep-ta { resize:vertical; line-height:1.6; }
  .ep-sel { cursor:pointer; }
  .ep-sel option { background:var(--surface2); }

  .ep-locked {
    width:100%; background:rgba(255,255,255,.02); border:1px solid var(--border);
    color:var(--text3); font-family:var(--mono); font-size:12px;
    padding:10px 14px; border-radius:var(--r); cursor:not-allowed;
  }

  .ep-g2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .ep-g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }

  .ep-pw { position:relative; }
  .ep-pp {
    position:absolute; left:13px; top:50%; transform:translateY(-50%);
    font-size:12px; color:var(--text3); pointer-events:none; z-index:1; font-family:var(--mono);
  }
  .ep-pw .ep-in { padding-left:28px; font-family:var(--mono); }

  .ep-vscroll { overflow-x:auto; overflow-y:auto; max-height:400px; scrollbar-width:thin; scrollbar-color:var(--border2) transparent; }
  .ep-vt { width:100%; border-collapse:collapse; font-size:12px; white-space:nowrap; }
  .ep-vt thead tr { border-bottom:1px solid var(--border2); position:sticky; top:0; background:var(--surface); z-index:1; }
  .ep-vt th { padding:8px 10px; text-align:left; font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text3); }
  .ep-vt td { padding:5px 6px; border-bottom:1px solid rgba(39,39,45,.7); vertical-align:middle; }
  .ep-vt tbody tr:last-child td { border-bottom:none; }
  .ep-vt tbody tr:hover td { background:rgba(108,99,255,.04); }

  .ep-vchip {
    display:inline-flex; align-items:center; gap:5px;
    background:var(--surface3); border:1px solid var(--border2);
    padding:3px 8px; border-radius:4px; font-size:11px; max-width:120px;
  }
  .ep-vchip span { overflow:hidden; text-overflow:ellipsis; color:var(--text2); }
  .ep-cdot { width:9px; height:9px; border-radius:50%; border:1px solid rgba(255,255,255,.1); flex-shrink:0; }

  .ep-vi {
    background:var(--surface3); border:1px solid transparent;
    color:var(--text); font-family:var(--mono); font-size:12px;
    padding:5px 8px; border-radius:5px; outline:none; width:100%; min-width:68px;
    transition:border-color .12s;
  }
  .ep-vi:focus { border-color:var(--accent); }

  .ep-igrid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }

  .ep-iitem {
    position:relative; aspect-ratio:1; border-radius:var(--r); overflow:hidden;
    border:1px solid var(--border2); background:var(--surface2);
  }
  .ep-iitem img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .2s; }
  .ep-iitem:hover img { transform:scale(1.06); }
  .ep-idel {
    position:absolute; top:5px; right:5px; width:22px; height:22px; border-radius:50%;
    background:rgba(248,113,113,.9); border:none; color:#fff; font-size:10px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    opacity:0; transition:opacity .15s;
  }
  .ep-iitem:hover .ep-idel { opacity:1; }

  .ep-inew {
    position:relative; aspect-ratio:1; border-radius:var(--r); overflow:hidden;
    border:1px solid var(--accent); background:var(--accent-dim);
  }
  .ep-inew img { width:100%; height:100%; object-fit:cover; display:block; }
  .ep-inew-badge {
    position:absolute; bottom:4px; left:4px; font-size:8px; font-weight:700;
    letter-spacing:.08em; text-transform:uppercase; background:var(--accent); color:#fff;
    padding:2px 6px; border-radius:3px; font-family:var(--font);
  }
  .ep-inew-del {
    position:absolute; top:5px; right:5px; width:22px; height:22px; border-radius:50%;
    background:rgba(248,113,113,.9); border:none; color:#fff; font-size:10px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
  }

  .ep-drop {
    border:1.5px dashed var(--border2); border-radius:var(--r2);
    padding:22px 16px; text-align:center; cursor:pointer;
    transition:all .15s var(--ease);
  }
  .ep-drop:hover,.ep-drop.over { border-color:var(--accent); background:var(--accent-dim); }
  .ep-drop-ico { font-size:24px; margin-bottom:8px; opacity:.5; }
  .ep-drop p { font-size:12px; color:var(--text3); line-height:1.6; }
  .ep-drop p span { color:var(--accent-l); font-weight:600; }

  .ep-irow {
    display:flex; align-items:center; justify-content:space-between;
    padding:9px 0; border-bottom:1px solid rgba(39,39,45,.5); gap:12px;
  }
  .ep-irow:last-child { border-bottom:none; }
  .ep-ik { font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--text3); white-space:nowrap; }
  .ep-iv { font-family:var(--mono); font-size:12px; color:var(--text2); text-align:right; word-break:break-all; }

  .ep-badge {
    display:inline-block; font-size:9px; font-weight:700; letter-spacing:.1em;
    text-transform:uppercase; padding:3px 8px; border-radius:100px; font-family:var(--font);
  }
  .ep-b-simple { background:rgba(96,96,106,.15); color:var(--text3); border:1px solid var(--border2); }
  .ep-b-color  { background:rgba(52,211,153,.1); color:var(--green); border:1px solid rgba(52,211,153,.25); }
  .ep-b-sc     { background:rgba(245,200,66,.1); color:var(--gold); border:1px solid rgba(245,200,66,.25); }

  .ep-pill {
    display:inline-flex; align-items:center; justify-content:center;
    min-width:20px; height:20px; padding:0 6px;
    background:var(--accent-dim); color:var(--accent-l);
    border-radius:100px; font-size:10px; font-weight:700; margin-left:6px;
  }

  .ep-toast {
    position:fixed; bottom:28px; right:28px; z-index:9999;
    display:flex; align-items:center; gap:10px;
    padding:12px 20px; border-radius:var(--r2);
    font-family:var(--font); font-size:13px; font-weight:500;
    animation:toastIn .28s var(--ease) both;
    box-shadow:0 8px 40px rgba(0,0,0,.5); max-width:340px;
  }
  @keyframes toastIn { from{transform:translateY(16px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1} }
  .ep-t-ok  { background:#0c1f16; border:1px solid var(--green); color:var(--green); }
  .ep-t-err { background:#1f0c0c; border:1px solid var(--red); color:var(--red); }

  .ep-spin {
    width:14px; height:14px; border-radius:50%;
    border:2px solid rgba(255,255,255,.25); border-top-color:#fff;
    animation:spin .65s linear infinite; flex-shrink:0;
  }
  @keyframes spin { to{transform:rotate(360deg)} }

  .ep-sk {
    border-radius:var(--r);
    background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%);
    background-size:200% 100%; animation:sk 1.4s infinite;
  }
  @keyframes sk { 0%{background-position:200% 0}100%{background-position:-200% 0} }

  .ep-divider { height:1px; background:var(--border); margin:14px 0; }
`;

function useStyles() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
}

/* ── Toast ── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3800); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`ep-toast ${type === "ok" ? "ep-t-ok" : "ep-t-err"}`}>
      {type === "ok" ? "✓" : "✕"} {msg}
    </div>
  );
}

/* ── Price field ── */
function Price({ label, value, onChange }) {
  return (
    <div className="ep-field" style={{ marginBottom: 0 }}>
      <label className="ep-lbl">{label}</label>
      <div className="ep-pw">
        <span className="ep-pp">₹</span>
        <input className="ep-in" type="number" min="0" step="0.01"
          value={value} onChange={e => onChange(e.target.value)} placeholder="0.00" />
      </div>
    </div>
  );
}

/* ── Info row ── */
function IRow({ k, v }) {
  return (
    <div className="ep-irow">
      <span className="ep-ik">{k}</span>
      <span className="ep-iv">{v || "—"}</span>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN
───────────────────────────────────────── */
export default function EditProduct() {
  useStyles();

  const { sku }    = useParams();
  const navigate   = useNavigate();
  const fileRef    = useRef(null);

  const [product,  setProduct]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [name, setName]   = useState("");
  const [desc, setDesc]   = useState("");
  const [spec, setSpec]   = useState("");

  const [costPrice,    setCostPrice]    = useState("");
  const [mrp,          setMrp]          = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity,     setQuantity]     = useState("");
  const [unit,         setUnit]         = useState("pcs");

  const [keepImgs, setKeepImgs] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [variants, setVariants] = useState([]);

  /* ── fetch product ── */
  useEffect(() => {
    if (!sku) return;
    setLoading(true);

    axios.get(`${API_BASE}/api/products/${sku}`)
      .then(res => {
        const d = res.data.data;
        setProduct(d);
        setName(d.product_name  || "");
        setDesc(d.description   || "");
        setSpec(d.specification || "");
        setKeepImgs(d.images    || []);

        if (!d.has_variants) {
          setCostPrice(d.cost_price       ?? "");
          setMrp(d.mrp                    ?? "");
          setSellingPrice(d.selling_price ?? "");
          setQuantity(d.quantity          ?? "");
          setUnit(d.unit                  || "pcs");
        } else {
          setVariants((d.variants || []).map(v => ({ ...v })));
        }
      })
      .catch(err => {
        const msg = err.response?.data?.detail || err.message || "Failed to load product";
        setToast({ msg, type: "err" });
        setTimeout(() => navigate("/products"), 2200);
      })
      .finally(() => setLoading(false));
  }, [sku]);

  /* ── file helpers ── */
  const addFiles = useCallback(files => {
    setNewFiles(p => [...p, ...Array.from(files).filter(f => f.type.startsWith("image/"))]);
  }, []);

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  /* ── variant patch ── */
  const patchV = (i, field, val) =>
    setVariants(p => { const n = [...p]; n[i] = { ...n[i], [field]: val }; return n; });

  /* ── save ── */
  const handleSave = async () => {
    if (!product || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("product_name",    name);
      fd.append("description",     desc);
      fd.append("specification",   spec);
      fd.append("existing_images", JSON.stringify(keepImgs));

      if (!product.has_variants) {
        if (costPrice    !== "") fd.append("cost_price",    costPrice);
        if (mrp          !== "") fd.append("mrp",           mrp);
        if (sellingPrice !== "") fd.append("selling_price", sellingPrice);
        if (quantity     !== "") fd.append("quantity",      quantity);
        fd.append("unit", unit);
      } else {
        fd.append("variants_update", JSON.stringify(
          variants.map(v => ({
            sku: v.sku,
            cost_price: v.cost_price, mrp: v.mrp,
            selling_price: v.selling_price,
            stock: v.stock, unit: v.unit,
          }))
        ));
      }

      newFiles.forEach(f => fd.append("images", f));

      const skuKey = product.base_sku || product.sku;
      await axios.put(`${API_BASE}/api/products/${skuKey}`, fd);
      setToast({ msg: "Saved successfully!", type: "ok" });
      setTimeout(() => navigate("/products"), 1300);
    } catch (err) {
      setToast({ msg: err.response?.data?.detail || "Save failed", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  /* ── LOADING SKELETON ── */
  if (loading) {
    return (
      <div className="ep">
        <div className="ep-bar">
          <div className="ep-bar-left">
            <div className="ep-sk" style={{ width: 72, height: 32 }} />
            <div className="ep-sk" style={{ width: 110, height: 18 }} />
          </div>
          <div className="ep-sk" style={{ width: 120, height: 36 }} />
        </div>
        <div className="ep-layout">
          <div className="ep-col">
            {[220, 190, 160].map((h, i) => (
              <div key={i} className="ep-card">
                <div className="ep-ch">
                  <div className="ep-sk" style={{ width: 30, height: 30, borderRadius: 7 }} />
                  <div className="ep-sk" style={{ width: 130, height: 14 }} />
                </div>
                <div className="ep-cb"><div className="ep-sk" style={{ width: "100%", height: h }} /></div>
              </div>
            ))}
          </div>
          <div className="ep-col">
            {[260, 200].map((h, i) => (
              <div key={i} className="ep-card">
                <div className="ep-ch">
                  <div className="ep-sk" style={{ width: 30, height: 30, borderRadius: 7 }} />
                  <div className="ep-sk" style={{ width: 90, height: 14 }} />
                </div>
                <div className="ep-cb"><div className="ep-sk" style={{ width: "100%", height: h }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isVariant  = product.has_variants;
  const vType      = product.variant_type;
  const displaySku = product.base_sku || product.sku;

  /* ── RENDER ── */
  return (
    <div className="ep">

      {/* TOP BAR */}
      <header className="ep-bar">
        <div className="ep-bar-left">
          <button className="ep-back" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back
          </button>
          <span className="ep-title">Edit Product</span>
          <span className="ep-sku-badge">{displaySku}</span>
        </div>
        <div className="ep-bar-right">
          <button className="ep-discard" onClick={() => navigate(-1)}>Discard</button>
          <button className="ep-save" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="ep-spin" /> Saving…</>
              : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Save Changes
                </>
            }
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="ep-layout">

        {/* ── LEFT COLUMN ── */}
        <div className="ep-col">

          {/* Basic Info */}
          <div className="ep-card">
            <div className="ep-ch">
              <div className="ep-ci">✏️</div>
              <span className="ep-cl">Basic Information</span>
            </div>
            <div className="ep-cb">
              <div className="ep-field">
                <label className="ep-lbl">Product Name</label>
                <input className="ep-in" value={name}
                  onChange={e => setName(e.target.value)} placeholder="Enter product name" />
              </div>
              <div className="ep-field">
                <label className="ep-lbl">Description</label>
                <textarea className="ep-ta" rows={3} value={desc}
                  onChange={e => setDesc(e.target.value)} placeholder="Describe this product…" />
              </div>
              <div className="ep-field" style={{ marginBottom: 0 }}>
                <label className="ep-lbl">Specification</label>
                <textarea className="ep-ta" rows={3} value={spec}
                  onChange={e => setSpec(e.target.value)} placeholder="Material, dimensions, care instructions…" />
              </div>
            </div>
          </div>

          {/* Simple — Pricing & Inventory */}
          {!isVariant && (
            <div className="ep-card">
              <div className="ep-ch">
                <div className="ep-ci">💰</div>
                <span className="ep-cl">Pricing &amp; Inventory</span>
              </div>
              <div className="ep-cb">
                <div className="ep-g3" style={{ marginBottom: 16 }}>
                  <Price label="Cost Price"    value={costPrice}    onChange={setCostPrice} />
                  <Price label="MRP"           value={mrp}          onChange={setMrp} />
                  <Price label="Selling Price" value={sellingPrice} onChange={setSellingPrice} />
                </div>
                <div className="ep-g2">
                  <div className="ep-field" style={{ marginBottom: 0 }}>
                    <label className="ep-lbl">Stock Qty</label>
                    <input className="ep-in" type="number" min="0"
                      value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
                  </div>
                  <div className="ep-field" style={{ marginBottom: 0 }}>
                    <label className="ep-lbl">Unit</label>
                    <select className="ep-sel" value={unit} onChange={e => setUnit(e.target.value)}>
                      {["pcs","kg","g","l","ml","m","set","box","pair"].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variant — Pricing & Stock table */}
          {isVariant && variants.length > 0 && (
            <div className="ep-card">
              <div className="ep-ch">
                <div className="ep-ci">⊞</div>
                <span className="ep-cl">
                  Variants — Pricing &amp; Stock
                  <span className="ep-pill">{variants.length}</span>
                </span>
                <span
                  className={`ep-badge ${vType === "size_color" ? "ep-b-sc" : "ep-b-color"}`}
                  style={{ marginLeft: "auto" }}
                >
                  {vType === "size_color" ? "Size + Color" : "Color"}
                </span>
              </div>
              <div className="ep-vscroll">
                <table className="ep-vt">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Cost ₹</th>
                      <th>MRP ₹</th>
                      <th>Selling ₹</th>
                      <th>Stock</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.sku}>
                        <td>
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            {v.size_label && (
                              <span className="ep-vchip">
                                <span style={{ fontSize:10, fontWeight:600 }}>{v.size_label}</span>
                              </span>
                            )}
                            {v.color && (
                              <span className="ep-vchip">
                                <span className="ep-cdot" style={{ background: v.color }} />
                                <span>{v.color}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <input className="ep-vi" type="number" min="0" step="0.01"
                            value={v.cost_price ?? ""} onChange={e => patchV(i,"cost_price",e.target.value)} />
                        </td>
                        <td>
                          <input className="ep-vi" type="number" min="0" step="0.01"
                            value={v.mrp ?? ""} onChange={e => patchV(i,"mrp",e.target.value)} />
                        </td>
                        <td>
                          <input className="ep-vi" type="number" min="0" step="0.01"
                            value={v.selling_price ?? ""} onChange={e => patchV(i,"selling_price",e.target.value)} />
                        </td>
                        <td>
                          <input className="ep-vi" type="number" min="0"
                            value={v.stock ?? ""} onChange={e => patchV(i,"stock",e.target.value)}
                            style={{ minWidth: 56 }} />
                        </td>
                        <td>
                          <select className="ep-vi" style={{ cursor:"pointer" }}
                            value={v.unit || "pcs"} onChange={e => patchV(i,"unit",e.target.value)}>
                            {["pcs","kg","g","l","ml","m","set","box","pair"].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="ep-col">

          {/* Images */}
          <div className="ep-card">
            <div className="ep-ch">
              <div className="ep-ci">🖼️</div>
              <span className="ep-cl">
                Product Images
                {(keepImgs.length + newFiles.length) > 0 &&
                  <span className="ep-pill">{keepImgs.length + newFiles.length}</span>}
              </span>
            </div>
            <div className="ep-cb">
              {/* existing Cloudinary images */}
              {keepImgs.length > 0 && (
                <div className="ep-igrid">
                  {keepImgs.map(url => (
                    <div key={url} className="ep-iitem">
                      <img src={url} alt="" />
                      <button className="ep-idel"
                        onClick={() => setKeepImgs(p => p.filter(u => u !== url))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* newly picked files */}
              {newFiles.length > 0 && (
                <>
                  <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                    color:"var(--accent-l)", marginBottom:8 }}>
                    New — pending upload
                  </p>
                  <div className="ep-igrid">
                    {newFiles.map((f, i) => (
                      <div key={i} className="ep-inew">
                        <img src={URL.createObjectURL(f)} alt="" />
                        <span className="ep-inew-badge">New</span>
                        <button className="ep-inew-del"
                          onClick={() => setNewFiles(p => p.filter((_,j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {keepImgs.length === 0 && newFiles.length === 0 && (
                <p style={{ textAlign:"center", padding:"20px 0", fontSize:12, color:"var(--text3)" }}>
                  No images attached yet
                </p>
              )}

              <div className="ep-divider" />

              {/* drag-drop zone */}
              <div
                className={`ep-drop${dragOver ? " over" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="ep-drop-ico">⤴</div>
                <p><span>Click to upload</span> or drag &amp; drop<br />PNG · JPG · WEBP</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple
                style={{ display:"none" }} onChange={e => addFiles(e.target.files)} />
            </div>
          </div>

          {/* Locked info */}
          <div className="ep-card">
            <div className="ep-ch">
              <div className="ep-ci">🔒</div>
              <span className="ep-cl">Locked Fields</span>
              <span className="ep-cs" style={{ marginLeft:"auto" }}>🔒 Read-only</span>
            </div>
            <div className="ep-cb">
              <p style={{ fontSize:11, color:"var(--text3)", lineHeight:1.65, marginBottom:14 }}>
                These define product identity &amp; catalogue hierarchy.
                To change them, delete and re-add the product.
              </p>
              <IRow k="Division"   v={product.division} />
              <IRow k="Section"    v={product.section} />
              <IRow k="Department" v={product.department} />
              <IRow k="SKU"        v={displaySku} />
              <IRow k="Barcode"    v={product.barcode || product.base_barcode} />
              <IRow k="Type" v={
                <span className={`ep-badge ${
                  isVariant
                    ? vType === "size_color" ? "ep-b-sc" : "ep-b-color"
                    : "ep-b-simple"
                }`}>
                  {isVariant
                    ? vType === "size_color" ? "Size + Color" : "Color"
                    : "Simple"}
                </span>
              } />
              <IRow k="Created" v={
                product.created_at
                  ? new Date(product.created_at).toLocaleDateString("en-IN",
                      { day:"2-digit", month:"short", year:"numeric" })
                  : "—"
              } />
            </div>
          </div>

        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}