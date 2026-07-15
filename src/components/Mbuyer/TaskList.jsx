import React, { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
// import {
//   getAllTasks,
//   createTask,
//   updateTask,
//   deleteTask as apiDelete,
//   uploadTaskFiles,
// } from "../api/tasklist";
import axios from "axios";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const makeId = () => `TSK-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyTask = () => ({
  taskRecdOn: "",
  taskDetails: "",
  communication: "",
  communicationFiles: [],
  imagesFiles: [],
  filesSavedIn: "",
  workTransferredTo: "",
});

//  file -> { id, name, type, url, size }
const toMeta = (file) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: file.name,
  type: file.type || "application/octet-stream",
  size: file.size || 0,
  url: URL.createObjectURL(file),
});

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(MONTHS[new Date().getMonth()]);
  const [modalName, setModalName] = useState("");
  const [modalMonth, setModalMonth] = useState(MONTHS[new Date().getMonth()]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyTask());
  const [preview, setPreview] = useState(null); 
  useEffect(() => {
  fetchTasks();
}, []);

const fetchTasks = async () => {
  try {
    const data = await getAllTasks();
    setTasks(renumber(data));
  } catch (err) {
    console.error("Error fetching tasks", err);
  }
};

  const commInputRef = useRef(null);
  const imgInputRef = useRef(null);
  const listDate = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const renumber = (list) => list.map((t, idx) => ({ ...t, slno: idx + 1 }));
  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const revokeList = (arr) => {
    (arr || []).forEach((m) => {
      try { URL.revokeObjectURL(m.url); } catch {}
    });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyTask());
    setModalName("");
    setModalMonth(MONTHS[new Date().getMonth()]);
    setOpen(true);
  };

  const openEdit = (task) => {
    setEditingId(task.id);
    setForm({
      taskRecdOn: task.taskRecdOn || "",
      taskDetails: task.taskDetails || "",
      communication: task.communication || "",
      communicationFiles: Array.isArray(task.communicationFiles) ? task.communicationFiles : [],
      imagesFiles: Array.isArray(task.imagesFiles) ? task.imagesFiles : [],
      filesSavedIn: task.filesSavedIn || "",
      workTransferredTo: task.workTransferredTo || "",
    });

    setModalName(task.name || "");
    setModalMonth(task.month || MONTHS[new Date().getMonth()]);

    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingId(null);
  };

  const saveTask = async () => {
  const headerPayload = {
    name: modalName.trim(),
    month: modalMonth,
    date: listDate,
    ...form,
  };

  try {
    if (!editingId) {
      // CREATE
      const res = await createTask(headerPayload);
      const newId = res.id;

      // upload files if present
      if (form.communicationFiles.length || form.imagesFiles.length) {
        await uploadTaskFiles(newId, {
          communicationFiles: form.communicationFiles.map((f) => f.raw || f),
          imageFiles: form.imagesFiles.map((f) => f.raw || f),
        });
      }

      await fetchTasks();
    } else {
      // UPDATE
      await updateTask(editingId, headerPayload);
      await fetchTasks();
    }

    setOpen(false);
    setEditingId(null);
  } catch (err) {
    console.error("Error saving task", err);
  }
};
const toMeta = (file) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: file.name,
  type: file.type || "application/octet-stream",
  size: file.size || 0,
  url: URL.createObjectURL(file),
  raw: file, // ✅ Keep original file object for uploading
});


const deleteTask = async (id) => {
  const ok = window.confirm("Delete this task?");
  if (!ok) return;

  try {
    await apiDelete(id);
    await fetchTasks();
  } catch (err) {
    console.error("Error deleting task", err);
  }
};

  const addCommunicationFiles = (files) => {
    const list = Array.from(files || []).map(toMeta);
    setForm((p) => ({
      ...p,
      communicationFiles: [...(p.communicationFiles || []), ...list],
    }));
  };

  const addImagesFiles = (files) => {
    const list = Array.from(files || [])
      .filter((f) => (f.type || "").startsWith("image/"))
      .map(toMeta);
    setForm((p) => ({
      ...p,
      imagesFiles: [...(p.imagesFiles || []), ...list],
    }));
  };

  const removeCommFile = (fid) => {
    setForm((p) => {
      const next = (p.communicationFiles || []).filter((x) => x.id !== fid);
      const removed = (p.communicationFiles || []).find((x) => x.id === fid);
      if (removed?.url) {
        try { URL.revokeObjectURL(removed.url); } catch {}
      }
      return { ...p, communicationFiles: next };
    });
  };

  const removeImgFile = (fid) => {
    setForm((p) => {
      const next = (p.imagesFiles || []).filter((x) => x.id !== fid);
      const removed = (p.imagesFiles || []).find((x) => x.id === fid);
      if (removed?.url) {
        try { URL.revokeObjectURL(removed.url); } catch {}
      }
      return { ...p, imagesFiles: next };
    });
  };

  const isImage = (m) => (m?.type || "").startsWith("image/");

  //  month-wise view list
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => (t.month || "") === viewMonth);
  }, [tasks, viewMonth]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Task List</h1>
  </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          + Add Task
        </button>
      </div>

      {/*  OUTSIDE HEADER month dropdown (same as checklist) */}
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

      {/* Table */}
      <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">Status of Tasks</div>
          <div className="text-xs text-gray-600">
            Total: <span className="font-semibold">{visibleTasks.length}</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-[1650px] w-full text-[12px]">
            <thead className="bg-[#dbeafe] text-gray-900 sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left w-[70px]">SL.NO.</th>
                <th className="px-3 py-2 text-left w-[160px]">NAME</th>
                <th className="px-3 py-2 text-left w-[140px]">TASK RECD ON</th>
                <th className="px-3 py-2 text-left w-[260px]">TASK DETAILS</th>
                <th className="px-3 py-2 text-left w-[320px]">
                  COMMUNICATION DETAILS VIA WHATS APP OR TELEPHONE REGARDING THIS TASK
                </th>
                <th className="px-3 py-2 text-left w-[240px]">IMAGES MESSAGES</th>
                <th className="px-3 py-2 text-left w-[200px]">NAME OF FILES SAVED IN</th>
                <th className="px-3 py-2 text-left w-[220px]">WORK - FILE TRANSFERRED TO</th>
                <th className="px-3 py-2 text-left w-[140px]">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {visibleTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                    No tasks for <span className="font-semibold">{viewMonth}</span>. Click{" "}
                    <span className="font-semibold">Add Task</span>.
                  </td>
                </tr>
              ) : (
                visibleTasks.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 font-semibold">{t.slno}</td>
                    <td className="px-3 py-2 font-semibold">{t.name || "-"}</td>
                    <td className="px-3 py-2">{t.taskRecdOn || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">{t.taskDetails || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="whitespace-pre-wrap">{t.communication || "-"}</div>

                      {Array.isArray(t.communicationFiles) && t.communicationFiles.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {t.communicationFiles.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                              {isImage(m) ? (
                                <button
                                  type="button"
                                  onClick={() => setPreview({ url: m.url, name: m.name })}
                                  className="h-8 w-8 rounded-md overflow-hidden border border-gray-200"
                                  title="Preview"
                                >
                                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                                </button>
                              ) : (
                                <div className="h-8 w-8 rounded-md grid place-items-center border border-gray-200 text-[10px] text-gray-600">
                                  FILE
                                </div>
                              )}

                              <a
                                href={m.url}
                                download={m.name}
                                className="text-[11px] font-semibold text-gray-800 hover:underline max-w-[170px] truncate"
                                title={m.name}
                              >
                                {m.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2">
                      {Array.isArray(t.imagesFiles) && t.imagesFiles.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {t.imagesFiles.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPreview({ url: m.url, name: m.name })}
                              className="h-12 w-12 rounded-lg overflow-hidden border border-gray-200"
                              title={m.name}
                            >
                              <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500">-</div>
                      )}
                    </td>

                    <td className="px-3 py-2 whitespace-pre-wrap">{t.filesSavedIn || "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap">{t.workTransferredTo || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(t)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-100 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {preview ? (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm font-bold text-gray-900 truncate">{preview.name}</div>
              <button
                onClick={() => setPreview(null)}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-700 hover:text-red-600 text-xl"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <img src={preview.url} alt={preview.name} className="w-full max-h-[75vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Add/Edit Modal */}
      {open ? (
        <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b">
              <div className="mt-1 text-[12px] font-bold text-gray-900">
                {editingId ? "Edit Task" : "Add Task"}
              </div>

              <button
                onClick={closeModal}
                className="h-9 w-9 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-700 hover:text-red-600 text-xl"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* modal header (name/month/date) */}
            <div className="px-5 py-3 border-b bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800">NAME:</span>
                <input
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full md:max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="Enter name"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-800">MONTH:</span>
                <select
                  value={modalMonth}
                  onChange={(e) => setModalMonth(e.target.value)}
                  className="w-full md:max-w-xs px-2 py-2 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-gray-200"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-gray-800">
                  <span className="font-bold">DATE:</span> {listDate}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-[#dbeafe] text-gray-900 text-[12px] font-semibold border-b border-gray-200">
                  <div className="col-span-1 px-3 py-2">SL.NO.</div>
                  <div className="col-span-2 px-3 py-2">TASK RECD ON</div>
                  <div className="col-span-3 px-3 py-2">TASK DETAILS</div>
                  <div className="col-span-3 px-3 py-2">
                    COMMUNICATION DETAILS VIA WHATS APP OR TELEPHONE REGARDING THIS TASK
                  </div>
                  <div className="col-span-1 px-3 py-2">IMAGES MESSAGES</div>
                  <div className="col-span-1 px-3 py-2">NAME OF FILES SAVED IN</div>
                  <div className="col-span-1 px-3 py-2">WORK - FILE TRANSFERRED TO</div>
                </div>

                <div className="grid grid-cols-12 text-[12px]">
                  <div className="col-span-1 p-3 border-r border-gray-200 text-gray-700">
                    Auto
                    <div className="text-[10px] text-gray-500">(1,2,3..)</div>
                  </div>

                  <div className="col-span-2 p-3 border-r border-gray-200">
                    <input
                      type="date"
                      value={form.taskRecdOn}
                      onChange={(e) => setField("taskRecdOn", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>

                  <div className="col-span-3 p-3 border-r border-gray-200">
                    <textarea
                      value={form.taskDetails}
                      onChange={(e) => setField("taskDetails", e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                      placeholder="Write task details..."
                    />
                  </div>

                  {/* Communication: text + upload */}
                  <div className="col-span-3 p-3 border-r border-gray-200">
                    <textarea
                      value={form.communication}
                      onChange={(e) => setField("communication", e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                      placeholder="WHATS APP/Call notes, updates, follow-up..."
                    />

                    <input
                      ref={commInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addCommunicationFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => commInputRef.current?.click()}
                        className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[12px] font-semibold"
                      >
                        + Upload (WHATS APP/Call files)
                      </button>
                      <div className="text-[11px] text-gray-500">
                        {form.communicationFiles?.length || 0} attached
                      </div>
                    </div>

                    {form.communicationFiles?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.communicationFiles.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1 bg-white">
                            {isImage(m) ? (
                              <button
                                type="button"
                                onClick={() => setPreview({ url: m.url, name: m.name })}
                                className="h-8 w-8 rounded-md overflow-hidden border border-gray-200"
                                title="Preview"
                              >
                                <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                              </button>
                            ) : (
                              <div className="h-8 w-8 rounded-md grid place-items-center border border-gray-200 text-[10px] text-gray-600">
                                FILE
                              </div>
                            )}

                            <div className="max-w-[180px] truncate text-[11px] font-semibold" title={m.name}>
                              {m.name}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCommFile(m.id)}
                              className="h-7 w-7 grid place-items-center rounded-md hover:bg-red-50 text-red-700"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Images Messages */}
                  <div className="col-span-1 p-3 border-r border-gray-200">
                    <input
                      ref={imgInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        addImagesFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[12px] font-semibold"
                    >
                      + Upload
                    </button>

                    <div className="mt-2 text-[11px] text-gray-500">
                      {form.imagesFiles?.length || 0} images
                    </div>

                    {form.imagesFiles?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.imagesFiles.map((m) => (
                          <div key={m.id} className="relative">
                            <button
                              type="button"
                              onClick={() => setPreview({ url: m.url, name: m.name })}
                              className="h-12 w-12 rounded-lg overflow-hidden border border-gray-200"
                              title={m.name}
                            >
                              <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImgFile(m.id)}
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 text-red-700 grid place-items-center shadow"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-1 p-3 border-r border-gray-200">
                    <textarea
                      value={form.filesSavedIn}
                      onChange={(e) => setField("filesSavedIn", e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                      placeholder="Drive/Folder"
                    />
                  </div>

                  <div className="col-span-1 p-3">
                    <textarea
                      value={form.workTransferredTo}
                      onChange={(e) => setField("workTransferredTo", e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                      placeholder="Person/Dept"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t bg-white flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveTask}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                {editingId ? "Update Task" : "Save Task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
