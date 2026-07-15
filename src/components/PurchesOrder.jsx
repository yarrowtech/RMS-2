import { API_BASE_URL as APP_API_URL } from "../config/api.js";


import React, { useMemo, useState, useEffect , useRef, useCallback } from "react";
const API_BASE = `${APP_API_URL}/purchaseorders`; 

const n0 = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp0 = (v) => Math.max(0, n0(v));
const money = (v) =>
  clamp0(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const EMPTY_ITEM = () => ({
  barcode: "",
  description: "",
  originalQty: "",
  quantity: "",
  amendedQty: "",
  receivedQty: "",
  cancelledQty: "",
  pendingQty: 0,
  rate: "",
  tolerancePct: "",
  dueDate: "",
  remarks: "",
  removed: false,
});

const EMPTY_SCHEDULE_ROW = (seq = 1) => ({
  seq,
  date: "",
  percentage: "",
  quantity: "",
});

// ─── Flatten vendor products (handles variants) ───────────────────────────────
function flattenVendorProducts(products = []) {
  const rows = [];
  for (const p of products) {
    if (!p.has_variants) {
      rows.push({
        product_name: p.product_name || "",
        sku: p.sku || "",
        barcode: p.barcode || "",
        originalQty: p.quantity ?? 0,
        rate: p.selling_price ?? p.mrp ?? 0,
        label: p.product_name || "",
        sublabel: `SKU: ${p.sku || "—"} · BC: ${p.barcode || "—"}`,
      });
    } else {
      for (const v of p.variants || []) {
        const parts = [p.product_name];
        if (v.size_label) parts.push(v.size_label);
        if (v.color) parts.push(v.color);
        const name = parts.join(" | ");
        rows.push({
          product_name: name,
          sku: v.sku || "",
          barcode: v.barcode || "",
          originalQty: v.stock ?? 0,
          rate: v.selling_price ?? v.mrp ?? 0,
          label: name,
          sublabel: `SKU: ${v.sku || "—"} · BC: ${v.barcode || "—"}`,
        });
      }
    }
  }
  return rows;
}

export default function PurchaseOrderManager() {
  const [orders, setOrders] = useState([]);
const [openPO, setOpenPO] = useState(false);
const [editingOrder, setEditingOrder] = useState(null);
const [deleteOpen, setDeleteOpen] = useState(false);
const [deletingOrder, setDeletingOrder] = useState(null);
const [loading, setLoading] = useState(false);

//  Load all purchase orders on mount
useEffect(() => {
  fetchOrders();
}, []);

const fetchOrders = async () => {
  try {
    setLoading(true);
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error("Failed to load orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data.reverse() : []);
  } catch (err) {
    console.error("Error fetching orders:", err);
  } finally {
    setLoading(false);
  }
};

const openCreate = () => {
  setEditingOrder(null);
  setOpenPO(true);
};

const openEdit = (order) => {
  setEditingOrder(order);
  setOpenPO(true);
};

const closePopup = () => {
  setOpenPO(false);
  setEditingOrder(null);
};

// ✅ SAVE (Create or Update)
const handleSave = async (newOrder) => {
  try {
    const isEdit = !!newOrder.id && orders.some((o) => o.id === newOrder.id);
    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `${API_BASE}/${newOrder.id}` : API_BASE;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOrder),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }

    await fetchOrders(); 
  } catch (err) {
    alert("Failed to save order: " + err.message);
  } finally {
    closePopup();
  }
};

//  DELETE FLOW 
const openDelete = (order) => {
  setDeletingOrder(order);
  setDeleteOpen(true);
};

const closeDelete = () => {
  setDeleteOpen(false);
  setDeletingOrder(null);
};

const confirmDelete = async () => {
  if (!deletingOrder?.id) return closeDelete();
  try {
    const res = await fetch(`${API_BASE}/${deletingOrder.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    await fetchOrders();
  } catch (err) {
    alert("Failed to delete order: " + err.message);
  } finally {
    closeDelete();
  }
};


// ✅ SEND TO VENDOR
const sendToVendor = async (order) => {
  if (!window.confirm(`Send PO ${order.orderNo} to vendor '${order.vendorName}'?`)) return;
  try {
    setLoading(true);
    const res = await fetch(`${API_BASE}/${order.id}/send-to-vendor`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to send PO");
    alert(data.message || "PO sent successfully!");
    await fetchOrders(); // refresh table
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    setLoading(false);
  }
};

// ✅ APPROVE VENDOR SUBMISSION
const approveVendor = async (order) => {
  if (!window.confirm(`Approve vendor submission for PO ${order.orderNo}?`)) return;
  try {
    setLoading(true);
    const res = await fetch(`${API_BASE}/${order.id}/approve-vendor`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to approve vendor submission");
    alert(data.message || "Vendor submission approved!");
    await fetchOrders(); // refresh table
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    setLoading(false);
  }
};





  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Purches Order</h1>
          </div>

          <button
            onClick={openCreate}
            className="h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold border border-sky-600"
            type="button"
          >
            + Create Order
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="w-full min-w-[1200px] text-xs">
            <thead className="bg-[#F2F4F8] text-slate-600">
              <tr className="border-b border-slate-200">
                <TH>Order No</TH>
                <TH>Order Date</TH>
                <TH>Vendor Name</TH>
                <TH>Status</TH>
                <TH>Order Type</TH>
                <TH>Owner Site Short Name</TH>
                <TH>Trade Group Name</TH>
                <TH>Term Name</TH>
                <TH className="text-right">Net Amount</TH>
                <TH className="text-center">Set Applicable</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
  <tr>
    <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
      Loading purchase orders...
    </td>
  </tr>
) : orders.length === 0 ? (

                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    No orders yet. Click <b>Create Order</b> to add one.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <TD className="font-semibold">{o.orderNo || "-"}</TD>
                    <TD>{o.orderDate || "-"}</TD>
                    <TD>{o.vendorName || "-"}</TD>
                    <TD>
                      <span
                        className={[
                          "px-2 py-1 rounded-full text-[11px] font-bold border",
                          o.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : o.status === "Pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : o.status === "Closed"
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : o.status === "Cancelled"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-sky-50 text-sky-700 border-sky-200",
                        ].join(" ")}
                      >
                        {o.status || "—"}
                      </span>
                    </TD>
                    <TD>{o.orderType || "-"}</TD>
                    <TD>{o.ownerSiteShortName || "-"}</TD>
                    <TD>{o.tradeGroupName || "-"}</TD>
                    <TD>{o.termName || "-"}</TD>
                    <TD className="text-right font-bold tabular-nums">{money(o.netAmount)}</TD>
                    <TD className="text-center">
                      <span
                        className={[
                          "px-2 py-1 rounded-full text-[11px] font-bold border",
                          o.setApplicable
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-slate-100 text-slate-600 border-slate-200",
                        ].join(" ")}
                      >
                        {o.setApplicable ? "Yes" : "No"}
                      </span>
                    </TD>
                    <TD className="text-right">
                     <div className="flex flex-wrap justify-end gap-2">
  <button
    onClick={() => openEdit(o)}
    className="h-9 px-3 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 font-semibold"
    type="button"
  >
    Edit
  </button>

  <button
    onClick={() => openDelete(o)}
    className="h-9 px-3 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 font-semibold"
    type="button"
  >
    Delete
  </button>

  {/* ✅ Send to Vendor */}
  <button
    onClick={() => sendToVendor(o)}
    disabled={o.status !== "Pending"}
    className={`h-9 px-3 rounded-lg border font-semibold ${
      o.status === "Pending"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
    }`}
    type="button"
  >
    Send to Vendor
  </button>

  {/* ✅ Approve Vendor Submission */}
  <button
    onClick={() => approveVendor(o)}
    disabled={o.status !== "VendorSubmitted"}
    className={`h-9 px-3 rounded-lg border font-semibold ${
      o.status === "VendorSubmitted"
        ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
    }`}
    type="button"
  >
    Approve Vendor
  </button>
</div>
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ CREATE / EDIT POPUP */}
      {openPO && (
        <ModalShell onClose={closePopup}>
          <PurchesOrderForm onClose={closePopup} onSave={handleSave} initialOrder={editingOrder} />
        </ModalShell>
      )}

      {/* ✅ DELETE CONFIRM MODAL */}
      {deleteOpen && (
        <ConfirmDeleteModal
          title="Delete Purchase Order?"
          message={
            <>
              Are you sure you want to delete{" "}
              <b>{deletingOrder?.orderNo || "this order"}</b>? This action cannot be undone.
            </>
          }
          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function ItemDescriptionDropdown({ value, products, disabled, onSelect, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 50);
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.barcode || "").includes(q)
      )
      .slice(0, 50);
  }, [query, products]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (onChange) onChange(val);
  };

  const handleSelect = (product) => {
    setQuery(product.label);
    setOpen(false);
    if (onSelect) onSelect(product);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder={
          disabled
            ? products.length === 0 ? "Select a vendor first" : "Disabled"
            : products.length === 0 ? "Select a vendor to load products" : "Search product…"
        }
        className={[
          "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none",
          "focus:border-sky-300 focus:ring-2 focus:ring-sky-200",
          disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "",
        ].join(" ")}
      />

      {open && !disabled && filtered.length > 0 && (
        <div className="absolute left-0 z-[999] mt-1 max-h-52 w-[340px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {filtered.map((p, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-sky-50"
            >
              <span className="text-xs font-semibold text-slate-900 leading-tight">{p.label}</span>
              <span className="text-[10px] text-slate-400">{p.sublabel}</span>
            </button>
          ))}
        </div>
      )}

      {open && !disabled && products.length > 0 && filtered.length === 0 && (
        <div className="absolute left-0 z-[999] mt-1 w-[300px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-xl">
          No products match "<b>{query}</b>"
        </div>
      )}
    </div>
  );
}



/*  POPUP FORM */
function PurchesOrderForm({ onClose, onSave, initialOrder }) {
  const [activeTab, setActiveTab] = useState("General"); // General | Items | Others
 const [vendors, setVendors] = useState([]); 
const [vendorLoading, setVendorLoading] = useState(false);
// products belonging to the selected vendor (flattened, variants expanded)
const [vendorProducts, setVendorProducts] = useState([]);
const [vendorProductsLoading, setVendorProductsLoading] = useState(false);

useEffect(() => {
  const fetchVendors = async () => {
    try {
      setVendorLoading(true);
      const res = await fetch(`${APP_API_URL}/api/vendors/approved`);
      if (!res.ok) throw new Error("Failed to load approved vendors");
      const data = await res.json();
      //  adapt vendor data — assuming field 'vendor_name'
      setVendors(
  data.map((v) => ({
    id: v._id || v.id || "",
    name: v.vendor_name || v.name || "",
  }))
);
    } catch (err) {
      console.error("Vendor fetch error:", err);
    } finally {
      setVendorLoading(false);
    }
  };
  fetchVendors();
}, []);

const fetchVendorProducts = useCallback(async (vendorId) => {
  if (!vendorId) { setVendorProducts([]); return; }
  try {
    setVendorProductsLoading(true);
    const res = await fetch(`${APP_API_URL}/api/products/vendor/${vendorId}`);
    if (!res.ok) throw new Error("Failed to load vendor products");
    const data = await res.json();
    setVendorProducts(flattenVendorProducts(data.data || data || []));
  } catch (err) {
    console.error("Vendor products fetch error:", err);
    setVendorProducts([]);
  } finally {
    setVendorProductsLoading(false);
  }
}, []);



  const [general, setGeneral] = useState({
    vendorId: "",
    ownerSite: "",
    ownerSiteShortName: "",
    date: new Date().toISOString().slice(0, 10),
    orderNo: "",
    documentNo: "",
    vendorName: "",
    purchaseType: "",
    validFrom: new Date().toISOString().slice(0, 10),
    validTill: "",
    currency: "",
    exchangeRate: "",
    agent: "",
    teamName: "",
    commissionRate: "",
    transporter: "",
    merchandiserName: "",
    tradeGroup: "",
    terms: "",
    entryMode: "",
    status: "",
    setApplicable: false,
  });

  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [others, setOthers] = useState({ remarks: "", terms: "" });

  const [showCharges, setShowCharges] = useState(false);
  const [charges, setCharges] = useState({ freight: "", discount: "", taxPct: "" });

  const [showReceive, setShowReceive] = useState(false);
  const [receiveRows, setReceiveRows] = useState([EMPTY_SCHEDULE_ROW(1)]);

  const setG = (k, v) => setGeneral((p) => ({ ...p, [k]: v }));


  const handleVendorChange = (name) => {
  setG("vendorName", name);
  const found = vendors.find((v) => v.name === name);
  const vendorId = found?.id || "";
  setG("vendorId", vendorId);
  fetchVendorProducts(vendorId);
};

  useEffect(() => {
  if (!initialOrder) return;

  setGeneral({
    ownerSite: initialOrder.ownerSite || "",
    ownerSiteShortName: initialOrder.ownerSiteShortName || "",
    date: initialOrder.orderDate || new Date().toISOString().slice(0, 10),
    orderNo: initialOrder.orderNo || "",
    vendorName: initialOrder.vendorName || "",
    vendorId: initialOrder.vendor_id ? String(initialOrder.vendor_id) : "",
    purchaseType: initialOrder.purchaseType || initialOrder.orderType || "",
    tradeGroup: initialOrder.tradeGroupName || "",
    terms: initialOrder.termName || "",
    status: initialOrder.status || "",
    setApplicable: !!initialOrder.setApplicable,

    //  fill the missing general fields:
    documentNo: initialOrder.documentNo || "",
    validFrom: initialOrder.validFrom || "",
    validTill: initialOrder.validTill || "",
    currency: initialOrder.currency || "",
    exchangeRate: String(initialOrder.exchangeRate || ""),
    agent: initialOrder.agent || "",
    teamName: initialOrder.teamName || "",
    commissionRate: String(initialOrder.commissionRate || ""),
    transporter: initialOrder.transporter || "",
    merchandiserName: initialOrder.merchandiserName || "",
    entryMode: initialOrder.entryMode || "",
  });

  setItems(
    Array.isArray(initialOrder.items) && initialOrder.items.length
      ? initialOrder.items
      : [EMPTY_ITEM()]
  );

  setOthers({
    remarks: initialOrder.notes || "",
    terms: initialOrder.otherTerms || "",
  });

  const resolvedId = initialOrder.vendor_id
  ? String(initialOrder.vendor_id)
  : vendors.find((v) => v.name === initialOrder.vendorName)?.id || "";
if (resolvedId) fetchVendorProducts(resolvedId);
}, [initialOrder?.id]);


useEffect(() => {
  if (!initialOrder || !vendors.length) return;
  if (!general.vendorId && initialOrder.vendorName) {
    const found = vendors.find((v) => v.name === initialOrder.vendorName);
    if (found?.id) {
      setG("vendorId", found.id);
      fetchVendorProducts(found.id);
    }
  }
}, [vendors]);


  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[idx], [k]: v };

      const q = clamp0(row.quantity);
      const r = clamp0(row.receivedQty);
      const c = clamp0(row.cancelledQty);
      row.pendingQty = clamp0(q - r - c);

      copy[idx] = row;
      return copy;
    });
  };

 const selectProductForItem = (idx, product) => {
  setItems((prev) => {
    const copy = [...prev];
    const row = { ...copy[idx] };
    row.description = product.product_name;
    row.barcode     = product.barcode || "";
    row.originalQty = String(product.originalQty ?? "");
    row.rate        = String(product.rate ?? "");
    const q = clamp0(row.quantity);
    const r = clamp0(row.receivedQty);
    const c = clamp0(row.cancelledQty);
    row.pendingQty  = clamp0(q - r - c);
    copy[idx] = row;
    return copy;
  });
};


  const addRow = () => setItems((p) => [...p, EMPTY_ITEM()]);
  const markRemoved = (idx) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, removed: true } : it)));
  const undoRemoved = (idx) => setItems((p) => p.map((it, i) => (i === idx ? { ...it, removed: false } : it)));

  const totals = useMemo(() => {
    const activeItems = items.filter((it) => !it.removed);

    const recordCount = activeItems.length;
    const totalItemQuantity = clamp0(activeItems.reduce((s, it) => s + clamp0(it.quantity), 0));
    const basicValue = clamp0(activeItems.reduce((s, it) => s + clamp0(it.quantity) * clamp0(it.rate), 0));

    const freight = clamp0(charges.freight);
    const discount = clamp0(charges.discount);
    const taxPct = clamp0(charges.taxPct);

    const taxable = clamp0(basicValue + freight - discount);
    const taxAmount = clamp0((taxable * taxPct) / 100);

    const grossAmount = taxable;
    const netAmount = clamp0(taxable + taxAmount);

    return { recordCount, totalItemQuantity, basicValue, grossAmount, netAmount, taxAmount, freight, discount, taxPct };
  }, [items, charges]);

  const totalOrderQty = totals.totalItemQuantity;

  useEffect(() => {
    setReceiveRows((prev) =>
      prev.map((r) => {
        const pct = clamp0(r.percentage);
        const qty = pct > 0 ? ((totalOrderQty * pct) / 100).toFixed(3) : r.quantity;
        return { ...r, quantity: String(clamp0(qty)) };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalOrderQty]);

  const validateStep = () => {
    if (activeTab === "General") {
      if (!general.ownerSite || !general.vendorName || !general.purchaseType) {
        alert("Please fill required fields in General (Owner Site, Vendor Name, Purchase Type).");
        return false;
      }
    }
    if (activeTab === "Items") {
      const activeItems = items.filter((i) => !i.removed);
      if (activeItems.length === 0) {
        alert("Please add at least 1 item.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (activeTab === "General") setActiveTab("Items");
    else if (activeTab === "Items") setActiveTab("Others");
  };

  const handleSaveOrder = () => {
    if (!validateStep()) return;

    const activeItems = items.filter((it) => !it.removed);

    const newOrder = {
  id: initialOrder?.id || `PO-${Date.now()}`,
  orderNo: general.orderNo,
  orderDate: general.date,
  vendorName: general.vendorName,
  status: general.status,
  orderType: general.purchaseType,
  ownerSiteShortName:
    general.ownerSiteShortName ||
    (general.ownerSite ? general.ownerSite.slice(0, 8).toUpperCase() : ""),
  tradeGroupName: general.tradeGroup,
  termName: general.terms,
  netAmount: totals.netAmount,
  setApplicable: !!general.setApplicable,
  ownerSite: general.ownerSite,

  // 🆕 add these so backend receives all details:
  documentNo: general.documentNo,
  validFrom: general.validFrom,
  validTill: general.validTill,
  currency: general.currency,
  exchangeRate: Number(general.exchangeRate) || 0,
  agent: general.agent,
  teamName: general.teamName,
  commissionRate: Number(general.commissionRate) || 0,
  transporter: general.transporter,
  merchandiserName: general.merchandiserName,
  entryMode: general.entryMode,
  purchaseType: general.purchaseType,

  // remarks / other terms
  notes: others?.remarks || "",
  otherTerms: others?.terms || "",

  items: activeItems,
};


    if (typeof onSave === "function") onSave(newOrder);
  };

  const updateReceiveRow = (idx, k, v) => {
    setReceiveRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[idx], [k]: v };

      if (k === "percentage") {
        const pct = clamp0(v);
        const qty = clamp0((totalOrderQty * pct) / 100);
        row.quantity = qty ? qty.toFixed(3) : "";
      }

      if (k === "quantity") {
        const q = clamp0(v);
        const pct = totalOrderQty > 0 ? clamp0((q / totalOrderQty) * 100) : 0;
        row.percentage = q ? pct.toFixed(2) : "";
      }

      copy[idx] = row;
      return copy;
    });
  };

  const removeReceiveRow = (idx) =>
    setReceiveRows((p) =>
      p.length === 1 ? p : p.filter((_, i) => i !== idx).map((r, i) => ({ ...r, seq: i + 1 }))
    );

  const sumReceiveQty = useMemo(() => clamp0(receiveRows.reduce((s, r) => s + clamp0(r.quantity), 0)), [receiveRows]);

  const onReceiveOk = () => {
    if (sumReceiveQty > totalOrderQty + 0.0005) {
      alert("Schedule quantity cannot be more than Total Order Quantity.");
      return;
    }
    setShowReceive(false);
    console.log("RECEIVE SCHEDULES:", receiveRows);
  };

  return (
    <div className="min-h-[85vh] bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <Tab active={activeTab === "General"} onClick={() => setActiveTab("General")}>
            General
          </Tab>
          <Tab active={activeTab === "Items"} onClick={() => setActiveTab("Items")}>
            Item Details
          </Tab>
          <Tab active={activeTab === "Others"} onClick={() => setActiveTab("Others")}>
            Others
          </Tab>
        </div>

        {/* GENERAL */}
        {activeTab === "General" && (
          <Section title="General Information" subtitle="Fill order header details">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="grid grid-cols-1 gap-3">
                <Row label="Owner Site" required>
                  <Input value={general.ownerSite} onChange={(e) => setG("ownerSite", e.target.value)} placeholder="Owner site" />
                </Row>

                <Row label="Owner Site Short Name" required>
                  <Input
                    value={general.ownerSiteShortName}
                    onChange={(e) => setG("ownerSiteShortName", e.target.value)}
                    placeholder="Short name (e.g. NKOL)"
                  />
                </Row>

                <Row label="Order No" required>
  <Input
    value={general.orderNo || "(auto-generate on save)"}
    onChange={(e) => setG("orderNo", e.target.value)}
    placeholder="PO number will be auto-generated"
    readOnly
    className="bg-slate-100 text-slate-600"
  />
</Row>


                <Row label="Vendor Name" required>
  <div className="relative">
    <input
      value={general.vendorName}
      onChange={(e) => setG("vendorName", e.target.value)}
      list="vendorList"
      placeholder={vendorLoading ? "Loading vendors..." : "Type or select vendor"}
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
    />
    <datalist id="vendorList">
      {vendors.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  </div>
</Row>

                <Row label="Valid From" required>
                  <Input type="date" value={general.validFrom} onChange={(e) => setG("validFrom", e.target.value)} />
                </Row>

                <Row label="Currency" required>
                  <Combo
                    value={general.currency}
                    onChange={(v) => setG("currency", v)}
                    listId="currencyList"
                    placeholder="Select or type…"
                    options={["INR", "USD", "EUR", "AED"]}
                  />
                </Row>

                <Row label="Agent">
                  <Input value={general.agent} onChange={(e) => setG("agent", e.target.value)} placeholder="Agent" />
                </Row>

                <Row label="Transporter">
                  <Input value={general.transporter} onChange={(e) => setG("transporter", e.target.value)} placeholder="Transporter" />
                </Row>

                <Row label="Trade Group Name">
                  <Input value={general.tradeGroup} onChange={(e) => setG("tradeGroup", e.target.value)} placeholder="Trade group" />
                </Row>

                <Row label="Entry Mode">
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={general.entryMode === "items"} onClick={() => setG("entryMode", "items")}>
                      Items
                    </Toggle>
                    <Toggle active={general.entryMode === "sets"} onClick={() => setG("entryMode", "sets")}>
                      Sets
                    </Toggle>
                  </div>
                </Row>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Row label="Order Date" required>
                  <Input type="date" value={general.date} onChange={(e) => setG("date", e.target.value)} />
                </Row>

                <Row label="Document No" required>
                  <Input value={general.documentNo} onChange={(e) => setG("documentNo", e.target.value)} placeholder="Document no" />
                </Row>

                <Row label="Purches Type" required>
                  <Combo
                    value={general.purchaseType}
                    onChange={(v) => setG("purchaseType", v)}
                    listId="purchaseTypeList"
                    placeholder="Select or type…"
                    options={["Standard", "Import", "Job Work", "Consignment"]}
                  />
                </Row>

                <Row label="Valid Till" required>
                  <Input type="date" value={general.validTill} onChange={(e) => setG("validTill", e.target.value)} />
                </Row>

                <Row label="Exchange Rate" required>
                  <Input
                    type="number"
                    min="0"
                    value={general.exchangeRate}
                    onChange={(e) => setG("exchangeRate", String(clamp0(e.target.value)))}
                    placeholder="0"
                  />
                </Row>

                <Row label="Commission Rate">
                  <Input
                    type="number"
                    min="0"
                    value={general.commissionRate}
                    onChange={(e) => setG("commissionRate", String(clamp0(e.target.value)))}
                    placeholder="0"
                  />
                </Row>

                <Row label="Merchandiser Name">
                  <Input
                    value={general.merchandiserName}
                    onChange={(e) => setG("merchandiserName", e.target.value)}
                    placeholder="Name"
                  />
                </Row>

                <Row label="Term Name">
                  <Input value={general.terms} onChange={(e) => setG("terms", e.target.value)} placeholder="Term name" />
                </Row>

                <Row label="Status">
                  <Combo
                    value={general.status}
                    onChange={(v) => setG("status", v)}
                    listId="statusList"
                    placeholder="Select or type…"
                    options={["New", "Pending", "Approved", "Closed", "Cancelled"]}
                  />
                </Row>

                <Row label="Set Applicable">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setG("setApplicable", !general.setApplicable)}
                      className={[
                        "h-10 px-4 rounded-lg border font-semibold transition",
                        general.setApplicable
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {general.setApplicable ? "Yes" : "No"}
                    </button>
                    <span className="text-xs text-slate-500">Toggle if this PO is applicable for sets.</span>
                  </div>
                </Row>
              </div>
            </div>
          </Section>
        )}

        {/* ITEMS */}
        {activeTab === "Items" && (
          <Section
            title="Item Details"
            subtitle="Add items with quantities and rates"
            right={
              <div className="flex items-center gap-2">
                <Btn ghost onClick={() => setShowCharges(true)}>
                  Calculate Charges
                </Btn>
                <Btn onClick={addRow}>+ Add Row</Btn>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <Kpi label="Record Count" value={String(totals.recordCount)} />
              <Kpi label="Total Item Quantity" value={totals.totalItemQuantity.toFixed(3)} />
              <Kpi label="Basic Value" value={money(totals.basicValue)} />
            </div>

            <div className="mb-3 rounded-xl border border-slate-200 bg-[#FAFBFF] px-4 py-3 text-xs flex flex-wrap gap-3">
              <span className="text-slate-600">
                Freight: <b className="text-slate-900 tabular-nums">{money(totals.freight)}</b>
              </span>
              <span className="text-slate-600">
                Discount: <b className="text-slate-900 tabular-nums">{money(totals.discount)}</b>
              </span>
              <span className="text-slate-600">
                Tax%: <b className="text-slate-900 tabular-nums">{clamp0(totals.taxPct).toFixed(2)}</b>
              </span>
              <span className="text-slate-600">
                Net: <b className="text-slate-900 tabular-nums">{money(totals.netAmount)}</b>
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-auto max-h-[55vh]">
              <table className="w-full text-xs min-w-[1680px] table-fixed">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[240px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                  <col className="w-[80px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                  <col className="w-[260px]" />
                  <col className="w-[130px]" />
                </colgroup>

                <thead className="bg-[#F2F4F8] text-slate-600 sticky top-0 z-10">
                  <tr className="border-b border-slate-200">
                    <TH>Barcode</TH>
                    <TH>Item Description</TH>
                    <TH className="text-right">Original Qty.</TH>
                    <TH className="text-right">Quantity</TH>
                    <TH className="text-right">Amended Qty.</TH>
                    <TH className="text-right">Received Qty.</TH>
                    <TH className="text-right">Cancelled Qty.</TH>
                    <TH className="text-right">Pending Qty.</TH>
                    <TH className="text-right">Rate</TH>
                    <TH className="text-right">Qty. Tolerance%</TH>
                    <TH>Due Date</TH>
                    <TH className="text-right">Amount</TH>
                    <TH>Remarks</TH>
                    <TH className="text-right">Action</TH>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {items.map((it, idx) => {
                    const amount = clamp0(it.quantity) * clamp0(it.rate);

                    return (
                      <tr key={idx} className={["hover:bg-slate-50 align-top", it.removed ? "opacity-55 bg-slate-50" : ""].join(" ")}>
                        <TD>
                          <Cell
  value={it.barcode || "(auto-generated)"}
  disabled
/>

                        </TD>

                        <TD>
                          <Cell value={it.description} disabled={it.removed} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.originalQty} disabled={it.removed} onChange={(e) => updateItem(idx, "originalQty", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.quantity} disabled={it.removed} onChange={(e) => updateItem(idx, "quantity", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.amendedQty} disabled={it.removed} onChange={(e) => updateItem(idx, "amendedQty", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.receivedQty} disabled={it.removed} onChange={(e) => updateItem(idx, "receivedQty", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.cancelledQty} disabled={it.removed} onChange={(e) => updateItem(idx, "cancelledQty", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.pendingQty} disabled />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.rate} disabled={it.removed} onChange={(e) => updateItem(idx, "rate", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD className="text-right">
                          <CellNum value={it.tolerancePct} disabled={it.removed} onChange={(e) => updateItem(idx, "tolerancePct", String(clamp0(e.target.value)))} />
                        </TD>

                        <TD>
                          <Cell type="date" value={it.dueDate} disabled={it.removed} onChange={(e) => updateItem(idx, "dueDate", e.target.value)} />
                        </TD>

                        <TD className="text-right">
                          <div className="px-2 py-2 font-semibold tabular-nums">{money(it.removed ? 0 : amount)}</div>
                        </TD>

                        <TD>
                          <input
                            value={it.remarks}
                            disabled={it.removed}
                            onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                            className={[
                              "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
                              it.removed ? "bg-slate-100 text-slate-500" : "",
                            ].join(" ")}
                            placeholder="Remarks"
                          />
                        </TD>

                        <TD className="text-right">
                          {!it.removed ? (
                            <button
                              onClick={() => markRemoved(idx)}
                              className="h-9 px-3 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 shrink-0 font-semibold"
                              type="button"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => undoRemoved(idx)}
                              className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0 font-semibold"
                              type="button"
                            >
                              Removed
                            </button>
                          )}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
              <Box title="Qty Tolerance %">
                <div className="flex items-center gap-2">
                  <Input className="w-40" type="number" min="0" placeholder="0" />
                  <Btn ghost>Assign</Btn>
                </div>
              </Box>

              <Box title="Totals">
                <div className="text-xs space-y-2">
                  <KV k="Basic value" v={money(totals.basicValue)} />
                  <KV k="Tax amount" v={money(totals.taxAmount)} />
                  <KV k="Gross amount" v={money(totals.grossAmount)} />
                  <KV k="Net amount" v={money(totals.netAmount)} />
                </div>
              </Box>
            </div>
          </Section>
        )}

        {/* OTHERS */}
        {activeTab === "Others" && (
          <Section title="Others" subtitle="Remarks and Terms">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldBlock label="Remarks">
                <textarea
                  rows={7}
                  className={textareaClass}
                  value={others.remarks}
                  onChange={(e) => setOthers((p) => ({ ...p, remarks: e.target.value }))}
                />
              </FieldBlock>

              <FieldBlock label="Terms">
                <textarea
                  rows={7}
                  className={textareaClass}
                  value={others.terms}
                  onChange={(e) => setOthers((p) => ({ ...p, terms: e.target.value }))}
                />
              </FieldBlock>
            </div>

            <div className="flex justify-end mt-3">
              <Btn ghost onClick={() => setShowReceive(true)}>
                Receive Schedules
              </Btn>
            </div>
          </Section>
        )}
      </div>

      {showCharges && <ChargesModal charges={charges} setCharges={setCharges} totals={totals} onClose={() => setShowCharges(false)} />}

      {showReceive && (
        <ReceiveScheduleModal
          totalQty={totalOrderQty}
          rows={receiveRows}
          onChangeRow={updateReceiveRow}
          onAdd={() => setReceiveRows((p) => [...p, EMPTY_SCHEDULE_ROW(p.length + 1)])}
          onRemove={removeReceiveRow}
          onClose={() => setShowReceive(false)}
          onOk={onReceiveOk}
          sumQty={sumReceiveQty}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-2">
          <Btn ghost onClick={onClose}>Close</Btn>
          <div className="flex items-center gap-2">
            {activeTab !== "Others" ? <Btn onClick={goNext}>Save & Continue</Btn> : <Btn onClick={handleSaveOrder}>Submit Order</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ✅ MODAL SHELL
================================================================ */
function ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-7xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">Purchase Order</div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            type="button"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[85vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/* ================================================================
   ✅ DELETE CONFIRM MODAL
================================================================ */
function ConfirmDeleteModal({ title, message, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700" type="button">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-700">{message}</div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="h-10 px-4 rounded-lg border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 font-semibold"
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- CHARGES MODAL -------------------- */
function ChargesModal({ charges, setCharges, totals, onClose }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Calculate Charges</div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700" type="button">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FieldBlock label="Freight">
              <input
                type="number"
                min="0"
                value={charges.freight}
                onChange={(e) => setCharges((p) => ({ ...p, freight: String(clamp0(e.target.value)) }))}
                className={inputClass}
                placeholder="0"
              />
            </FieldBlock>

            <FieldBlock label="Discount">
              <input
                type="number"
                min="0"
                value={charges.discount}
                onChange={(e) => setCharges((p) => ({ ...p, discount: String(clamp0(e.target.value)) }))}
                className={inputClass}
                placeholder="0"
              />
            </FieldBlock>

            <FieldBlock label="Tax %">
              <input
                type="number"
                min="0"
                value={charges.taxPct}
                onChange={(e) => setCharges((p) => ({ ...p, taxPct: String(clamp0(e.target.value)) }))}
                className={inputClass}
                placeholder="0"
              />
            </FieldBlock>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <MiniKV k="Basic" v={money(totals.basicValue)} />
            <MiniKV k="Tax" v={money(totals.taxAmount)} />
            <MiniKV k="Gross" v={money(totals.grossAmount)} />
            <MiniKV k="Net" v={money(totals.netAmount)} />
          </div>

          <div className="flex justify-end gap-2">
            <Btn ghost onClick={onClose}>
              Cancel
            </Btn>
            <Btn onClick={onClose}>OK</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- RECEIVE MODAL -------------------- */
function ReceiveScheduleModal({ totalQty, rows, onChangeRow, onAdd, onRemove, onClose, onOk, sumQty }) {
  return (
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Receive Schedule</div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700" type="button">
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl border border-slate-200 overflow-auto max-h-[45vh]">
            <table className="w-full text-xs min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[70px]" />
                <col className="w-[160px]" />
                <col className="w-[160px]" />
                <col className="w-[170px]" />
                <col className="w-[120px]" />
              </colgroup>

              <thead className="bg-[#F2F4F8] text-slate-600 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <TH className="text-center">Seq</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Percentage</TH>
                  <TH className="text-right">Quantity</TH>
                  <TH className="text-right">Action</TH>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <TD className="text-center">
                      <div className="px-2 py-2 font-semibold tabular-nums">{r.seq}</div>
                    </TD>

                    <TD>
                      <input type="date" value={r.date} onChange={(e) => onChangeRow(idx, "date", e.target.value)} className={cellInput} />
                    </TD>

                    <TD className="text-right">
                      <input
                        type="number"
                        min="0"
                        value={r.percentage}
                        onChange={(e) => onChangeRow(idx, "percentage", e.target.value)}
                        className={[cellInput, "text-right tabular-nums"].join(" ")}
                        placeholder="0.00"
                      />
                    </TD>

                    <TD className="text-right">
                      <input
                        type="number"
                        min="0"
                        value={r.quantity}
                        onChange={(e) => onChangeRow(idx, "quantity", e.target.value)}
                        className={[cellInput, "text-right tabular-nums"].join(" ")}
                        placeholder="0.000"
                      />
                    </TD>

                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onRemove(idx)}
                          className="h-9 px-3 rounded-lg border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 font-semibold"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600">
              Total Order Quantity: <span className="font-bold text-slate-900 tabular-nums">{clamp0(totalQty).toFixed(3)}</span>
              <span className="ml-3 text-slate-500">
                Scheduled: <span className="font-semibold tabular-nums">{clamp0(sumQty).toFixed(3)}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Btn ghost onClick={onAdd}>
                + Add Line
              </Btn>
              <Btn ghost onClick={onClose}>
                Cancel
              </Btn>
              <Btn onClick={onOk}>OK</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- UI components -------------------- */
function Section({ title, subtitle, right, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 px-4 rounded-lg border text-sm font-semibold transition",
        active ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#FAFBFF] p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-base font-bold tabular-nums mt-1 text-slate-900">{value}</div>
    </div>
  );
}

function Btn({ children, ghost, onClick, type = "button" }) {
  return (
    <button
      onClick={onClick}
      type={type}
      className={[
        "h-10 px-4 rounded-lg text-sm font-semibold transition border",
        ghost ? "bg-white text-sky-700 border-sky-200 hover:bg-sky-50" : "bg-sky-600 hover:bg-sky-700 text-white border-sky-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Row({ label, required, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-2 items-center">
      <div className="text-xs font-semibold text-slate-600">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

function Input({ className = "", ...props }) {
  return <input {...props} className={[inputClass, className].join(" ")} />;
}

function Combo({ value, onChange, options, listId, placeholder }) {
  return (
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} list={listId} placeholder={placeholder} className={inputClass} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 rounded-lg border text-sm font-semibold transition w-full",
        active ? "bg-sky-600 text-white border-sky-600" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

function TH({ className = "", children }) {
  return <th className={`px-3 py-2 text-[11px] font-semibold uppercase text-slate-600 ${className}`}>{children}</th>;
}
function TD({ className = "", children }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function Cell({ disabled, ...props }) {
  return (
    <input
      {...props}
      disabled={disabled}
      className={[
        "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
        disabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "",
      ].join(" ")}
    />
  );
}

function CellNum({ disabled, ...props }) {
  return (
    <input
      {...props}
      type="number"
      min="0"
      disabled={disabled}
      className={[
        "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none text-right tabular-nums focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
        disabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "",
      ].join(" ")}
    />
  );
}

function FieldBlock({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function MiniKV({ k, v }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between">
      <span className="text-slate-600">{k}</span>
      <span className="font-semibold tabular-nums text-slate-900">{v}</span>
    </div>
  );
}

function Box({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#FAFBFF] p-4">
      <div className="text-xs font-semibold text-slate-700 mb-2">{title}</div>
      {children}
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{k}</span>
      <span className="font-semibold tabular-nums text-slate-900">{v}</span>
    </div>
  );
}

const cellInput =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

const textareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";
