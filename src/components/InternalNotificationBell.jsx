// RMS Communication Centre — Phase 2 foundation. One reusable bell/inbox any
// department screen can drop into its header, same pull-on-click pattern as
// ProcurementNotificationCenter.jsx (no polling, no websocket). Pulls from
// the tenant-scoped /api/internal-notifications endpoints added alongside it.
import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, CheckCheck, Megaphone, RefreshCw, X } from "lucide-react";
import { getActiveDepartment } from "../utils/authRedirect";

const API_BASE = APP_API_URL;
// Mirrors internal_notification_routes.py's FULL_ACCESS_DEPARTMENTS — only
// used here to decide whether to show the composer button; the backend is
// the real gate (a 403 there is the actual enforcement).
const CAN_ANNOUNCE_DEPARTMENTS = new Set(["HQ", "Administrator", "IT", "SUPERADMIN", "Store Owner"]);

export default function InternalNotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ title: "", message: "", priority: "normal" });
  const [posting, setPosting] = useState(false);
  const [coords, setCoords] = useState(null); // { top, right } — computed from the button, panel is portaled to <body>
  const root = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const canAnnounce = CAN_ANNOUNCE_DEPARTMENTS.has(getActiveDepartment());

  const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token");
  const request = (path, options = {}) =>
    fetch(`${API_BASE}/api/internal-notifications${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
    });

  const load = async () => {
    setLoading(true);
    try {
      const r = await request("");
      const j = await r.json();
      if (r.ok) setRows(Array.isArray(j.data) ? j.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // load once on mount, so the badge count shows before the bell is opened
  useEffect(() => {
    // Matches the chat panel's polling fallback so a recipient sees a normal
    // message alert without needing to reload the workspace.
    const timer = window.setInterval(() => { load(); }, 20000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    load();
    // The panel is portaled to <body> so it's never clipped by a header's
    // own overflow:hidden (several department headers use it for their
    // rounded-corner background) — position it under the button ourselves.
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }, [open]);
  useEffect(() => {
    const close = (e) => {
      if (root.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markOne = async (row) => {
    if (!row.read) {
      await request(`/${row.id}/read`, { method: "PATCH" });
      setRows((old) => old.map((n) => (n.id === row.id ? { ...n, read: true } : n)));
    }
    if (row.ref_type === "chat_dm" || row.ref_type === "chat_department") {
      setOpen(false);
      window.dispatchEvent(new CustomEvent("rms:open-internal-chat", {
        detail: { conversationKey: row.ref_id },
      }));
    }
  };
  const markAll = async () => {
    await request("/read-all", { method: "PATCH" });
    setRows((old) => old.map((n) => ({ ...n, read: true })));
  };
  const postAnnouncement = async () => {
    if (!draft.title.trim()) return;
    setPosting(true);
    try {
      const r = await request("/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (r.ok) {
        setDraft({ title: "", message: "", priority: "normal" });
        setComposing(false);
        load();
      }
    } finally {
      setPosting(false);
    }
  };

  const unreadCount = rows.filter((r) => !r.read).length;
  const visible = unreadOnly ? rows.filter((r) => !r.read) : rows;

  const panel = open && coords && (
    <div
      ref={panelRef}
      style={{ position: "fixed", top: coords.top, right: coords.right, zIndex: 9999 }}
      className="w-[360px] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <p className="text-sm font-black text-slate-900">Notifications</p>
              <button onClick={() => setUnreadOnly((v) => !v)} className="text-[10px] font-bold text-violet-600">
                {unreadOnly ? "Show all" : "Unread only"}
              </button>
            </div>
            <div className="flex gap-1">
              {canAnnounce && (
                <button onClick={() => setComposing((v) => !v)} title="New announcement" className="p-2 text-violet-600"><Megaphone size={16} /></button>
              )}
              <button onClick={markAll} title="Mark all read" className="p-2 text-emerald-600"><CheckCheck size={16} /></button>
              <button onClick={load} className="p-2 text-slate-500"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
              <button onClick={() => setOpen(false)} className="p-2 text-slate-500"><X size={16} /></button>
            </div>
          </div>
          {composing && (
            <div className="space-y-2 border-b border-slate-100 bg-violet-50/40 p-3">
              <input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Announcement title"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold outline-none focus:border-violet-400"
              />
              <textarea
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                placeholder="Message (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-400"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button
                  onClick={postAnnouncement}
                  disabled={posting || !draft.title.trim()}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40"
                >
                  {posting ? "Posting..." : "Post to everyone"}
                </button>
              </div>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {visible.map((row) => (
              <button
                key={row.id}
                onClick={() => markOne(row)}
                className={`block w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 ${!row.read ? "bg-violet-50/60" : ""}`}
              >
                <div className="flex gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${row.read ? "bg-slate-200" : "bg-violet-500"}`} />
                  <div>
                    <p className="text-xs font-black text-slate-800">{row.title}</p>
                    {row.message && <p className="mt-1 text-[11px] text-slate-500">{row.message}</p>}
                    <p className="mt-1 text-[9px] text-slate-400">{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</p>
                  </div>
                </div>
              </button>
            ))}
            {!visible.length && !loading && <p className="p-8 text-center text-xs text-slate-400">No notifications</p>}
      </div>
    </div>
  );

  return (
    <div ref={root} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-violet-700 shadow-sm hover:bg-violet-100"
        aria-label="Notifications"
        title="Notifications"
      >
        <BellRing size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
