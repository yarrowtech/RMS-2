// RMS Communication Centre — real chat (Steps 3-4). A slide-over panel:
// left = department channels I can access + my DMs + a New chat picker;
// right = the selected thread. Same
// pull-on-open pattern as the rest of the app (no websocket/polling).
import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Eye, EyeOff, Hash, Maximize2, MessageCircle, Minimize2, Paperclip, Send, Trash2, Users, Volume2, VolumeX, X } from "lucide-react";
import { DEPARTMENT_NAMES } from "../utils/departments.js";

const API_BASE = APP_API_URL;

// Shared by the chat composer below: given the text typed so far and the
// caret position, find an in-progress "@word" being typed (if any) and
// return candidates to suggest, from people already loaded plus the fixed
// department list. Selecting one replaces the "@partial" with "@FullName "
// and records a structured mention (admin_id or department name) — the
// backend notifies from that structured list, never by parsing free text.
function findMentionQuery(text, caret) {
  const upTo = text.slice(0, caret);
  const at = upTo.lastIndexOf("@");
  if (at === -1) return null;
  const between = upTo.slice(at + 1);
  if (/\s{2,}/.test(between) || between.includes("\n")) return null; // typed past it
  return { start: at, query: between.toLowerCase() };
}

export default function InternalChatPanel() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false); // small dropdown by default; toggles to a full-screen inbox
  const [conversations, setConversations] = useState([]);
  const [hiddenConversations, setHiddenConversations] = useState([]);
  const [people, setPeople] = useState([]);
  const [pickingPerson, setPickingPerson] = useState(false);
  const [selected, setSelected] = useState(null); // { type, conversation_key, other_admin_id?, department?, label }
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState([]); // [{ type, value, display }] picked via the @ autocomplete below
  const [mentionSuggest, setMentionSuggest] = useState(null); // { start, query } while typing "@..."
  const [pendingAttachments, setPendingAttachments] = useState([]); // uploaded, waiting to be sent with the next message
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingConversation, setChangingConversation] = useState(false);
  const [coords, setCoords] = useState(null); // { top, right } — computed from the button, panel is portaled to <body>
  const root = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token");
  const request = (path, options = {}) =>
    fetch(`${API_BASE}/api/internal-chat${path}`, {
      // Same reasoning as InternalNotificationBell.jsx: a background poll
      // shouldn't hang for tens of seconds when the backend is slow/down —
      // fail fast so requests don't stack up unbounded.
      signal: AbortSignal.timeout(12000),
      ...options,
      headers: { Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
    });

  // Guards the 20s polling interval below — skip starting a new poll while
  // one is still in flight instead of piling requests on top of each other.
  const pollInFlight = useRef(false);

  const loadConversations = async () => {
    try {
      const r = await request("/conversations");
      const j = await r.json();
      const rows = r.ok && Array.isArray(j.data) ? j.data : [];
      if (r.ok) setConversations(rows);
      return rows;
    } catch {
      return conversations; // network/timeout — keep showing what we already have
    }
  };

  const loadHiddenConversations = async () => {
    const r = await request("/conversations?include_hidden=true");
    const j = await r.json();
    const rows = r.ok && Array.isArray(j.data) ? j.data.filter((row) => row.hidden) : [];
    if (r.ok) setHiddenConversations(rows);
    return rows;
  };

  const fetchPeople = async () => {
    const r = await request("/people");
    const j = await r.json();
    if (r.ok) setPeople(Array.isArray(j.data) ? j.data : []);
  };

  useEffect(() => { loadConversations(); }, []); // for the unread badge, before the panel is even opened
  useEffect(() => {
    // Safe polling fallback until a WebSocket service is introduced.
    const timer = window.setInterval(() => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      loadConversations().finally(() => { pollInFlight.current = false; });
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    loadConversations();
    loadHiddenConversations();
    fetchPeople(); // preloaded so @mentions work in any open conversation
    // Portaled to <body> so it's never clipped by a header's own
    // overflow:hidden (several department headers use it for their
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
  useEffect(() => {
    const openFromNotification = async (event) => {
      const conversationKey = event.detail?.conversationKey;
      if (!conversationKey) return;
      setOpen(true);
      const rows = await loadConversations();
      const conversation = rows.find((row) => row.conversation_key === conversationKey);
      if (conversation) openConversation(conversation);
    };
    window.addEventListener("rms:open-internal-chat", openFromNotification);
    return () => window.removeEventListener("rms:open-internal-chat", openFromNotification);
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight }); }, [messages]);

  const openConversation = async (c) => {
    setSelected(c);
    setPickingPerson(false);
    setDraft("");
    setMentions([]);
    setMentionSuggest(null);
    setPendingAttachments([]);
    setLoading(true);
    try {
      const departmentQuery = c.store_id ? `?store_id=${encodeURIComponent(c.store_id)}` : "";
      const path = c.type === "dm" ? `/dm/${c.other_admin_id}` : `/department/${encodeURIComponent(c.department)}${departmentQuery}`;
      const r = await request(path);
      const j = await r.json();
      if (r.ok) {
        setMessages(Array.isArray(j.data) ? j.data : []);
        if (c.type === "department") {
          setSelected({ ...c, archived: Boolean(j.archived), can_archive: Boolean(j.can_archive) });
        }
      }
      loadConversations(); // opening marks it read server-side; refresh unread badges
    } finally {
      setLoading(false);
    }
  };

  const loadPeople = async () => {
    setPickingPerson(true);
    setSelected(null);
    fetchPeople();
  };

  const mentionSuggestions = useMemo(() => {
    if (!mentionSuggest) return [];
    const q = mentionSuggest.query;
    const peopleMatches = people
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ type: "admin", value: p.id, display: p.name, sub: p.department }));
    const deptMatches = DEPARTMENT_NAMES
      .filter((d) => !q || d.toLowerCase().includes(q))
      .slice(0, 4)
      .map((d) => ({ type: "department", value: d, display: d, sub: "Department" }));
    return [...peopleMatches, ...deptMatches].slice(0, 7);
  }, [mentionSuggest, people]);

  const onDraftChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    setMentionSuggest(findMentionQuery(value, e.target.selectionStart));
  };

  const pickMention = (m) => {
    if (!mentionSuggest) return;
    const before = draft.slice(0, mentionSuggest.start);
    const after = draft.slice(mentionSuggest.start + 1 + mentionSuggest.query.length);
    const inserted = `@${m.display} `;
    setDraft(before + inserted + after);
    setMentions((old) => [...old, { type: m.type, value: m.value, display: `@${m.display}` }]);
    setMentionSuggest(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startDm = (person) => {
    openConversation({ type: "dm", other_admin_id: person.id, label: person.name, department: person.department });
  };

  const uploadFiles = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      [...fileList].forEach((f) => body.append("files", f));
      const r = await fetch(`${API_BASE}/api/internal-notifications/attachments`, {
        method: "POST", headers: { Authorization: `Bearer ${token()}` }, body,
      });
      const j = await r.json();
      if (r.ok) setPendingAttachments((old) => [...old, ...(j.data || [])]);
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if ((!draft.trim() && !pendingAttachments.length) || !selected) return;
    setSending(true);
    try {
      const departmentQuery = selected.store_id ? `?store_id=${encodeURIComponent(selected.store_id)}` : "";
      const path = selected.type === "dm" ? `/dm/${selected.other_admin_id}` : `/department/${encodeURIComponent(selected.department)}${departmentQuery}`;
      // Only send mentions whose "@Name" text is still present — if the user
      // deleted it after inserting, it no longer counts as a mention.
      const liveMentions = mentions.filter((m) => draft.includes(m.display)).map(({ type, value }) => ({ type, value }));
      const r = await request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim(), mentions: liveMentions, attachments: pendingAttachments }),
      });
      if (r.ok) {
        setDraft("");
        setMentions([]);
        setPendingAttachments([]);
        openConversation(selected);
      }
    } finally {
      setSending(false);
    }
  };

  const updatePreference = async (changes) => {
    if (!selected) return false;
    const r = await request("/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_key: selected.conversation_key, ...changes }),
    });
    return r.ok;
  };

  const hideConversation = async () => {
    if (!selected || changingConversation) return;
    setChangingConversation(true);
    try {
      if (await updatePreference({ hidden: true })) {
        setConversations((old) => old.filter((c) => c.conversation_key !== selected.conversation_key));
        setHiddenConversations((old) => [...old.filter((c) => c.conversation_key !== selected.conversation_key), { ...selected, hidden: true }]);
        setSelected(null);
        setMessages([]);
      }
    } finally {
      setChangingConversation(false);
    }
  };

  const unhideConversation = async () => {
    if (!selected || changingConversation) return;
    setChangingConversation(true);
    try {
      if (await updatePreference({ hidden: false })) {
        const restored = { ...selected, hidden: false };
        setSelected(restored);
        setHiddenConversations((old) => old.filter((c) => c.conversation_key !== selected.conversation_key));
        const rows = await loadConversations();
        const refreshed = rows.find((c) => c.conversation_key === restored.conversation_key);
        if (refreshed) setSelected(refreshed);
      }
    } finally {
      setChangingConversation(false);
    }
  };

  const toggleMute = async () => {
    if (!selected || changingConversation) return;
    setChangingConversation(true);
    try {
      const muted = !selected.muted;
      if (await updatePreference({ muted })) {
        setSelected((old) => ({ ...old, muted }));
        setConversations((old) => old.map((c) => c.conversation_key === selected.conversation_key ? { ...c, muted } : c));
      }
    } finally {
      setChangingConversation(false);
    }
  };

  const toggleArchive = async () => {
    if (!selected || selected.type !== "department" || !selected.can_archive || changingConversation) return;
    setChangingConversation(true);
    try {
      const departmentQuery = selected.store_id ? `?store_id=${encodeURIComponent(selected.store_id)}` : "";
      const archived = !selected.archived;
      const r = await request(`/department/${encodeURIComponent(selected.department)}/archive${departmentQuery}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (r.ok) {
        setSelected((old) => ({ ...old, archived }));
        setConversations((old) => old.map((c) => c.conversation_key === selected.conversation_key ? { ...c, archived } : c));
      }
    } finally {
      setChangingConversation(false);
    }
  };

  const unsendMessage = async (message) => {
    if (!message?.is_sender || message.removed || !window.confirm("Remove this message for everyone? A visible audit placeholder will remain.")) return;
    const r = await request(`/messages/${message.id}`, { method: "DELETE" });
    if (r.ok) setMessages((old) => old.map((m) => m.id === message.id ? { ...m, removed: true, message: "", attachments: [] } : m));
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const departmentConversations = conversations.filter((c) => c.type === "department");
  const directConversations = conversations.filter((c) => c.type === "dm");

  const conversationRow = (c) => (
    <button
      key={c.conversation_key}
      onClick={() => openConversation(c)}
      className={`block w-full border-b border-white/10 px-3 py-2.5 text-left transition hover:bg-white/10 ${selected?.conversation_key === c.conversation_key ? "bg-white/15 shadow-[inset_3px_0_0_0_#2dd4bf]" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] font-black text-white">{c.label}</p>
        <span className="flex items-center gap-1">
          {c.muted && <VolumeX size={11} className="text-slate-300" />}
          {c.archived && <Archive size={11} className="text-amber-300" />}
          {c.unread_count > 0 && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white">{c.unread_count}</span>}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-indigo-100/75">{c.last_message || (c.type === "department" ? "Start this department conversation" : "No messages yet")}</p>
    </button>
  );

  const panel = open && (maximized || coords) && (
        <div
          ref={panelRef}
          style={maximized ? undefined : { position: "fixed", top: coords.top, right: coords.right }}
          className={
            maximized
              ? "fixed inset-4 z-[3000] flex overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-[0_30px_90px_rgba(49,46,129,0.35)] sm:inset-8"
              : "z-[3000] flex h-[440px] w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-[0_24px_70px_rgba(49,46,129,0.30)]"
          }
        >
          {/* Conversation list */}
          <div className={`flex shrink-0 flex-col border-r border-indigo-800 bg-gradient-to-b from-indigo-950 via-indigo-900 to-violet-900 ${maximized ? "w-[280px]" : "w-[220px]"}`}>
            <div className="flex items-center justify-between border-b border-white/15 bg-white/5 p-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-100">
                {maximized ? "Communication" : "Chats"}
              </p>
              <button onClick={loadPeople} title="Start a private chat" className="flex items-center gap-1 rounded-lg bg-teal-400/15 px-2 py-1.5 text-[10px] font-black text-teal-200 transition hover:bg-teal-400/25"><Users size={14} /> New</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center gap-1 border-b border-white/10 bg-cyan-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200"><Hash size={11} /> Department channels</div>
              {departmentConversations.map(conversationRow)}
              {!departmentConversations.length && <p className="px-3 py-3 text-[10px] text-indigo-200">No department channel is assigned to you.</p>}
              <div className="flex items-center gap-1 border-y border-white/10 bg-fuchsia-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-200"><Users size={11} /> Direct messages</div>
              {directConversations.map(conversationRow)}
              {!directConversations.length && <button onClick={loadPeople} className="w-full px-3 py-3 text-left text-[10px] font-bold text-teal-200 hover:bg-white/10">Start a private chat</button>}
              {hiddenConversations.length > 0 && (
                <details className="border-t border-white/10">
                  <summary className="cursor-pointer px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:bg-white/10">Hidden chats ({hiddenConversations.length})</summary>
                  {hiddenConversations.map((c) => (
                    <button key={c.conversation_key} onClick={() => openConversation(c)} className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-left text-[11px] font-bold text-slate-200 transition hover:bg-white/10">
                      <Eye size={12} className="shrink-0 text-teal-200" />
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </details>
              )}
            </div>
          </div>

          {/* Thread / people picker */}
          <div className="flex flex-1 flex-col bg-gradient-to-br from-white via-indigo-50/50 to-cyan-50/40">
            <div className="flex items-center justify-between border-b border-indigo-100 bg-white/85 p-2.5 backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-900">
                  {pickingPerson ? "Start a new message" : selected ? selected.label : "Select a conversation"}
                </p>
                {selected?.archived && <p className="text-[9px] font-bold text-amber-600">Archived by HQ · read only</p>}
              </div>
              <div className="flex items-center gap-1">
                {selected && !pickingPerson && (
                  <>
                    {selected.hidden
                      ? <button onClick={unhideConversation} disabled={changingConversation} title="Restore to my chat list" className="p-1 text-teal-600 hover:text-teal-800"><Eye size={14} /></button>
                      : <button onClick={hideConversation} disabled={changingConversation} title="Hide from my chat list" className="p-1 text-slate-400 hover:text-slate-700"><EyeOff size={14} /></button>}
                    <button onClick={toggleMute} disabled={changingConversation} title={selected.muted ? "Unmute conversation" : "Mute conversation"} className={selected.muted ? "p-1 text-amber-500" : "p-1 text-slate-400 hover:text-slate-700"}>{selected.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                    {selected.type === "department" && selected.can_archive && <button onClick={toggleArchive} disabled={changingConversation} title={selected.archived ? "Reopen department channel" : "Archive department channel"} className={selected.archived ? "p-1 text-emerald-600" : "p-1 text-slate-400 hover:text-amber-600"}><Archive size={14} /></button>}
                  </>
                )}
                <button onClick={() => setMaximized((v) => !v)} title={maximized ? "Minimize" : "Full screen"} className="rounded-lg p-1.5 text-indigo-400 transition hover:bg-indigo-50 hover:text-indigo-700">
                  {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><X size={16} /></button>
              </div>
            </div>

            {pickingPerson ? (
              <div className="flex-1 overflow-y-auto p-2">
                {people.map((p) => (
                  <button key={p.id} onClick={() => startDm(p)} className="block w-full rounded-lg p-2 text-left hover:bg-slate-50">
                    <p className="text-xs font-bold text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{(p.departments?.length ? p.departments : [p.department]).join(" · ")}{p.store_name ? ` · ${p.store_name}` : ""}</p>
                  </button>
                ))}
                {!people.length && <p className="p-4 text-center text-[11px] text-slate-400">No one else found.</p>}
              </div>
            ) : selected ? (
              <>
                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`rounded-2xl border p-2.5 shadow-sm ${m.is_sender ? "ml-auto border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white" : "border-indigo-100 bg-white text-slate-700"} ${maximized ? "max-w-[60%]" : "max-w-[85%]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-black ${m.is_sender ? "text-violet-100" : "text-indigo-500"}`}>{m.sender_name}</p>
                        {m.is_sender && !m.removed && m.created_at && Date.now() - new Date(m.created_at).getTime() <= 5 * 60 * 1000 && (
                          <button onClick={() => unsendMessage(m)} title="Remove for everyone (within 5 minutes)" className="text-violet-200 transition hover:text-white"><Trash2 size={12} /></button>
                        )}
                      </div>
                      {m.removed ? <p className="text-xs italic text-slate-400">Message removed by sender</p> : m.message && <p className={`text-xs ${m.is_sender ? "text-white" : "text-slate-700"}`}>{m.message}</p>}
                      {!m.removed && (m.attachments || []).map((a, i) => (
                        a.resource_type === "image" ? (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block">
                            <img src={a.url} alt={a.name} className="max-h-32 rounded-lg border border-slate-200" />
                          </a>
                        ) : (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[11px] font-bold text-violet-600 underline">
                            <Paperclip size={10} /> {a.name || "Attachment"}
                          </a>
                        )
                      ))}
                      <p className={`mt-1 text-[9px] ${m.is_sender ? "text-violet-200" : "text-slate-400"}`}>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</p>
                    </div>
                  ))}
                  {!messages.length && !loading && <p className="p-6 text-center text-xs text-slate-400">No messages yet — say hello.</p>}
                </div>
                <div className="relative border-t border-indigo-100 bg-white/90 p-2.5 backdrop-blur">
                  {selected.archived ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-700">This department channel is archived. Only HQ can reopen it.</p>
                  ) : <>
                  {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-2.5 mb-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {mentionSuggestions.map((m) => (
                        <button
                          key={`${m.type}:${m.value}`}
                          onClick={() => pickMention(m)}
                          className="block w-full border-b border-slate-50 px-3 py-1.5 text-left last:border-0 hover:bg-violet-50"
                        >
                          <p className="text-xs font-bold text-slate-800">{m.display}</p>
                          <p className="text-[10px] text-slate-400">{m.sub}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {pendingAttachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {pendingAttachments.map((a, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                          <Paperclip size={10} /> {a.name}
                          <button onClick={() => setPendingAttachments((old) => old.filter((_, x) => x !== i))} className="text-violet-400 hover:text-violet-700">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach a file" className="rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-2 text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-40">
                      <Paperclip size={14} className={uploading ? "animate-pulse" : ""} />
                    </button>
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={onDraftChange}
                      onKeyDown={(e) => { if (e.key === "Enter" && !mentionSuggestions.length) { e.preventDefault(); send(); } }}
                      placeholder="Type a message... (@ to mention)"
                      className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                    <button onClick={send} disabled={sending || (!draft.trim() && !pendingAttachments.length)} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-white shadow-md shadow-violet-200 transition hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40">
                      <Send size={14} />
                    </button>
                  </div>
                  </>}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-slate-400">
                Choose a department channel on the left, or select <span className="mx-1 inline-flex items-center gap-1 font-bold text-violet-600"><Users size={12} /> New</span> for a private chat.
              </div>
            )}
          </div>
        </div>
  );

  return (
    <div ref={root} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-100 p-2.5 text-indigo-700 shadow-sm transition hover:from-indigo-100 hover:to-violet-200"
        aria-label="Chat"
        title="Chat"
      >
        <MessageCircle size={18} />
        {totalUnread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
