import { useEffect, useMemo, useState } from "react";
import { FaBalanceScale } from "react-icons/fa";
import { ReportHeader, StatTile, SectionCard, EmptyState, LoadingState, ErrorState, FilterSelect } from "./reportKit.jsx";
import { fetchReport, fmtNum, STATUS } from "./reportUtils.js";

// Read-only comparison of what a PO ordered vs. what its GRN(s) actually
// received — reuses the existing, already-tested /mbuyer/po-item-explorer
// endpoint rather than a new one, so this never touches PO/GRN write logic.
function lineStatus(row) {
  if (row.orderedQty <= 0) return "Cancelled";
  if (row.receivedQty <= 0) return "Pending";
  if (row.receivedQty < row.orderedQty) return "Short";
  if (row.receivedQty > row.orderedQty) return "Over";
  return "Matched";
}
const STATUS_COLOR = { Pending: "#898781", Short: STATUS.warning, Matched: STATUS.good, Over: STATUS.serious, Cancelled: "#c3c2b7" };
const STATUS_OPTIONS = ["Pending", "Short", "Matched", "Over", "Cancelled"];

export default function InventoryManagementPoGrnVariance() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const body = await fetchReport(`/mbuyer/po-item-explorer?${params.toString()}`);
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load PO vs GRN data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search]);

  const rows = useMemo(() => (payload?.data || []).map((r) => ({ ...r, status: lineStatus(r) })), [payload]);
  const filtered = useMemo(() => (status ? rows.filter((r) => r.status === status) : rows), [rows, status]);
  const summary = payload?.summary || { lines: 0, orderedQty: 0, receivedQty: 0, pendingQty: 0 };

  const shortCount = useMemo(() => rows.filter((r) => r.status === "Short").length, [rows]);
  const overCount = useMemo(() => rows.filter((r) => r.status === "Over").length, [rows]);
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "Pending").length, [rows]);

  return (
    <div className="p-6">
      <ReportHeader icon={FaBalanceScale} title="PO vs GRN Variance" subtitle="What every purchase order line asked for, vs. what was actually received." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="PO lines" value={fmtNum(summary.lines)} />
        <StatTile label="Ordered qty" value={fmtNum(summary.orderedQty)} />
        <StatTile label="Received qty" value={fmtNum(summary.receivedQty)} />
        <StatTile label="Pending qty" value={fmtNum(summary.pendingQty)} tone={summary.pendingQty > 0 ? "warning" : "good"} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <label className="text-xs">
          <span className="mb-1 block font-bold text-slate-500">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PO no., vendor, item, barcode…" className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-2.5 text-xs" />
        </label>
        <div className="ml-auto flex gap-3 text-[11px] font-bold">
          {pendingCount > 0 && <span style={{ color: STATUS_COLOR.Pending }}>{pendingCount} not received yet</span>}
          {shortCount > 0 && <span style={{ color: STATUS_COLOR.Short }}>{shortCount} short</span>}
          {overCount > 0 && <span style={{ color: STATUS_COLOR.Over }}>{overCount} over-received</span>}
        </div>
      </div>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {loading ? <LoadingState /> : (
        <SectionCard title="PO line detail" subtitle={`${fmtNum(filtered.length)} line(s)`}>
          {filtered.length ? (
            <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {["PO No.", "Vendor", "Item", "Size / Colour", "Ordered", "Received", "Pending", "Due date", "Status"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">{r.orderNo || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.vendorName || "—"}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 font-semibold text-slate-800">{r.description}</td>
                      <td className="px-3 py-2 text-slate-500">{[r.size, r.color].filter((v) => v && v !== "-").join(" / ") || "—"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtNum(r.orderedQty)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{fmtNum(r.receivedQty)}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtNum(r.pendingQty)}</td>
                      <td className="px-3 py-2 text-slate-500">{r.dueDate || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: STATUS_COLOR[r.status] }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState label="No purchase order lines match these filters." />}
        </SectionCard>
      )}
    </div>
  );
}
