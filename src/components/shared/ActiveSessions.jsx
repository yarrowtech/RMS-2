import React, { useCallback, useEffect, useState } from "react";
import { Laptop, LogOut, ShieldAlert } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token") || "";

const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}/auth${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Could not load sessions.");
  return body;
};

const fmt = (iso) => {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export default function ActiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await api("/sessions");
      setSessions(res.sessions || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (sessionId) => {
    if (!window.confirm("Log this device out? It will need to sign in again.")) return;
    setRevokingId(sessionId); setError("");
    try {
      await api(`/sessions/${sessionId}`, { method: "DELETE" });
      await load();
    } catch (e) { setError(e.message); }
    finally { setRevokingId(""); }
  };

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Laptop className="h-5 w-5 text-indigo-600" />
        <div>
          <h2 className="font-black text-slate-900">Active sessions</h2>
          <p className="text-sm text-slate-500">
            Every device currently signed into your account. If you see one you don't recognize, log it out
            and change your password right after.
          </p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No active sessions found.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {sessions.map((s) => (
            <div key={s.session_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  {s.device}
                  {s.is_current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">This device</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Logged in {fmt(s.login_at)} · Last active {fmt(s.last_seen_at)}{s.ip ? ` · ${s.ip}` : ""}
                </p>
              </div>
              {!s.is_current && (
                <button
                  onClick={() => revoke(s.session_id)}
                  disabled={revokingId === s.session_id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sessions.length > 2 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          You're signed in on {sessions.length} devices. If any of these aren't yours, log them out and change your password.
        </div>
      )}
    </section>
  );
}
