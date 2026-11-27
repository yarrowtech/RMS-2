import Select from "react-select";
import { createElement } from "react";

export function ReportHeader({ icon, title, subtitle, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a78d6]">{createElement(icon, { className: "h-4.5 w-4.5 text-white" })}</div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function StatTile({ label, value, sub, tone = "default" }) {
  const toneClass = {
    default: "text-slate-900",
    good: "text-[#0ca30c]",
    warning: "text-[#b3790f]",
    critical: "text-[#d03b3b]",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function SectionCard({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ label }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{label}</div>;
}

export function LoadingState() {
  return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#2a78d6]" /></div>;
}

export function ErrorState({ message }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</div>;
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="text-xs">
      <span className="mb-1 block font-bold text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function SearchableFilter({ label, value, onChange, options }) {
  return <label className="block min-w-[170px] text-xs">
    <span className="mb-1 block font-bold text-slate-500">{label}</span>
    <Select
      aria-label={label}
      value={value ? { value, label: value } : null}
      onChange={(option) => onChange(option?.value || "")}
      options={options.map((option) => ({ value: option, label: option }))}
      isClearable
      isSearchable
      placeholder={`All ${label.toLowerCase()}s`}
      noOptionsMessage={() => "No matching options"}
      styles={{
        control: (base) => ({ ...base, minHeight: 36, borderColor: "#e2e8f0", borderRadius: 8, fontSize: 12 }),
        menu: (base) => ({ ...base, zIndex: 30, fontSize: 12 }),
      }}
    />
  </label>;
}

export function ReportPagination({ page, totalPages, setPage, count, pageSize = 100 }) {
  if (count <= pageSize) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-3 text-xs text-slate-600">
    <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count.toLocaleString("en-IN")} items</span>
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
      <span>Page {page + 1} of {totalPages}</span>
      <button type="button" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
    </div>
  </div>;
}

export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-bold text-slate-900">{formatter ? formatter(p.value, p.dataKey) : p.value}</span>
        </p>
      ))}
    </div>
  );
}
