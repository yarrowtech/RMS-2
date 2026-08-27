import React from "react";
import ReactDOM from "react-dom";
import { FaQuestionCircle, FaTimes } from "react-icons/fa";

// Shared step-by-step help modal used across the Cashier module (POS,
// Dashboard, Customer records). Each page supplies its own steps/notes —
// this file only owns the shell, so the look stays identical everywhere
// instead of three separately hand-built modals drifting apart over time.
//
// Tailwind can't resolve a class built from a template literal
// (bg-${color}-100) at build time — it only generates CSS for class names
// it can see written out in full somewhere in the source. So every step's
// badgeClass must be a complete, static className string, not a color name
// to interpolate.

const NOTE_TONES = {
  info:    { border: "border-sky-100",    bg: "bg-sky-50",    badge: "bg-sky-100 text-sky-600",       title: "text-sky-900",   text: "text-sky-800" },
  caution: { border: "border-amber-200",  bg: "bg-amber-50",  badge: "bg-amber-100 text-amber-700",   title: "text-amber-900", text: "text-amber-800" },
};

export default function CashierGuideModal({ open, onClose, title, subtitle, steps = [], notes = [] }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <FaQuestionCircle size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <p className="text-[11px] font-semibold text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-xl bg-slate-100 p-3 hover:bg-slate-200">
            <FaTimes size={13} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${step.badgeClass}`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step {i + 1}</p>
                  <p className="text-sm font-black text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.text}</p>
                </div>
              </div>
            );
          })}

          {notes.map((note) => {
            const tone = NOTE_TONES[note.tone] || NOTE_TONES.info;
            const Icon = note.icon;
            return (
              <div key={note.title} className={`flex gap-3 rounded-2xl border ${tone.border} ${tone.bg} p-4`}>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.badge}`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black ${tone.title}`}>{note.title}</p>
                  <p className={`mt-1 text-xs leading-5 ${tone.text}`}>{note.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="w-full cursor-pointer rounded-xl bg-violet-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-violet-700">
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GuideButton({ onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="How to use this page"
      style={{
        width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center",
        border: "1px solid #DDD6FE", background: "#F5F3FF", color: "#7C3AED", cursor: "pointer",
        flexShrink: 0, ...style,
      }}
    >
      <FaQuestionCircle size={14} />
    </button>
  );
}
