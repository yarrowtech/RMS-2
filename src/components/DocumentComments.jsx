// RMS Communication Centre — Step 9: a small comment thread attached to one
// specific business record (Tech Pack, wastage exception, purchase invoice,
// PO, GRN, stock transfer, production batch). Deliberately NOT a generic
// chat widget: refType/refId are required, and every comment also raises a
// notification via the bell for the owning department(s) — see
// internal_document_comment_routes.py. Supports @mentions the same way the
// chat panel does (picked from an autocomplete list, not parsed from text).
import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Paperclip, Send } from "lucide-react";
import { DEPARTMENT_NAMES } from "../utils/departments.js";

const API_BASE = APP_API_URL;

function findMentionQuery(text, caret) {
  const upTo = text.slice(0, caret);
  const at = upTo.lastIndexOf("@");
  if (at === -1) return null;
  const between = upTo.slice(at + 1);
  if (/\s{2,}/.test(between) || between.includes("\n")) return null;
  return { start: at, query: between.toLowerCase() };
}

export default function DocumentComments({ refType, refId, title = "Comments" }) {
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState([]);
  const [mentionSuggest, setMentionSuggest] = useState(null);
  const [posting, setPosting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const token = () => localStorage.getItem("admin_token") || localStorage.getItem("token");
  const request = (path, options = {}) =>
    fetch(`${API_BASE}/api/document-comments/${refType}/${refId}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
    });

  const load = async () => {
    if (!refType || !refId) return;
    setLoading(true);
    try {
      const r = await request("");
      const j = await r.json();
      if (r.ok) setRows(Array.isArray(j.data) ? j.data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadPeople = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/internal-chat/people`, { headers: { Authorization: `Bearer ${token()}` } });
      const j = await r.json();
      if (r.ok) setPeople(Array.isArray(j.data) ? j.data : []);
    } catch { /* mentions are a nice-to-have; a failed directory fetch shouldn't block comments */ }
  };

  useEffect(() => { load(); loadPeople(); }, [refType, refId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mentionSuggestions = useMemo(() => {
    if (!mentionSuggest) return [];
    const q = mentionSuggest.query;
    const peopleMatches = people.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 5)
      .map((p) => ({ type: "admin", value: p.id, display: p.name, sub: p.department }));
    const deptMatches = DEPARTMENT_NAMES.filter((d) => !q || d.toLowerCase().includes(q)).slice(0, 4)
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
    setDraft(before + `@${m.display} ` + after);
    setMentions((old) => [...old, { type: m.type, value: m.value, display: `@${m.display}` }]);
    setMentionSuggest(null);
    requestAnimationFrame(() => inputRef.current?.focus());
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

  const post = async () => {
    if (!draft.trim() && !pendingAttachments.length) return;
    setPosting(true);
    try {
      const liveMentions = mentions.filter((m) => draft.includes(m.display)).map(({ type, value }) => ({ type, value }));
      const r = await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim(), mentions: liveMentions, attachments: pendingAttachments }),
      });
      if (r.ok) {
        setDraft("");
        setMentions([]);
        setPendingAttachments([]);
        load();
      }
    } finally {
      setPosting(false);
    }
  };

  if (!refType || !refId) return null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={16} className="text-violet-600" />
        <p className="text-xs font-black uppercase tracking-wide text-violet-700">{title}</p>
      </div>
      <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
        {rows.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-slate-800">{c.author_name || "Someone"} <span className="font-normal text-slate-400">· {c.author_department}</span></p>
              <p className="text-[9px] text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</p>
            </div>
            {c.message && <p className="mt-1 text-xs text-slate-600">{c.message}</p>}
            {(c.attachments || []).map((a, i) => (
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
          </div>
        ))}
        {!rows.length && !loading && <p className="p-3 text-center text-xs text-slate-400">No comments yet.</p>}
      </div>
      <div className="relative">
        {mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
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
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach a file" className="rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
            <Paperclip size={14} className={uploading ? "animate-pulse" : ""} />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={onDraftChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !mentionSuggestions.length) { e.preventDefault(); post(); } }}
            placeholder="Add a comment... (@ to mention)"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={post}
            disabled={posting || (!draft.trim() && !pendingAttachments.length)}
            className="rounded-xl bg-violet-600 px-3 py-2 text-white disabled:opacity-40"
            aria-label="Post comment"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
