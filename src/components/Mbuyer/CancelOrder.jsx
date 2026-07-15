import React, { useMemo, useState } from "react";

/* -------------------- helpers -------------------- */
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

const EMPTY_CANCEL_ITEM = () => ({
  barcode: "",
  description: "",
  orderNo: "",
  vendorName: "",
  rate: "",
  pendingQty: "",
  cancelQty: "",
  removed: false,
});

export default function CancelOrder() {
  const [cancels, setCancels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCancel, setEditingCancel] = useState(null);

  const handleCreate = () => {
    setEditingCancel(null);
    setShowForm(true);
  };

  const handleEdit = (row) => {
    setEditingCancel(row);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCancel(null);
  };

  const handleSave = (payload) => {
    setCancels((prev) => {
      const exists = prev.some((x) => x.id === payload.id);
      if (exists) {
        return prev.map((x) => (x.id === payload.id ? payload : x));
      }
      return [payload, ...prev];
    });

    setShowForm(false);
    setEditingCancel(null);
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {!showForm ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  Cancel Order
                </h1>
              </div>

              <button
                onClick={handleCreate}
                className="h-10 rounded-lg border border-red-600 bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
                type="button"
              >
                + Create Cancel Order
              </button>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1100px] text-xs">
                <thead className="bg-[#F2F4F8]">
                  <tr className="border-b border-slate-200">
                    <TH>Cancellation No</TH>
                    <TH>Date</TH>
                    <TH>Owner Site</TH>
                    <TH>Document No</TH>
                    <TH>Entry Mode</TH>
                    <TH className="text-right">Total Cancel Qty</TH>
                    <TH className="text-right">Total Value</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {cancels.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No cancel orders yet. Click <b>Create Cancel Order</b>{" "}
                        to add one.
                      </td>
                    </tr>
                  ) : (
                    cancels.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <TD className="font-semibold text-slate-900">
                          {c.header.cancelNo || "-"}
                        </TD>
                        <TD className="text-slate-800">
                          {c.header.date || "-"}
                        </TD>
                        <TD
                          className="max-w-[240px] truncate text-slate-800"
                          title={c.header.ownerSite || ""}
                        >
                          {c.header.ownerSite || "-"}
                        </TD>
                        <TD
                          className="max-w-[220px] truncate text-slate-800"
                          title={c.header.documentNo || ""}
                        >
                          {c.header.documentNo || "-"}
                        </TD>
                        <TD className="font-semibold uppercase tracking-wide text-slate-800">
                          {c.header.entryMode || "-"}
                        </TD>
                        <TD className="text-right font-bold tabular-nums text-slate-900">
                          {clamp0(c.totals.totalCancelQty).toFixed(3)}
                        </TD>
                        <TD className="text-right font-bold tabular-nums text-slate-900">
                          {money(c.totals.totalValue)}
                        </TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(c)}
                              className="h-9 rounded-lg border border-sky-200 bg-white px-3 font-semibold text-sky-700 hover:bg-sky-50"
                              type="button"
                            >
                              Edit
                            </button>
                          </div>
                        </TD>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <CancelOrderForm
            onClose={handleCloseForm}
            onSave={handleSave}
            initial={editingCancel}
          />
        )}
      </div>
    </div>
  );
}

function CancelOrderForm({ onClose, onSave, initial }) {
  const [header, setHeader] = useState(() => ({
    ownerSite: initial?.header?.ownerSite || "",
    date: initial?.header?.date || new Date().toISOString().slice(0, 10),
    cancelNo: initial?.header?.cancelNo || "",
    documentNo: initial?.header?.documentNo || "",
    entryMode: initial?.header?.entryMode || "items",
  }));

  const [items, setItems] = useState(() =>
    Array.isArray(initial?.items) && initial.items.length
      ? initial.items
      : [EMPTY_CANCEL_ITEM()]
  );

  const setH = (k, v) => setHeader((p) => ({ ...p, [k]: v }));

  const updateItem = (idx, k, v) => {
    setItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[idx], [k]: v };

      if (k === "rate") row.rate = String(clamp0(v));
      if (k === "pendingQty") row.pendingQty = String(clamp0(v));

      if (k === "cancelQty") {
        const pending = clamp0(row.pendingQty);
        const cq = clamp0(v);
        row.cancelQty = String(Math.min(cq, pending));
      }

      if (k === "pendingQty") {
        const pending = clamp0(row.pendingQty);
        const cq = clamp0(row.cancelQty);
        if (cq > pending) row.cancelQty = String(pending);
      }

      copy[idx] = row;
      return copy;
    });
  };

  const addRow = () => setItems((p) => [...p, EMPTY_CANCEL_ITEM()]);

  const removeRow = (idx) =>
    setItems((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));

  const totals = useMemo(() => {
    const active = items.filter((x) => !x.removed);
    const totalCancelQty = clamp0(
      active.reduce((s, r) => s + clamp0(r.cancelQty), 0)
    );
    const totalValue = clamp0(
      active.reduce((s, r) => s + clamp0(r.cancelQty) * clamp0(r.rate), 0)
    );
    return { totalCancelQty, totalValue, rows: active.length };
  }, [items]);

  const validateHeader = () => {
    if (
      !header.ownerSite ||
      !header.date ||
      !header.cancelNo ||
      !header.documentNo
    ) {
      alert(
        "Please fill required fields: Owner Site, Date, Cancellation No, Document No."
      );
      return false;
    }
    return true;
  };

  const validateItems = () => {
    const active = items.filter((x) => !x.removed);
    if (active.length === 0) {
      alert("Please add at least 1 item.");
      return false;
    }

    for (const r of active) {
      const pending = clamp0(r.pendingQty);
      const cq = clamp0(r.cancelQty);
      if (cq > pending) {
        alert("Cancel Qty cannot be greater than Pending Qty.");
        return false;
      }
    }

    return true;
  };

  const saveClose = () => {
    if (!validateHeader()) return;
    if (!validateItems()) return;

    const payload = {
      id: initial?.id || `CNCL-${Date.now()}`,
      header,
      items: items.filter((x) => !x.removed),
      totals,
    };

    onSave?.(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-900">
          {initial ? "Edit Cancel Order" : "Create Cancel Order"}
        </h1>

        <button
          onClick={onClose}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50"
          type="button"
        >
          Back
        </button>
      </div>

      <Section title="General Information">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="grid gap-3">
            <Row label="Owner Site" required>
              <Input
                value={header.ownerSite}
                onChange={(e) => setH("ownerSite", e.target.value)}
                placeholder="Owner site"
              />
            </Row>

            <Row label="Cancellation No" required>
              <Input
                value={header.cancelNo}
                onChange={(e) => setH("cancelNo", e.target.value)}
                placeholder="Cancellation no"
              />
            </Row>

            <Row label="Entry Mode" required>
              <div className="grid grid-cols-2 gap-2">
                <Toggle
                  active={header.entryMode === "items"}
                  onClick={() => setH("entryMode", "items")}
                >
                  Item
                </Toggle>
                <Toggle
                  active={header.entryMode === "sets"}
                  onClick={() => setH("entryMode", "sets")}
                >
                  Sets
                </Toggle>
              </div>
            </Row>
          </div>

          <div className="grid gap-3">
            <Row label="Date" required>
              <Input
                type="date"
                value={header.date}
                onChange={(e) => setH("date", e.target.value)}
              />
            </Row>

            <Row label="Document No" required>
              <Input
                value={header.documentNo}
                onChange={(e) => setH("documentNo", e.target.value)}
                placeholder="Document no"
              />
            </Row>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Totals
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <KV k="Rows" v={String(totals.rows)} />
                <KV k="Total Cancel Qty" v={totals.totalCancelQty.toFixed(3)} />
                <KV k="Total Value" v={money(totals.totalValue)} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Item Cancel Information"
        right={<Btn onClick={addRow}>+ Add Row</Btn>}
      >
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1500px] table-fixed text-xs">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[420px]" />
              <col className="w-[170px]" />
              <col className="w-[340px]" />
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[140px]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-[#F2F4F8]">
              <tr className="border-b border-slate-200">
                <TH>Barcode</TH>
                <TH>Item Description</TH>
                <TH>Order No</TH>
                <TH>Vendor Name</TH>
                <TH className="text-right">Rate</TH>
                <TH className="text-right">Pending Qty</TH>
                <TH className="text-right">Cancel Qty</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {items.map((it, idx) => {
                const pending = clamp0(it.pendingQty);
                const cq = clamp0(it.cancelQty);
                const invalid = cq > pending;

                return (
                  <tr key={idx} className="align-top hover:bg-slate-50">
                    <TD>
                      <Cell
                        value={it.barcode}
                        onChange={(e) => updateItem(idx, "barcode", e.target.value)}
                        placeholder="Barcode"
                      />
                    </TD>

                    <TD>
                      <CellLong
                        value={it.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        placeholder="Item description"
                        title={it.description || ""}
                      />
                    </TD>

                    <TD>
                      <Cell
                        value={it.orderNo}
                        onChange={(e) => updateItem(idx, "orderNo", e.target.value)}
                        placeholder="Order no"
                      />
                    </TD>

                    <TD>
                      <CellLong
                        value={it.vendorName}
                        onChange={(e) =>
                          updateItem(idx, "vendorName", e.target.value)
                        }
                        placeholder="Vendor name"
                        title={it.vendorName || ""}
                      />
                    </TD>

                    <TD className="text-right">
                      <CellNum
                        value={it.rate}
                        onChange={(e) => updateItem(idx, "rate", e.target.value)}
                      />
                    </TD>

                    <TD className="text-right">
                      <CellNum
                        value={it.pendingQty}
                        onChange={(e) =>
                          updateItem(idx, "pendingQty", e.target.value)
                        }
                      />
                    </TD>

                    <TD className="text-right">
                      <div className="space-y-1">
                        <CellNum
                          value={it.cancelQty}
                          onChange={(e) =>
                            updateItem(idx, "cancelQty", e.target.value)
                          }
                        />
                        {invalid ? (
                          <div className="text-[11px] font-semibold text-rose-600">
                            Cancel qty cannot exceed pending qty
                          </div>
                        ) : null}
                        {pending > 0 && cq === pending ? (
                          <div className="text-[11px] font-semibold text-amber-700">
                            Full cancellation for this item
                          </div>
                        ) : null}
                      </div>
                    </TD>

                    <TD className="text-right">
                      <button
                        onClick={() => removeRow(idx)}
                        className="h-9 rounded-lg border border-rose-200 bg-white px-3 font-semibold text-rose-700 hover:bg-rose-50"
                        type="button"
                      >
                        Remove
                      </button>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="sticky bottom-0 z-50 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <Btn ghost onClick={onClose}>
            Close
          </Btn>
          <div className="flex items-center gap-2">
            <Btn onClick={saveClose}>Save</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, right, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          ) : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Btn({ children, ghost, onClick, type = "button" }) {
  return (
    <button
      onClick={onClick}
      type={type}
      className={[
        "h-10 rounded-lg border px-4 text-sm font-semibold transition",
        ghost
          ? "border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
          : "border-sky-600 bg-sky-600 text-white hover:bg-sky-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Row({ label, required, children }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[190px_1fr]">
      <div className="text-xs font-semibold text-slate-800">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

function Input({ className = "", ...props }) {
  return <input {...props} className={[inputClass, className].join(" ")} />;
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-10 w-full rounded-lg border text-sm font-semibold transition",
        active
          ? "border-sky-600 bg-sky-600 text-white"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

function TH({ className = "", children }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-800 ${className}`}
    >
      {children}
    </th>
  );
}

function TD({ className = "", children }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function Cell({ disabled, className = "", ...props }) {
  return (
    <input
      {...props}
      disabled={disabled}
      className={[
        "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none",
        "whitespace-nowrap overflow-hidden text-ellipsis",
        "focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
        disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "",
        className,
      ].join(" ")}
    />
  );
}

function CellNum({ disabled, className = "", ...props }) {
  return (
    <input
      {...props}
      type="number"
      min="0"
      disabled={disabled}
      className={[
        "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-xs tabular-nums text-slate-800 outline-none",
        "whitespace-nowrap overflow-hidden text-ellipsis",
        "focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
        disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "",
        className,
      ].join(" ")}
    />
  );
}

function CellLong({ disabled, className = "", ...props }) {
  return (
    <input
      {...props}
      disabled={disabled}
      className={[
        "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none",
        "whitespace-nowrap overflow-hidden text-ellipsis",
        "focus:ring-2 focus:ring-sky-200 focus:border-sky-300",
        disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "",
        className,
      ].join(" ")}
    />
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