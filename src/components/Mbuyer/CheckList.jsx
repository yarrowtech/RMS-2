import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = `${APP_API_URL}/checklist`; // ✅ your FastAPI base

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const makeId = () => `CHK-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isoToDMY = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const emptyCheck = () => ({
  taskDetails: "",
  status: "",
});

export default function CheckList() {
  const [checks, setChecks] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [viewMonth, setViewMonth] = useState(MONTHS[new Date().getMonth()]);
  const [modalName, setModalName] = useState("");
  const [modalMonth, setModalMonth] = useState(MONTHS[new Date().getMonth()]);
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCheck());

  const listDate = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }, []);

  const STATUS = [
    { key: "completed", label: "COMPLETED" },
    { key: "process", label: "UNDER PROCESS" },
    { key: "hold", label: "ON HOLD FOR APPROVAL" },
    { key: "pending", label: "PENDING" },
  ];

  const STATUS_UI = {
    completed: {
      badge: "bg-green-200 text-green-900 border-green-400",
      radio: "border-green-500 bg-green-100",
      dot: "bg-green-700",
    },
    process: {
      badge: "bg-indigo-200 text-indigo-900 border-indigo-400",
      radio: "border-indigo-500 bg-indigo-100",
      dot: "bg-indigo-700",
    },
    hold: {
      badge: "bg-yellow-200 text-yellow-900 border-yellow-400",
      radio: "border-yellow-500 bg-yellow-100",
      dot: "bg-yellow-700",
    },
    pending: {
      badge: "bg-red-200 text-red-900 border-red-400",
      radio: "border-red-500 bg-red-100",
      dot: "bg-red-700",
    },
  };

  const normalizeStatus = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (["completed", "process", "hold", "pending"].includes(s)) return s;
    if (s.includes("complete")) return "completed";
    if (s.includes("under") || s.includes("process")) return "process";
    if (s.includes("hold")) return "hold";
    if (s.includes("pending")) return "pending";
    return "";
  };

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const headerPayload = () => ({
    name: (modalName || "").trim(),
    month: modalMonth,
    date: listDate,
    fromDate,
    toDate,
  });

  // -------------------- API HANDLERS --------------------

  const fetchChecks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/`);
      const data = await res.json();
      setChecks(data || []);
    } catch (err) {
      console.error("Error fetching checklist:", err);
    } finally {
      setLoading(false);
    }
  };

  const createCheck = async (payload) => {
    try {
      await fetch(`${API_BASE}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchChecks();
    } catch (err) {
      console.error("Error creating checklist:", err);
    }
  };

  const updateCheck = async (id, payload) => {
    try {
      await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchChecks();
    } catch (err) {
      console.error("Error updating checklist:", err);
    }
  };

  const deleteCheck = async (id) => {
    const ok = window.confirm("Delete this checklist row?");
    if (!ok) return;
    try {
      await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      setChecks((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Error deleting checklist:", err);
    }
  };

  useEffect(() => {
    fetchChecks();
  }, []);

  // -------------------- MODAL ACTIONS --------------------

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyCheck());
    setModalName("");
    setModalMonth(MONTHS[new Date().getMonth()]);
    setFromDate(todayISO());
    setToDate("");
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      taskDetails: row.taskDetails || "",
      status: normalizeStatus(row.status),
    });
    setModalName(row.name || "");
    setModalMonth(row.month || MONTHS[new Date().getMonth()]);
    setFromDate(todayISO());
    setToDate(row.toDate || "");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingId(null);
    setForm(emptyCheck());
  };

  const saveCheck = async () => {
    const taskDetails = (form.taskDetails || "").trim();
    if (!taskDetails) return;

    const autoFrom = todayISO();
    setFromDate(autoFrom);

    const hp = { ...headerPayload(), fromDate: autoFrom };
    const cleanForm = { ...form, status: normalizeStatus(form.status) };

    const payload = {
      id: editingId || makeId(),
      createdAt: Date.now(),
      updatedAt: editingId ? Date.now() : null,
      ...hp,
      ...cleanForm,
    };

    if (!editingId) await createCheck(payload);
    else await updateCheck(editingId, payload);

    setViewMonth(hp.month);
    closeModal();
  };

  const visibleChecks = useMemo(
    () => checks.filter((x) => (x.month || "") === viewMonth),
    [checks, viewMonth]
  );

  const statusBadge = (key) => {
    const ui = STATUS_UI[key] || {};
    return `inline-flex items-center justify-center px-2 py-1 rounded-md border text-[11px] font-semibold ${
      ui.badge || "bg-gray-50 text-gray-700 border-gray-200"
    }`;
  };

  // -------------------- UI RENDER --------------------

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Check List</h1>
  </div>
        <div className="text-right">
          <button
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            + Add Check List
          </button>
        </div>
      </div>

      <div className="mt-4 bg-[#eef5ff] border border-gray-300 rounded-lg p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-[13px] text-gray-900 font-semibold items-end">
          <div className="md:col-span-4">
            <div className="text-[12px] font-bold text-gray-900 mb-1">MONTH:</div>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-blue-200"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">Check List</div>
          <div className="text-xs text-gray-600">
            Total: <span className="font-semibold">{visibleChecks.length}</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              Loading checklist...
            </div>
          ) : (
            <table className="min-w-[1400px] w-full text-[12px]">
              <thead className="bg-[#dbeafe] text-gray-900 sticky top-0 z-10">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left w-[80px]">SL.NO.</th>
                  <th className="px-3 py-2 text-left w-[180px]">NAME</th>
                  <th className="px-3 py-2 text-left w-[140px]">FROM DATE</th>
                  <th className="px-3 py-2 text-left w-[140px]">TO DATE</th>
                  <th className="px-3 py-2 text-left w-[260px]">TASK DETAILS</th>
                  <th className="px-3 py-2 text-center" colSpan={4}>
                    STATUS OF TASKS (VIEW)
                  </th>
                  <th className="px-3 py-2 text-center w-[140px]">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {visibleChecks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center text-gray-500"
                    >
                      No checklist rows for{" "}
                      <span className="font-semibold">{viewMonth}</span>. Click{" "}
                      <span className="font-semibold">Add Check List</span>.
                    </td>
                  </tr>
                ) : (
                  visibleChecks.map((r, idx) => {
                    const st = normalizeStatus(r.status);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-gray-100 hover:bg-gray-50 align-top"
                      >
                        <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {r.name?.trim() ? r.name : "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {r.fromDate ? isoToDMY(r.fromDate) : "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {r.toDate ? isoToDMY(r.toDate) : "-"}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {r.taskDetails?.trim() ? r.taskDetails : "-"}
                        </td>
                        {STATUS.map((s) => (
                          <td key={s.key} className="px-3 py-2 text-center">
                            {st === s.key ? (
                              <span className={statusBadge(s.key)}>
                                {s.label}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(r)}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-100 font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCheck(r.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b">
              <div className="mt-1 text-[12px] font-bold text-gray-900">
                {editingId ? "Edit Check List" : "Add Check List"}
              </div>
              <button
                onClick={closeModal}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-700 hover:text-red-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* MODAL HEADER */}
            <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="flex items-center gap-2 md:col-span-2">
                <span className="text-[12px] font-semibold text-gray-800">
                  NAME:
                </span>
                <input
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Enter name"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800">
                  MONTH:
                </span>
                <select
                  value={modalMonth}
                  onChange={(e) => setModalMonth(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-gray-200"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800">
                  FROM:
                </span>
                <input
                  type="date"
                  value={fromDate}
                  readOnly
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-[12px] outline-none bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800">
                  TO:
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div className="md:col-span-5">
                <div className="text-[11px] text-gray-800 mt-1">
                  <span className="font-bold">DATE:</span> {listDate}
                </div>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-[#dbeafe] text-gray-900 text-[12px] font-semibold border-b border-gray-200">
                  <div className="col-span-1 px-3 py-2">SL.NO.</div>
                  <div className="col-span-7 px-3 py-2">TASK DETAILS</div>
                  <div className="col-span-4 px-3 py-2 text-center">
                    STATUS OF TASKS
                  </div>
                </div>

                <div className="grid grid-cols-12 text-[12px]">
                  <div className="col-span-1 p-3 border-r border-gray-200 text-gray-700">
                    Auto
                    <div className="text-[10px] text-gray-500">(1,2,3..)</div>
                  </div>

                  <div className="col-span-7 p-3 border-r border-gray-200">
                    <textarea
                      value={form.taskDetails}
                      onChange={(e) => setField("taskDetails", e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                      placeholder="Write task details..."
                    />
                  </div>

                  <div className="col-span-4 p-3">
                    <div className="grid grid-cols-1 gap-2">
                      {STATUS.map((s) => {
                        const selected = normalizeStatus(form.status) === s.key;
                        const ui = STATUS_UI[s.key] || {};
                        return (
                          <label
                            key={s.key}
                            className={[
                              "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition",
                              selected
                                ? `${ui.radio} border-2`
                                : "border-gray-200 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name="status"
                              checked={selected}
                              onChange={() => setField("status", s.key)}
                            />
                            <span
                              className={[
                                "h-2.5 w-2.5 rounded-full",
                                selected ? ui.dot : "bg-gray-300",
                              ].join(" ")}
                            />
                            <span className="text-[12px] font-semibold text-gray-800">
                              {s.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="px-5 py-4 border-t bg-white flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveCheck}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                {editingId ? "Update Check List" : "Save Check List"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
