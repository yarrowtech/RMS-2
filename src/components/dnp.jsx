import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, Factory, FileText, Gauge, Image as ImageIcon, LayoutDashboard, LayoutGrid, List, LogOut, Menu, MessageSquare, Palette, Plus, RefreshCw, Ruler, Search, Send, Settings, X } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";
import { logoutOrReturnToDepartmentSelector, getAdminName, getAdminScope, getStoreName } from "../utils/authRedirect.js";
import TechPackLibrary from "./Production/TechPackLibrary.jsx";
import AdminSettings from "./Admin/AdminSettings.jsx";

const TABS = [
  ["dashboard", "Dashboard", LayoutDashboard], ["research", "Research & Mood Boards", Search], ["themes", "Collections & Themes", Palette], ["projects", "Design Projects", Palette], ["patterns", "Patterns", Ruler],
  ["artwork", "Print & Artwork", FileText], ["samples", "Samples & Approval", ClipboardCheck], ["techpacks", "Tech Packs", BookOpen], ["handoff", "Production Handoff", Factory],
  ["floorops", "Daily Floor Log", Gauge],
  ["queries", "Queries", MessageSquare], ["changes", "Change Control", AlertCircle], ["reports", "Reports", CheckCircle2],
];
const GUIDES={
dashboard:["Review live counts and Production Readiness.","Open the tab connected to any missing item.","Next: start Research or create a Design Project."],
research:["Add season, market, department, tags and findings.","Attach source, image and document links.","Next: turn the approved direction into a Design Project."],
themes:["Create the season/collection direction, palette, customer and mood board; keep it Draft while Design is deciding.","Link Design Projects while the theme is being developed, then Approve it when the creative direction is final.","Next: choose the approved theme in a Tech Pack. Production receives a locked snapshot and can source fabric without editing Design decisions."],
projects:["Create one master project per style and keep its design number unchanged.","Set owner, priority, quantity, cost and launch date; update status as work progresses.","Next: add the first Pattern Version."],
patterns:["Choose the project; record base size, sizes, width, consumption and wastage.","Enter grading as Point | Base | S:value,M:value and upload CAD/DXF/PDF files.","Use Create Revision for V2/V3. Next: develop artwork and sample."],
artwork:["Link the print/embroidery to a project.","Record version, dimensions, placement, technique, colours and file links.","Next: validate it on a sample and include the approved version in the Tech Pack."],
samples:["Choose project, pattern, sample type, assignee, materials, cost and due date.","On receipt, record fit/construction results and the decision.","Approved continues to Tech Pack; Revision/Resample returns to Pattern or Artwork."],
techpacks:["Use the exact Design Project number.","Complete Sketch, Spec Sheet, Details, Artwork, Trims/Labels and Colourways; upload references.","Download/review the PDF. Use a new version for major changes. Next: Handoff."],
handoff:["Confirm approved sample and matching Tech Pack.","Record Design Head approval; Production separately records feasibility.","Choose an existing BOM or auto-create one from pattern consumption, then Release to Production."],
floorops:["Floor workers have no login — a supervisor logs each entry on their behalf; pick a name or type one for a walk-in.","Choose the department first; the form only shows the fields that department needs (set these up under Settings).","Switch to KPI Summary for efficiency, rework, rejection and on-time % by department, worker or style."],
queries:["Select the affected design, category and priority.","Describe one clear technical issue; Design and Production share the same feed.","Resolve with a written answer. Use Change Control if released instructions change."],
changes:["Record reason, previous spec, new spec, and material/cost/delivery impact.","The system identifies affected open job orders.","Production accepts/rejects and acknowledges; accepted changes require a new controlled version."],
reports:["Review release rate, sample cost and revisions.","Balance work using Designer Workload and Deadline Calendar.","Compare target, BOM material and sample cost with matched sales units."]
};
const SUBTITLES = {
  dashboard: "Live status across the design-to-production pipeline.",
  research: "Season, market and trend references for design projects.",
  themes: "Reusable approved creative direction shared with projects, Tech Packs and Production.",
  projects: "One traceable record per style, from idea to production release.",
  patterns: "Controlled pattern, grading and consumption versions.",
  artwork: "Versioned print, embroidery and placement references.",
  samples: "Every sample round and the decision that gates Production.",
  techpacks: "The locked technical reference shared with Production.",
  handoff: "Approvals, feasibility and release to Production.",
  floorops: "Daily shop-floor entries and KPIs — Pattern, Layering, Cutting, Stitching, Embroidery and more.",
  queries: "Technical clarifications shared with Production.",
  changes: "Post-release specification changes and their impact.",
  reports: "Workload, deadlines, cost and sales performance.",
  settings: "Department lists and form defaults used across this workspace.",
};
const DP_UI_STYLES = `
  .dp-workspace { min-height: 100vh; color: #1e293b; background: #f1f5f9; }
  .dp-workspace .dp-sidebar { background: linear-gradient(180deg, #3b0a63 0%, #2e1065 100%); border-right: 1px solid rgba(255,255,255,.06); }
  .dp-workspace .dp-brand { border: 1px solid rgba(233,213,255,.16); background: rgba(233,213,255,.07); }
  .dp-workspace .dp-nav-item { color: #cbb7e8; border-left: 2px solid transparent; border-radius: 0 8px 8px 0; }
  .dp-workspace .dp-nav-item:hover { background: rgba(233,213,255,.10); color: #f5edff; }
  .dp-workspace .dp-nav-item-active { color: #fff; border-left-color: #c084fc; background: rgba(192,132,252,.20); }
  .dp-workspace .dp-nav { scrollbar-width: none; -ms-overflow-style: none; }
  .dp-workspace .dp-nav::-webkit-scrollbar { width: 0; height: 0; display: none; }
  .dp-workspace .dp-content { min-width: 0; }
  .dp-workspace .dp-header { background: rgba(255,255,255,.9); border-bottom: 1px solid #e2e8f0; backdrop-filter: blur(12px); }
`;
const DEPARTMENTS = ["Men", "Women", "Kids Boys", "Kids Girls", "Infant", "Accessories", "Other"];
const DEFAULT_SETTINGS = { departments: DEPARTMENTS, sample_types: ["Proto sample", "Development sample", "Fit sample", "Size-set sample", "Print / embroidery sample", "Wash sample", "Pre-production sample", "Production sample"], default_base_size: "M", default_size_run: "S, M, L, XL", default_wastage_pct: 5, require_sample_approval: true, require_design_head_approval: true, require_production_feasibility: true };
const PROJECT_STATUSES = ["IDEA", "IN_DEVELOPMENT", "PATTERN_DEVELOPMENT", "SAMPLE_DEVELOPMENT", "REVISION_REQUIRED", "AWAITING_APPROVAL", "APPROVED_FOR_PRODUCTION", "ON_HOLD", "REJECTED", "ARCHIVED"];
const SAMPLE_TYPES = ["Proto sample", "Development sample", "Fit sample", "Size-set sample", "Print / embroidery sample", "Wash sample", "Pre-production sample", "Production sample"];
const DECISIONS = ["PENDING", "APPROVED", "APPROVED_WITH_COMMENTS", "REVISION_REQUIRED", "REJECTED", "RESAMPLE_REQUIRED"];
const emptyProject = { design_no:"", style_name:"", department:"Women", category:"", theme_id:"", theme:"", collection:"", season:"", designer:"", target_customer:"", target_cost:"", planned_quantity:"", launch_date:"", priority:"MEDIUM", description:"", moodboard_urls:"", document_urls:"" };
const emptyTheme = { id:"", theme_name:"", collection:"", season:"", department:"Women", target_customer:"", target_date:"", creative_direction:"", palette:"", moodboard_urls:"", document_urls:"" };
const emptyPattern = { project_id:"", pattern_no:"", pattern_name:"", version:"v1", base_size:"M", sizes:"S, M, L, XL", fabric_width:"", consumption_per_unit:"", wastage_pct:"5", marker_length:"", marker_efficiency:"", seam_allowance:"", shrinkage_allowance:"", measurement_rows:"", file_urls:"", notes:"" };
const emptySample = { id:"", project_id:"", pattern_id:"", sample_type:"Development sample", quantity:"1", required_date:"", received_date:"", assigned_to:"", estimated_cost:"", actual_cost:"", materials:"", image_urls:"", decision:"PENDING", fit_result:"", construction_result:"", review_notes:"" };
const emptyQuery = { project_id:"", category:"Measurement clarification", description:"", priority:"MEDIUM", attachment_urls:"" };
const emptyResearch = { id:"", title:"", category:"Fashion trend", season:"", department:"Women", market_segment:"", tags:"", reference_urls:"", notes:"" };
const emptyArtwork = { id:"", project_id:"", name:"", kind:"Print", version:"v1", width:"", height:"", placement:"", technique:"", colours:"", file_urls:"", notes:"", status:"DRAFT" };
const emptyChange = { project_id:"", reason:"", previous_spec:"", new_spec:"", material_impact:"", cost_impact:"", delivery_impact:"", before_urls:"", after_urls:"" };

// ── Daily shop-floor KPI logging ──────────────────────────────────────────
// Floor workers have no login; a supervisor fills this on their behalf. One
// form adapts its fields per department instead of a hardcoded form each.
const DEFAULT_FLOOR_DEPARTMENTS = [
  { name:"Pattern Making", fields:["target_qty","completed_qty","rework_qty","on_time","remarks"], labels:{target_qty:"Target patterns",completed_qty:"Completed patterns",rework_qty:"Rework qty"} },
  { name:"Layering", fields:["fabric_used_mtrs","wastage_mtrs","vendor_name","on_time","remarks"], labels:{fabric_used_mtrs:"Fabric used (mtrs)",wastage_mtrs:"Wastage (mtrs)",vendor_name:"Vendor (fabric source)"} },
  { name:"Cutting", fields:["fabric_used_mtrs","vendor_name","target_qty","completed_qty","rejected_qty","wastage_mtrs","on_time","remarks"], labels:{target_qty:"Target pcs",completed_qty:"Cut pcs",rejected_qty:"Rejected pcs",fabric_used_mtrs:"Fabric used (mtrs)",wastage_mtrs:"Wastage (mtrs)",vendor_name:"Vendor (fabric source)"} },
  { name:"Stitching", fields:["target_qty","completed_qty","rework_qty","rejected_qty","on_time","remarks"], labels:{target_qty:"Target pcs",completed_qty:"Stitched pcs",rework_qty:"Rework pcs",rejected_qty:"Rejected pcs"} },
  { name:"Embroidery", fields:["target_qty","completed_qty","rejected_qty","on_time","remarks"], labels:{target_qty:"Target pcs",completed_qty:"Embroidered pcs",rejected_qty:"Rejected pcs"} },
];
const FLOOR_FIELD_META = {
  target_qty:{label:"Target qty",type:"number"}, completed_qty:{label:"Completed qty",type:"number"},
  rework_qty:{label:"Rework qty",type:"number"}, rejected_qty:{label:"Rejected qty",type:"number"},
  fabric_used_mtrs:{label:"Fabric used (mtrs)",type:"number"}, wastage_mtrs:{label:"Wastage (mtrs)",type:"number"},
  vendor_name:{label:"Vendor (fabric source)",type:"text"}, on_time:{label:"On time",type:"bool"}, remarks:{label:"Remarks",type:"text"},
};
const todayISO = () => new Date().toISOString().slice(0,10);
const emptyFloorLog = () => ({ date:todayISO(), time:"", department:"", worker_id:"", worker_name:"", design_no:"", vendor_name:"", job_work_order_id:"", target_qty:"", completed_qty:"", rework_qty:"", rejected_qty:"", fabric_used_mtrs:"", wastage_mtrs:"", on_time:true, remarks:"" });
const emptyFloorWorker = { name:"", phone:"", departments:[], notes:"" };

function headers(){ const token=localStorage.getItem("admin_token")||localStorage.getItem("access_token")||localStorage.getItem("token")||""; return {"Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{})}; }
async function api(path, options={}){ const response=await fetch(`${API_BASE_URL}/api/design-pattern${path}`,{...options,headers:{...headers(),...(options.headers||{})}}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.detail||"Unable to complete this action."); return data; }
function authOnly(){ const t=localStorage.getItem("admin_token")||localStorage.getItem("access_token")||localStorage.getItem("token")||""; return t?{Authorization:`Bearer ${t}`}:{}; }
async function apiUpload(path, file){ const body=new FormData(); body.append("file", file); const r=await fetch(`${API_BASE_URL}/api/design-pattern${path}`,{method:"POST",headers:authOnly(),body}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.detail||"Upload failed."); return d; }
async function apiDownload(path, filename){ const r=await fetch(`${API_BASE_URL}/api/design-pattern${path}`,{headers:authOnly()}); if(!r.ok) throw new Error("Download failed."); const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
const gradingRows=(text)=>String(text||"").split("\n").map(line=>{const [point,base,raw=""]=line.split("|");return {point:point?.trim(),base_value:base?.trim(),grades:Object.fromEntries(raw.split(",").map(x=>x.split(":").map(v=>v.trim())).filter(x=>x[0]))};}).filter(x=>x.point);
const pretty=(value)=>String(value||"").replaceAll("_"," ").toLowerCase().replace(/\b\w/g,(c)=>c.toUpperCase());
const tone=(status)=> status?.includes("APPROVED")||status?.includes("RELEASED")||status==="RESOLVED"||status==="CLOSED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : status?.includes("REVISION")||status==="REJECTED" ? "bg-rose-50 text-rose-700 ring-rose-200" : status?.includes("AWAITING")||status==="PENDING" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-violet-50 text-violet-700 ring-violet-200";
function Badge({value}){ return <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${tone(value)}`}>{pretty(value)}</span>; }
function Field({label,children,wide=false}){ return <label className={wide?"md:col-span-2":""}><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{React.cloneElement(children,{className:`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 ${children.props.className||""}`})}</label>; }
function Modal({title,onClose,children}){ return <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/50 p-3 backdrop-blur-sm"><section className="max-h-[92vh] w-full max-w-3xl overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4"><h2 className="text-base font-black text-slate-900">{title}</h2><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4"/></button></header>{children}</section></div>; }
function Empty({children}){ return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">{children}</div>; }
function AttachmentEditor({label,value,onChange,accept="image/*"}){const urls=String(value||"").split("\n").map(x=>x.trim()).filter(Boolean);const add=added=>onChange([...urls,...added].join("\n"));const remove=index=>onChange(urls.filter((_,i)=>i!==index).join("\n"));return <div className="md:col-span-2 space-y-2"><AssetUploader label={label} accept={accept} onUploaded={add}/>{urls.length>0&&<div className="flex flex-wrap gap-2">{urls.map((url,index)=><div key={`${url}-${index}`} className="relative"><a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Uploaded attachment" className="h-20 w-20 rounded-xl border bg-slate-100 object-cover"/></a><button type="button" onClick={()=>remove(index)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-xs font-black text-white">×</button></div>)}</div>}<textarea rows="2" value={value} onChange={e=>onChange(e.target.value)} placeholder="Uploaded file URLs appear here; you may also paste one URL per line." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"/></div>}
function TabGuide({tab}){const steps=GUIDES[tab]||[];return <details className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"><AlertCircle className="h-3.5 w-3.5"/>How to use this tab</summary><div className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-3">{steps.map((step,index)=><div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index+1}</span><p>{step}</p></div>)}</div></details>}

// ── Professional shared primitives ───────────────────────────────────────────
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_PRIMARY = `${BTN} bg-violet-600 text-white shadow-sm hover:bg-violet-700`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const BTN_SUBTLE = `${BTN} bg-slate-100 text-slate-700 hover:bg-slate-200`;
const CHIP = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600";

function PageHead({title,subtitle,count,children}){
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><div className="flex items-center gap-2"><h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>{count!=null&&<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{count}</span>}</div>{subtitle&&<p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
    {children&&<div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>;
}
function SearchInput({value,onChange,placeholder="Search…"}){
  return <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex-none sm:w-64">
    <Search className="h-4 w-4 shrink-0 text-slate-400"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"/>
  </label>;
}
function DataTable({columns,rows,empty,onRow}){
  if(!rows.length) return <Empty>{empty}</Empty>;
  const labelled=columns.filter(c=>c.label);
  const unlabelled=columns.filter(c=>!c.label);
  return <>
    <div className="space-y-3 md:hidden">
      {rows.map(r=><div key={r.id||r._k} onClick={onRow?()=>onRow(r):undefined} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${onRow?"cursor-pointer active:bg-violet-50/40":""}`}>
        <dl className="divide-y divide-slate-100">
          {labelled.map(c=><div key={c.key} className="flex items-start justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0">
            <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">{c.label}</dt>
            <dd className={`min-w-0 break-words text-right ${c.strong?"font-bold text-slate-900":"text-slate-600"}`}>{c.render?c.render(r):(r[c.key]||"—")}</dd>
          </div>)}
        </dl>
        {unlabelled.some(c=>c.render&&c.render(r))&&<div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-slate-100 pt-3">{unlabelled.map(c=><React.Fragment key={c.key}>{c.render?c.render(r):null}</React.Fragment>)}</div>}
      </div>)}
    </div>
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {columns.map(c=><th key={c.key} className={`whitespace-nowrap px-4 py-3 ${c.align==="right"?"text-right":""}`}>{c.label}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(r=><tr key={r.id||r._k} onClick={onRow?()=>onRow(r):undefined} className={onRow?"cursor-pointer hover:bg-violet-50/40":"hover:bg-slate-50/60"}>
          {columns.map(c=><td key={c.key} className={`px-4 py-3 align-middle ${c.align==="right"?"text-right":""} ${c.nowrap?"whitespace-nowrap":""} ${c.strong?"font-bold text-slate-900":"text-slate-600"}`}>{c.render?c.render(r):(r[c.key]||"—")}</td>)}
        </tr>)}
      </tbody>
    </table></div></div>
  </>;
}
function MediaGrid({items,empty}){
  if(!items.length) return <Empty>{empty}</Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {items.map(it=><article key={it.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100">
        {it.image?<img src={it.image} alt={it.title} className="h-full w-full object-cover" onError={e=>{e.currentTarget.style.display="none";}}/>:<div className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-9 w-9"/></div>}
        {it.badge&&<div className="absolute left-2 top-2">{it.badge}</div>}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-bold text-slate-900" title={it.title}>{it.title}</p>
        <p className="truncate text-xs text-slate-500">{it.subtitle}</p>
        {it.meta&&<p className="truncate text-[11px] text-slate-400">{it.meta}</p>}
        {it.actions&&<div className="flex flex-wrap gap-1.5 pt-1">{it.actions}</div>}
      </div>
    </article>)}
  </div>;
}
function StatCard({label,value,accent="violet",hint}){
  const bar={violet:"bg-violet-500",cyan:"bg-cyan-500",amber:"bg-amber-500",emerald:"bg-emerald-500",rose:"bg-rose-500"}[accent];
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`block h-1 w-8 rounded-full ${bar}`}/><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p>{hint&&<p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}</article>;
}
function PromptDialog({spec,onClose}){
  const [values,setValues]=useState(()=>Object.fromEntries((spec.fields||[]).map(f=>[f.key,f.default||""])));
  const [busy,setBusy]=useState(false);
  return <Modal title={spec.title} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await spec.onSubmit(values);}finally{setBusy(false);}}} className="space-y-4 p-6">
    {spec.message&&<p className="text-sm text-slate-600">{spec.message}</p>}
    {(spec.fields||[]).map(f=><Field key={f.key} label={f.label}>{f.multiline?<textarea rows="3" required={f.required} value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})} placeholder={f.placeholder}/>:<input required={f.required} value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})} placeholder={f.placeholder}/>}</Field>)}
    <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button><button disabled={busy} className={BTN_PRIMARY}>{busy?"Working…":(spec.confirmText||"Confirm")}</button></div>
  </form></Modal>;
}

export default function DesignPattern(){
  const [active,setActive]=useState("dashboard"), [navOpen,setNavOpen]=useState(false), [data,setData]=useState({themes:[],projects:[],patterns:[],samples:[],queries:[],research:[],artworks:[],change_requests:[],tech_packs:[],material_plans:[]});
  const [loading,setLoading]=useState(true), [error,setError]=useState(""), [notice,setNotice]=useState(""), [modal,setModal]=useState(""), [search,setSearch]=useState("");
  const [settings,setSettings]=useState(null);
  const [projectForm,setProjectForm]=useState(emptyProject), [patternForm,setPatternForm]=useState(emptyPattern), [sampleForm,setSampleForm]=useState(emptySample), [queryForm,setQueryForm]=useState(emptyQuery), [releaseForm,setReleaseForm]=useState({project_id:"",tech_pack_id:"",material_plan_id:""});
  const [researchForm,setResearchForm]=useState(emptyResearch), [themeForm,setThemeForm]=useState(emptyTheme), [artworkForm,setArtworkForm]=useState(emptyArtwork), [changeForm,setChangeForm]=useState(emptyChange);
  const [floorDepts,setFloorDepts]=useState(DEFAULT_FLOOR_DEPARTMENTS), [floorWorkers,setFloorWorkers]=useState([]), [floorLogs,setFloorLogs]=useState([]), [floorKpis,setFloorKpis]=useState(null);
  const [floorSection,setFloorSection]=useState("log"), [floorLoaded,setFloorLoaded]=useState(false);
  const [floorError,setFloorError]=useState("");
  const [floorFilters,setFloorFilters]=useState({date_from:"",date_to:"",department:"",worker_id:"",design_no:""});
  const [floorLogForm,setFloorLogForm]=useState(emptyFloorLog()), [floorWorkerForm,setFloorWorkerForm]=useState(emptyFloorWorker), [floorBulk,setFloorBulk]=useState(null);
  const [prompt,setPrompt]=useState(null), [projView,setProjView]=useState("table"), [sampleFilter,setSampleFilter]=useState("ALL"), [revisionForm,setRevisionForm]=useState(null);
  const load=useCallback(async()=>{ setLoading(true);setError("");try{const [workspace,insights]=await Promise.all([api("/workspace"),api("/insights")]);setData({...workspace,insights:insights.data||[]});api("/settings").then(r=>setSettings(r.data)).catch(()=>setSettings(DEFAULT_SETTINGS));}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const run=async(path,payload,message)=>{try{const result=await api(path,{method:"POST",body:JSON.stringify(payload)});setNotice(result.message||message);setModal("");await load();}catch(e){setError(e.message);}};
  const saveEditable=async(collection,id,payload,message)=>{try{const result=id?await api(`/${collection}/${id}`,{method:"PATCH",body:JSON.stringify(payload)}):await api(`/${collection}`,{method:"POST",body:JSON.stringify(payload)});setNotice(result.message||message);setModal("");await load();}catch(e){setError(e.message);}};
  const loadFloorOps=useCallback(async()=>{try{setFloorError("");const [depts,workers]=await Promise.all([api("/floor-departments"),api("/floor-workers")]);setFloorDepts(depts.data?.length?depts.data:DEFAULT_FLOOR_DEPARTMENTS);setFloorWorkers(workers.data||[]);}catch(e){setFloorError(e.message);}},[]);
  const loadFloorLogs=useCallback(async(filters)=>{try{setFloorError("");const q=new URLSearchParams(Object.entries(filters||{}).filter(([,v])=>v));const [logs,kpis]=await Promise.all([api(`/floor-logs?${q}`),api(`/floor-kpis?date_from=${filters?.date_from||""}&date_to=${filters?.date_to||""}`)]);setFloorLogs(logs.data||[]);setFloorKpis(kpis);}catch(e){setFloorError(e.message);}},[]);
  useEffect(()=>{if(active==="floorops"&&!floorLoaded){setFloorLoaded(true);loadFloorOps();loadFloorLogs(floorFilters);}},[active,floorLoaded,loadFloorOps,loadFloorLogs,floorFilters]);
  const applyFloorFilters=()=>loadFloorLogs(floorFilters);
  const currentFloorDept=floorDepts.find(d=>d.name===floorLogForm.department);
  const currentFloorFields=currentFloorDept?.fields||[];
  const submitFloorLog=async(e)=>{e.preventDefault();try{await api("/floor-logs",{method:"POST",body:JSON.stringify(floorLogForm)});setNotice("Floor log entry saved.");setModal("");setFloorLogForm(emptyFloorLog());await loadFloorLogs(floorFilters);}catch(e2){setFloorError(e2.message);}};
  const submitFloorWorker=async(e)=>{e.preventDefault();try{const result=await api("/floor-workers",{method:"POST",body:JSON.stringify(floorWorkerForm)});setNotice(result.message||"Worker added.");setModal("");setFloorWorkerForm(emptyFloorWorker);await loadFloorOps();}catch(e2){setFloorError(e2.message);}};
  const toggleFloorWorker=async(w)=>{try{await api(`/floor-workers/${w.id}`,{method:"PATCH",body:JSON.stringify({active:!w.active})});await loadFloorOps();}catch(e2){setFloorError(e2.message);}};
  const openFloorBulk=async(fileToUpload)=>{if(!fileToUpload)return;try{setFloorError("");const preview=await apiUpload("/floor-logs/bulk/preview",fileToUpload);setFloorBulk({file:fileToUpload,preview});setModal("floorbulk");}catch(e2){setFloorError(e2.message);}};
  const commitFloorBulk=async()=>{if(!floorBulk?.file)return;try{const r=await apiUpload("/floor-logs/bulk/commit",floorBulk.file);setNotice(r.message||"Floor log imported.");setModal("");setFloorBulk(null);await loadFloorOps();await loadFloorLogs(floorFilters);}catch(e2){setFloorError(e2.message);}};
  const projects=useMemo(()=>data.projects.filter(p=>`${p.design_no} ${p.style_name} ${p.collection} ${p.designer}`.toLowerCase().includes(search.toLowerCase())),[data.projects,search]);
  const projectName=(id)=>{const p=data.projects.find(x=>x.id===id);return p?`${p.design_no} · ${p.style_name}`:"Unknown design";};
  const approvedSamples=new Set(data.samples.filter(s=>["APPROVED","APPROVED_WITH_COMMENTS"].includes(s.decision)).map(s=>s.project_id));
  const stats={active:data.projects.filter(p=>!["RELEASED_TO_PRODUCTION","ARCHIVED","REJECTED"].includes(p.status)).length,patterns:data.patterns.length,pending:data.samples.filter(s=>s.decision==="PENDING").length,approved:data.projects.filter(p=>p.status==="RELEASED_TO_PRODUCTION").length,queries:data.queries.filter(q=>!["RESOLVED","CLOSED"].includes(q.status)).length};
  const cfg = settings || DEFAULT_SETTINGS;
  const deptOptions = cfg.departments?.length ? cfg.departments : DEPARTMENTS;
  const sampleTypeOptions = cfg.sample_types?.length ? cfg.sample_types : DEFAULT_SETTINGS.sample_types;
  const startPattern=(id="")=>{setPatternForm({...emptyPattern,project_id:id,base_size:cfg.default_base_size||emptyPattern.base_size,sizes:cfg.default_size_run||emptyPattern.sizes,wastage_pct:String(cfg.default_wastage_pct ?? emptyPattern.wastage_pct)});setModal("pattern");};
  const openFor=(kind,id)=>{if(kind==="pattern")return startPattern(id);if(kind==="sample")setSampleForm({...emptySample,project_id:id,sample_type:sampleTypeOptions[1]||sampleTypeOptions[0]});if(kind==="query")setQueryForm({...emptyQuery,project_id:id});setModal(kind);};
  const updateStatus=async(project,status)=>{try{await api(`/projects/${project.id}`,{method:"PATCH",body:JSON.stringify({status})});setNotice(`${project.design_no} updated.`);await load();}catch(e){setError(e.message);}};
  const approveTheme=async(theme)=>{if(!window.confirm(`Approve "${theme.theme_name}"? Its creative direction will be locked and released to Production.`))return;try{const result=await api(`/themes/${theme.id}/approve`,{method:"POST"});setNotice(result.message);await load();}catch(e){setError(e.message);}};
  const deleteTheme=async(theme)=>{if(!window.confirm(`Delete unused draft theme "${theme.theme_name}"?`))return;try{const result=await api(`/themes/${theme.id}`,{method:"DELETE"});setNotice(result.message);await load();}catch(e){setError(e.message);}};

  const activeTab = active==="settings" ? ["settings","Settings"] : (TABS.find(([id])=>id===active) || TABS[0]);
  const adminName = getAdminName() || "Design user";
  const workspaceName = getAdminScope()==="hq" ? "Head office workspace" : (getStoreName() || "Store workspace");

  return <div className="dp-workspace lg:flex">
    <style>{DP_UI_STYLES}</style>
    {navOpen&&<button type="button" aria-label="Close menu" onClick={()=>setNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"/>}
    <aside className={`dp-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-[264px] flex-col p-4 text-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-[264px] lg:shrink-0 lg:translate-x-0 ${navOpen?"translate-x-0":"-translate-x-full"}`}>
      <div className="dp-brand rounded-xl p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-black text-white">D&amp;P</div>
          <div className="dp-brand-copy min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300/80">RMS product dev</p>
            <h1 className="truncate text-base font-bold text-white">Design &amp; Pattern</h1>
          </div>
          <button type="button" onClick={()=>setNavOpen(false)} aria-label="Close menu" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-violet-200 hover:bg-white/10 lg:hidden"><X className="h-4 w-4"/></button>
        </div>
        <div className="dp-sidebar-note mt-3.5 border-t border-white/10 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300/70">Signed in as</p>
          <p className="mt-1 truncate text-sm font-semibold text-violet-50">{adminName}</p>
          <p className="mt-0.5 truncate text-xs text-violet-200/70">{workspaceName}</p>
        </div>
      </div>
      <nav className="dp-nav mt-5 flex-1 space-y-0.5 overflow-y-auto pr-1">
        <p className="dp-sidebar-note px-3 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-violet-300/60">Workflow</p>
        {TABS.map(([id,label,TabIcon])=><button key={id} onClick={()=>{setError("");setActive(id);setNavOpen(false);}} title={label} className={`dp-nav-item flex w-full items-center px-3.5 py-2 text-left text-sm font-semibold transition ${active===id?"dp-nav-item-active":""}`}>{React.createElement(TabIcon,{className:"mr-3 h-[17px] w-[17px] shrink-0"})}<span className="dp-nav-label truncate">{label}</span></button>)}
      </nav>
    </aside>
    <main className="dp-content min-h-screen flex-1">
      <header className="dp-header sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 px-4 py-3.5 sm:px-5 lg:px-9">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={()=>setNavOpen(true)} aria-label="Open menu" className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"><Menu className="h-4 w-4"/></button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black tracking-tight text-slate-900">{activeTab[1]}</h2>
            <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">{SUBTITLES[active]}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={load} className={BTN_GHOST}><RefreshCw className="h-4 w-4"/><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={()=>{setError("");setActive("settings");}} title="Settings" aria-label="Settings" className={`inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition ${active==="settings"?"border-violet-300 bg-violet-100 text-violet-700":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><Settings className="h-4 w-4"/></button>
          <button onClick={()=>logoutOrReturnToDepartmentSelector()} className={`${BTN} border border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}><LogOut className="h-4 w-4"/><span className="hidden sm:inline">Log out</span></button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1540px] p-4 sm:p-6 lg:p-9">
        {notice&&<div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ {notice}</div>}{error&&<div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/>{error}</div>}
      {GUIDES[active]&&<TabGuide tab={active}/>}
      {active==="settings"&&<SettingsPanel key={settings?"ready":"loading"} settings={settings} onSaved={(d,m)=>{setSettings(d);setNotice(m||"Settings saved.");setError("");}} onError={setError}/>}
      {active!=="settings"&&(loading?<div className="p-20 text-center text-slate-400">Loading Design & Pattern workspace…</div>:<>
        {active==="dashboard"&&<div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Active designs" value={stats.active} accent="violet"/>
            <StatCard label="Pattern versions" value={stats.patterns} accent="cyan"/>
            <StatCard label="Samples pending" value={stats.pending} accent="amber"/>
            <StatCard label="Released" value={stats.approved} accent="emerald"/>
            <StatCard label="Open queries" value={stats.queries} accent="rose"/>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Pipeline</p>
            <div className="flex flex-wrap gap-2">{PROJECT_STATUSES.map(s=>{const n=data.projects.filter(p=>p.status===s).length;return <div key={s} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${n?"border-violet-200 bg-violet-50 text-violet-700":"border-slate-200 bg-slate-50 text-slate-400"}`}>{pretty(s)} · {n}</div>;})}</div>
          </section>
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">Needs attention</h3><button onClick={()=>{setProjectForm(emptyProject);setModal("project");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>New design</button></div>
          <DataTable columns={[
            {key:"design_no",label:"Design",strong:true,nowrap:true,render:r=>`${r.design_no} · ${r.style_name}`},
            {key:"department",label:"Dept",render:r=>r.department||"—"},
            {key:"sample",label:"Sample",render:r=><span className={`text-xs font-bold ${approvedSamples.has(r.id)?"text-emerald-600":"text-amber-600"}`}>{approvedSamples.has(r.id)?"Approved":"Pending"}</span>},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
          ]} rows={data.projects.filter(p=>!["RELEASED_TO_PRODUCTION","ARCHIVED"].includes(p.status)).slice(0,8)} empty="Nothing waiting — create a design project to begin." onRow={()=>setActive("projects")}/>
        </div>}
        {active==="research"&&<><PageHead title="Research & Mood Boards" subtitle="Season, market and trend references." count={data.research.length}><button onClick={()=>{setResearchForm(emptyResearch);setModal("research");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Add research</button></PageHead>
          <DataTable columns={[
            {key:"title",label:"Title",strong:true},
            {key:"category",label:"Category"},{key:"season",label:"Season"},{key:"department",label:"Department"},
            {key:"tags",label:"Tags",render:r=>(r.tags||[]).slice(0,3).join(", ")||"—"},
            {key:"refs",label:"Refs",align:"right",render:r=>(r.reference_urls||[]).length||"—"},
            {key:"act",label:"",align:"right",render:r=><button onClick={()=>{setResearchForm({...emptyResearch,...r,tags:(r.tags||[]).join(", "),reference_urls:(r.reference_urls||[]).join("\n")});setModal("research");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Edit</button>},
          ]} rows={data.research} empty="No research references yet."/>
        </>}
        {active==="themes"&&<><PageHead title="Collections & Themes" subtitle="Design-owned creative direction; approved records become read-only references for Tech Packs and Production." count={(data.themes||[]).length}><button onClick={()=>{setThemeForm(emptyTheme);setModal("theme");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>New theme</button></PageHead>
          <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950"><b>Ownership rule:</b> Design defines and approves the direction here. Production can then add supplier fabric/swatches and create purchase orders, but cannot change the approved palette, mood board or customer direction.</div>
          {(data.themes||[]).length?<div className="grid gap-4 lg:grid-cols-2">{data.themes.map(theme=>{const draft=(theme.design_status||"DRAFT")==="DRAFT";return <article key={theme.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {(theme.moodboard_urls||[])[0]&&<img src={theme.moodboard_urls[0]} alt={`${theme.theme_name} mood board`} className="h-36 w-full bg-slate-100 object-cover"/>}
            <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{theme.theme_name}</h3><p className="mt-1 text-xs text-slate-500">{[theme.collection,theme.season,theme.department].filter(Boolean).join(" · ")||"Creative details not added yet"}</p></div><Badge value={theme.design_status||"DRAFT"}/></div>
            {theme.creative_direction&&<p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{theme.creative_direction}</p>}
            {(theme.palette||[]).length>0&&<div className="mt-3 flex flex-wrap items-center gap-2">{theme.palette.map((colour,index)=><span key={`${colour}-${index}`} title={colour} className="h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{backgroundColor:colour}}/>)}<span className="text-xs text-slate-400">{theme.palette.join(", ")}</span></div>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">{theme.linked_projects||0} project(s) · {theme.linked_tech_packs||0} Tech Pack(s)</p><div className="flex gap-2">{draft&&<><button onClick={()=>{setThemeForm({...emptyTheme,...theme,palette:(theme.palette||[]).join(", "),moodboard_urls:(theme.moodboard_urls||[]).join("\n"),document_urls:(theme.document_urls||[]).join("\n")});setModal("theme");}} className={`${BTN_SUBTLE} !px-2.5 !py-1.5 text-xs`}>Edit</button><button onClick={()=>approveTheme(theme)} className={`${BTN_PRIMARY} !px-2.5 !py-1.5 text-xs`}>Approve</button><button onClick={()=>deleteTheme(theme)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Delete</button></>}</div></div></div>
          </article>;})}</div>:<Empty>No collection or theme yet. Create the creative direction before starting related Design Projects.</Empty>}
        </>}        {active==="projects"&&<><PageHead title="Design Projects" subtitle="One record per style, idea to release." count={projects.length}>
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button onClick={()=>setProjView("table")} className={`rounded-lg p-1.5 ${projView==="table"?"bg-slate-100 text-slate-900":"text-slate-400"}`}><List className="h-4 w-4"/></button>
            <button onClick={()=>setProjView("board")} className={`rounded-lg p-1.5 ${projView==="board"?"bg-slate-100 text-slate-900":"text-slate-400"}`}><LayoutGrid className="h-4 w-4"/></button>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search designs…"/>
          <button onClick={()=>{setProjectForm(emptyProject);setModal("project");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>New project</button>
        </PageHead>
        {projView==="table"?<DataTable columns={[
          {key:"design_no",label:"Design no.",strong:true,nowrap:true},
          {key:"style_name",label:"Style"},{key:"department",label:"Dept"},{key:"collection",label:"Collection"},{key:"designer",label:"Designer"},
          {key:"priority",label:"Priority",render:r=><span className={CHIP}>{r.priority}</span>},
          {key:"status",label:"Status",render:r=><select value={r.status} onChange={e=>updateStatus(r,e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold">{PROJECT_STATUSES.map(s=><option key={s}>{s}</option>)}</select>},
          {key:"act",label:"",align:"right",render:r=><div className="flex justify-end gap-1.5">
            <button onClick={()=>openFor("pattern",r.id)} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Pattern</button>
            <button onClick={()=>openFor("sample",r.id)} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Sample</button>
            <button onClick={()=>openFor("query",r.id)} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Query</button>
          </div>},
        ]} rows={projects} empty="Create the first design project."/>:<div className="flex gap-3 overflow-x-auto pb-2">{["IDEA","IN_DEVELOPMENT","PATTERN_DEVELOPMENT","SAMPLE_DEVELOPMENT","AWAITING_APPROVAL","RELEASED_TO_PRODUCTION"].map(col=>{const items=projects.filter(p=>p.status===col);return <div key={col} className="w-[80vw] max-w-[16rem] shrink-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:w-64">
          <p className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500">{pretty(col)}<span className="rounded-full bg-white px-1.5 text-slate-400">{items.length}</span></p>
          <div className="space-y-2">{items.map(p=><div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-sm font-bold text-slate-900">{p.design_no}</p><p className="truncate text-xs text-slate-500">{p.style_name}</p><div className="mt-2 flex items-center justify-between"><span className={CHIP}>{p.priority}</span><span className={`text-[11px] font-bold ${approvedSamples.has(p.id)?"text-emerald-600":"text-amber-600"}`}>{approvedSamples.has(p.id)?"Sample ✓":"Sample …"}</span></div></div>)}{!items.length&&<p className="py-3 text-center text-xs text-slate-300">—</p>}</div>
        </div>;})}</div>}
        </>}
        {active==="patterns"&&<><PageHead title="Pattern Versions" subtitle="Controlled pattern, grading and consumption." count={data.patterns.length}><button onClick={()=>startPattern()} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Add pattern</button></PageHead>
          <DataTable columns={[
            {key:"pattern_no",label:"Pattern no.",strong:true,nowrap:true},
            {key:"style",label:"Style",render:r=>projectName(r.project_id)},
            {key:"version",label:"Version"},{key:"base_size",label:"Base"},
            {key:"graded",label:"Graded pts",align:"right",render:r=>r.measurement_rows?.length||0},
            {key:"consumption_per_unit",label:"Consumption",align:"right"},{key:"wastage_pct",label:"Wastage %",align:"right"},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
            {key:"act",label:"",align:"right",render:r=><button onClick={()=>{setRevisionForm({id:r.id,version:`v${(Number(String(r.version).replace(/\D/g,""))||1)+1}`,reason:""});setModal("revision");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Revise</button>},
          ]} rows={data.patterns} empty="No pattern versions yet."/>
        </>}
        {active==="artwork"&&<><PageHead title="Print & Artwork Library" subtitle="Versioned print, embroidery and placement references." count={data.artworks.length}><button onClick={()=>{setArtworkForm(emptyArtwork);setModal("artwork");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Add artwork</button></PageHead>
          <MediaGrid items={data.artworks.map(a=>({id:a.id,image:(a.file_urls||[])[0],title:`${a.name} · ${a.version}`,subtitle:projectName(a.project_id),meta:[a.kind,a.placement,a.technique].filter(Boolean).join(" · "),badge:<Badge value={a.status}/>,actions:<button onClick={()=>{setArtworkForm({...emptyArtwork,...a,file_urls:(a.file_urls||[]).join("\n")});setModal("artwork");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Edit</button>}))} empty="No print or artwork records yet."/>
        </>}
        {active==="samples"&&<><PageHead title="Samples & Approval" subtitle="Every sample round and the decision that gates Production." count={data.samples.length}>
          <select value={sampleFilter} onChange={e=>setSampleFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600"><option value="ALL">All decisions</option>{DECISIONS.map(d=><option key={d} value={d}>{pretty(d)}</option>)}</select>
          <button onClick={()=>{setSampleForm({...emptySample,sample_type:sampleTypeOptions[1]||sampleTypeOptions[0]});setModal("sample");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Review sample</button>
        </PageHead>
          <MediaGrid items={data.samples.filter(s=>sampleFilter==="ALL"||s.decision===sampleFilter).map(s=>({id:s.id,image:(s.image_urls||[])[0],title:`${s.sample_no} · ${s.sample_type}`,subtitle:projectName(s.project_id),meta:`Qty ${s.quantity}${s.assigned_to?` · ${s.assigned_to}`:""}`,badge:<Badge value={s.decision}/>,actions:<button onClick={()=>{setSampleForm({...emptySample,...s,image_urls:(s.image_urls||[]).join("\n")});setModal("sample");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Edit / decision</button>}))} empty="No sample reviews yet."/>
        </>}
        {active==="techpacks"&&<><div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><b className="text-slate-800">Shared with Production.</b> Use the exact design number, approve a sample, then release it from Production Handoff.</div><TechPackLibrary plans={data.material_plans||[]} themes={(data.themes||[]).filter(theme=>theme.design_status==="APPROVED")} onSelectForOrder={()=>{setActive("handoff");setNotice("Tech pack ready — release it below.");}}/></>}
        {active==="handoff"&&<><PageHead title="Production Handoff" subtitle={`Needs a Tech Pack${cfg.require_sample_approval!==false?" + approved sample":""}${cfg.require_design_head_approval!==false?" + Design Head":""}${cfg.require_production_feasibility!==false?" + feasibility":""}. Gates configurable in Settings.`} count={data.projects.length}/>
          <DataTable columns={[
            {key:"design_no",label:"Design",strong:true,nowrap:true,render:r=>`${r.design_no} · ${r.style_name}`},
            {key:"pack",label:"Tech pack",render:r=>{const n=data.tech_packs.filter(t=>t.design_no===r.design_no).length;return n?<span className="font-bold text-emerald-600">✓ {n}</span>:<span className="font-bold text-rose-500">missing</span>;}},
            {key:"sample",label:"Sample",render:r=>approvedSamples.has(r.id)?<span className="font-bold text-emerald-600">✓</span>:<span className="font-bold text-amber-500">…</span>},
            {key:"dh",label:"Design Head",render:r=>{const a=Object.fromEntries((r.approvals||[]).map(x=>[x.type,x.decision]));return a.DESIGN_HEAD==="APPROVED"?<span className="font-bold text-emerald-600">✓</span>:<span className="font-bold text-amber-500">…</span>;}},
            {key:"pf",label:"Feasibility",render:r=>{const a=Object.fromEntries((r.approvals||[]).map(x=>[x.type,x.decision]));return a.PRODUCTION_FEASIBILITY==="APPROVED"?<span className="font-bold text-emerald-600">✓</span>:<span className="font-bold text-amber-500">…</span>;}},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
            {key:"act",label:"",align:"right",render:r=>{const packs=data.tech_packs.filter(t=>t.design_no===r.design_no);const a=Object.fromEntries((r.approvals||[]).map(x=>[x.type,x.decision]));const blockers=[];if(!packs.length)blockers.push("Tech Pack");if(cfg.require_sample_approval!==false&&!approvedSamples.has(r.id))blockers.push("sample");if(cfg.require_design_head_approval!==false&&a.DESIGN_HEAD!=="APPROVED")blockers.push("Design Head");if(cfg.require_production_feasibility!==false&&a.PRODUCTION_FEASIBILITY!=="APPROVED")blockers.push("feasibility");const ready=!blockers.length;if(r.status==="RELEASED_TO_PRODUCTION")return <span className="text-xs font-bold text-emerald-600">Released</span>;return <div className="flex flex-wrap justify-end gap-1.5">
              {a.DESIGN_HEAD!=="APPROVED"&&<button onClick={()=>setPrompt({title:"Design Head approval",message:`${r.design_no} · ${r.style_name}`,fields:[{key:"note",label:"Approval note",multiline:true,default:"Approved for production review"}],confirmText:"Approve",onSubmit:async v=>{await api(`/projects/${r.id}/approval`,{method:"POST",body:JSON.stringify({approval_type:"DESIGN_HEAD",decision:"APPROVED",note:v.note})});setPrompt(null);setNotice("Design Head approval recorded.");await load();}})} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Approve</button>}
              <button disabled={!ready} onClick={()=>{setReleaseForm({project_id:r.id,tech_pack_id:packs[0]?.id||"",material_plan_id:r.material_plan_id||"",force:false,force_reason:""});setModal("release");}} className={`${BTN_PRIMARY} !px-2.5 !py-1 text-xs`}><Send className="h-3 w-3"/>Release</button>
              {!ready&&packs.length>0&&<button onClick={()=>{setReleaseForm({project_id:r.id,tech_pack_id:packs[0]?.id||"",material_plan_id:r.material_plan_id||"",force:true,force_reason:""});setModal("release");}} className={`${BTN} !px-2 !py-1 border border-amber-300 bg-amber-50 text-xs text-amber-700`}>Override</button>}
            </div>;}},
          ]} rows={data.projects} empty="Create a design project first."/>
        </>}
        {active==="floorops"&&<>{floorError&&<div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/><span>{floorError === "Not Found" ? "Daily Floor Log API is not available on the running backend. Restart or redeploy the backend, then refresh this tab." : floorError}</span></div>}<FloorOpsView section={floorSection} setSection={setFloorSection} depts={floorDepts} workers={floorWorkers} logs={floorLogs} kpis={floorKpis} filters={floorFilters} setFilters={setFloorFilters} onApplyFilters={applyFloorFilters} onAddLog={()=>{setFloorLogForm(emptyFloorLog());setModal("floorlog");}} onAddWorker={()=>{setFloorWorkerForm(emptyFloorWorker);setModal("floorworker");}} onToggleWorker={toggleFloorWorker} onUpload={openFloorBulk} onTemplate={()=>apiDownload("/floor-logs/template","daily-floor-log-template.csv").catch(e=>setFloorError(e.message))}/></>}
        {active==="queries"&&<><PageHead title="Design & Production Queries" subtitle="Technical clarifications shared with Production." count={data.queries.length}><button onClick={()=>setModal("query")} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Raise query</button></PageHead>
          <DataTable columns={[
            {key:"query_no",label:"Query no.",strong:true,nowrap:true},
            {key:"style",label:"Design",render:r=>projectName(r.project_id)},
            {key:"category",label:"Category"},
            {key:"priority",label:"Priority",render:r=><span className={CHIP}>{r.priority}</span>},
            {key:"description",label:"Issue",render:r=><span className="block max-w-xs truncate">{r.description}</span>},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
            {key:"act",label:"",align:"right",render:r=>!["RESOLVED","CLOSED"].includes(r.status)?<button onClick={()=>setPrompt({title:`Resolve ${r.query_no}`,message:r.description,fields:[{key:"response",label:"Resolution / clarification",multiline:true,required:true}],confirmText:"Resolve",onSubmit:async v=>{await api(`/queries/${r.id}`,{method:"PATCH",body:JSON.stringify({status:"RESOLVED",response:v.response})});setPrompt(null);setNotice("Query resolved.");await load();}})} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Resolve</button>:(r.response?<span className="text-[11px] font-bold text-emerald-600">answered</span>:"—")},
          ]} rows={data.queries} empty="No open design or production queries."/>
        </>}
        {active==="changes"&&<><PageHead title="Post-release Change Control" subtitle="Specification changes and their material, cost and delivery impact." count={data.change_requests.length}><button onClick={()=>{setChangeForm(emptyChange);setModal("change");}} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Change request</button></PageHead>
          <DataTable columns={[
            {key:"change_no",label:"Change no.",strong:true,nowrap:true},
            {key:"style",label:"Design",render:r=>projectName(r.project_id)},
            {key:"reason",label:"Reason",render:r=><span className="block max-w-xs truncate">{r.reason}</span>},
            {key:"impact",label:"Impact",render:r=>[r.material_impact&&"Material",r.cost_impact&&"Cost",r.delivery_impact&&"Delivery"].filter(Boolean).join(" · ")||"—"},
            {key:"raised_by",label:"Raised by"},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
          ]} rows={data.change_requests} empty="No formal change requests."/>
        </>}
        {active==="reports"&&<Reports data={data} projectName={projectName}/>}
      </>)}
      </div>
    </main>
    {modal==="theme"&&<FormModal title={themeForm.id?"Edit collection / theme":"Create collection / theme"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("themes",themeForm.id,{...themeForm,palette:String(themeForm.palette||"").split(/[,\n]/).map(x=>x.trim()).filter(Boolean),moodboard_urls:String(themeForm.moodboard_urls||"").split("\n").map(x=>x.trim()).filter(Boolean),document_urls:String(themeForm.document_urls||"").split("\n").map(x=>x.trim()).filter(Boolean)},"Collection/theme saved.")}}><div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900"><b>Order:</b> save Draft → link Design Projects → approve when direction is final → select it in the Tech Pack → Production sees the locked snapshot and sources material.</div>
      <Field label="Theme name *"><input required value={themeForm.theme_name} onChange={e=>setThemeForm({...themeForm,theme_name:e.target.value})} placeholder="e.g. Monsoon Earth"/></Field><Field label="Collection"><input value={themeForm.collection} onChange={e=>setThemeForm({...themeForm,collection:e.target.value})} placeholder="e.g. Festive 2027"/></Field>
      <Field label="Season"><input value={themeForm.season} onChange={e=>setThemeForm({...themeForm,season:e.target.value})} placeholder="SS27 / AW27"/></Field><Field label="Department"><select value={themeForm.department} onChange={e=>setThemeForm({...themeForm,department:e.target.value})}>{deptOptions.map(x=><option key={x}>{x}</option>)}</select></Field>
      <Field label="Target customer"><input value={themeForm.target_customer} onChange={e=>setThemeForm({...themeForm,target_customer:e.target.value})} placeholder="Age, price band, occasion or persona"/></Field><Field label="Target completion date"><input type="date" value={themeForm.target_date} onChange={e=>setThemeForm({...themeForm,target_date:e.target.value})}/></Field>
      <Field label="Colour palette (comma separated)" wide><input value={themeForm.palette} onChange={e=>setThemeForm({...themeForm,palette:e.target.value})} placeholder="#7C3AED, terracotta, ivory, forest green"/></Field><Field label="Creative direction / design rules" wide><textarea required rows="5" value={themeForm.creative_direction} onChange={e=>setThemeForm({...themeForm,creative_direction:e.target.value})} placeholder="Silhouette, fabric feel, print direction, trims, exclusions and what must stay consistent."/></Field>
      <AttachmentEditor label="Mood boards and visual references" value={themeForm.moodboard_urls} onChange={v=>setThemeForm({...themeForm,moodboard_urls:v})}/><AttachmentEditor label="Supporting PDFs and documents" accept="image/*,.pdf,.doc,.docx" value={themeForm.document_urls} onChange={v=>setThemeForm({...themeForm,document_urls:v})}/>
    </div></FormModal>}    {modal==="project"&&<FormModal title="Create design project" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/projects",{...projectForm,moodboard_urls:projectForm.moodboard_urls.split("\n").filter(Boolean),document_urls:projectForm.document_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><Field label="Design no. (auto if blank)"><input value={projectForm.design_no} onChange={e=>setProjectForm({...projectForm,design_no:e.target.value})}/></Field><Field label="Style name *"><input required value={projectForm.style_name} onChange={e=>setProjectForm({...projectForm,style_name:e.target.value})}/></Field><Field label="Department"><select value={projectForm.department} onChange={e=>setProjectForm({...projectForm,department:e.target.value})}>{deptOptions.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Collection / theme (optional)"><select value={projectForm.theme_id} onChange={e=>{const theme=(data.themes||[]).find(item=>item.id===e.target.value);setProjectForm({...projectForm,theme_id:e.target.value,theme:theme?.theme_name||projectForm.theme,collection:theme?.collection||projectForm.collection,season:theme?.season||projectForm.season,department:theme?.department||projectForm.department,target_customer:theme?.target_customer||projectForm.target_customer});}}><option value="">No linked theme</option>{(data.themes||[]).map(theme=><option key={theme.id} value={theme.id}>{theme.theme_name} · {pretty(theme.design_status||"DRAFT")}</option>)}</select></Field><Field label="Theme text (manual / legacy)"><input value={projectForm.theme} onChange={e=>setProjectForm({...projectForm,theme:e.target.value})}/></Field>{["category","collection","season","designer","target_customer"].map(k=><Field key={k} label={pretty(k)}><input value={projectForm[k]} onChange={e=>setProjectForm({...projectForm,[k]:e.target.value})}/></Field>)}<Field label="Planned quantity"><input type="number" min="0" value={projectForm.planned_quantity} onChange={e=>setProjectForm({...projectForm,planned_quantity:e.target.value})}/></Field><Field label="Target cost"><input type="number" min="0" value={projectForm.target_cost} onChange={e=>setProjectForm({...projectForm,target_cost:e.target.value})}/></Field><Field label="Launch date"><input type="date" value={projectForm.launch_date} onChange={e=>setProjectForm({...projectForm,launch_date:e.target.value})}/></Field><Field label="Priority"><select value={projectForm.priority} onChange={e=>setProjectForm({...projectForm,priority:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></Field><Field label="Design brief" wide><textarea rows="3" value={projectForm.description} onChange={e=>setProjectForm({...projectForm,description:e.target.value})}/></Field><AttachmentEditor label="Attach sketches, inspiration and mood-board images" value={projectForm.moodboard_urls} onChange={v=>setProjectForm({...projectForm,moodboard_urls:v})}/><AttachmentEditor label="Attach design documents" accept="image/*,.pdf,.doc,.docx" value={projectForm.document_urls} onChange={v=>setProjectForm({...projectForm,document_urls:v})}/></div></FormModal>}
    {modal==="pattern"&&<FormModal title="Add pattern version" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/patterns",{...patternForm,sizes:patternForm.sizes.split(",").map(x=>x.trim()).filter(Boolean),measurement_rows:gradingRows(patternForm.measurement_rows),file_urls:patternForm.file_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={patternForm.project_id} onChange={v=>setPatternForm({...patternForm,project_id:v})} projects={data.projects}/>{["pattern_no","pattern_name","version","base_size","sizes","fabric_width","consumption_per_unit","wastage_pct","marker_length","marker_efficiency","seam_allowance","shrinkage_allowance"].map(k=><Field key={k} label={pretty(k)}><input required={["pattern_name","version"].includes(k)} type={["consumption_per_unit","wastage_pct","marker_efficiency"].includes(k)?"number":"text"} value={patternForm[k]} onChange={e=>setPatternForm({...patternForm,[k]:e.target.value})}/></Field>)}<Field label="Measurement grading (Point | Base | S:36,M:38...)" wide><textarea rows="4" value={patternForm.measurement_rows} onChange={e=>setPatternForm({...patternForm,measurement_rows:e.target.value})} placeholder={'Chest | 40 | S:36, M:38, L:40, XL:42\nLength | 28 | S:27, M:28, L:29, XL:30'}/></Field><AssetUploader label="Upload CAD / DXF / PDF files" onUploaded={urls=>setPatternForm({...patternForm,file_urls:[patternForm.file_urls,...urls].filter(Boolean).join("\n")})}/><Field label="Technical file links" wide><textarea rows="2" value={patternForm.file_urls} onChange={e=>setPatternForm({...patternForm,file_urls:e.target.value})}/></Field><Field label="Pattern / grading notes" wide><textarea rows="3" value={patternForm.notes} onChange={e=>setPatternForm({...patternForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="sample"&&<FormModal title={sampleForm.id?"Update sample review":"Record sample request / review"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("samples",sampleForm.id,{...sampleForm,image_urls:sampleForm.image_urls.split("\n").filter(Boolean)},"Sample saved.")}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={sampleForm.project_id} onChange={v=>setSampleForm({...sampleForm,project_id:v})} projects={data.projects}/><Field label="Pattern version"><select value={sampleForm.pattern_id} onChange={e=>setSampleForm({...sampleForm,pattern_id:e.target.value})}><option value="">No pattern linked</option>{data.patterns.filter(p=>p.project_id===sampleForm.project_id).map(p=><option key={p.id} value={p.id}>{p.pattern_no} · {p.version}</option>)}</select></Field><Field label="Sample type"><select value={sampleForm.sample_type} onChange={e=>setSampleForm({...sampleForm,sample_type:e.target.value})}>{sampleTypeOptions.map(x=><option key={x}>{x}</option>)}</select></Field>{["quantity","required_date","received_date","assigned_to","estimated_cost","actual_cost"].map(k=><Field key={k} label={pretty(k)}><input type={k.includes("date")?"date":["quantity","estimated_cost","actual_cost"].includes(k)?"number":"text"} value={sampleForm[k]} onChange={e=>setSampleForm({...sampleForm,[k]:e.target.value})}/></Field>)}<Field label="Decision"><select value={sampleForm.decision} onChange={e=>setSampleForm({...sampleForm,decision:e.target.value})}>{DECISIONS.map(x=><option key={x}>{x}</option>)}</select></Field>{["materials","fit_result","construction_result"].map(k=><Field key={k} label={pretty(k)}><input value={sampleForm[k]} onChange={e=>setSampleForm({...sampleForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach front, back, side and fit-review photos" value={sampleForm.image_urls} onChange={v=>setSampleForm({...sampleForm,image_urls:v})}/><Field label="Review / correction notes" wide><textarea required rows="3" value={sampleForm.review_notes} onChange={e=>setSampleForm({...sampleForm,review_notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="query"&&<FormModal title="Raise design query" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/queries",{...queryForm,attachment_urls:queryForm.attachment_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={queryForm.project_id} onChange={v=>setQueryForm({...queryForm,project_id:v})} projects={data.projects}/><Field label="Category"><select value={queryForm.category} onChange={e=>setQueryForm({...queryForm,category:e.target.value})}>{["Measurement clarification","Pattern file missing","Fabric specification","Artwork placement","Trim unavailable","Consumption concern","Construction feasibility","Other"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Priority"><select value={queryForm.priority} onChange={e=>setQueryForm({...queryForm,priority:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></Field><Field label="Question / issue" wide><textarea required rows="4" value={queryForm.description} onChange={e=>setQueryForm({...queryForm,description:e.target.value})}/></Field><AttachmentEditor label="Attach issue photos or screenshots" value={queryForm.attachment_urls} onChange={v=>setQueryForm({...queryForm,attachment_urls:v})}/></div></FormModal>}
    {modal==="release"&&<FormModal title={releaseForm.force?"Release without full sign-off":"Release approved design to Production"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run(`/projects/${releaseForm.project_id}/release`,releaseForm)}}><div className="space-y-4">{releaseForm.force?<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Override:</b> one or more handoff gates are not met. This still locks the Tech Pack for Production; the reason below is saved on the record.</div>:<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">This locks the selected Tech Pack as the Production reference. Active job orders retain their own snapshot.</div>}{releaseForm.force&&<Field label="Reason for releasing without sign-off *"><textarea required rows="2" value={releaseForm.force_reason||""} onChange={e=>setReleaseForm({...releaseForm,force_reason:e.target.value})} placeholder="e.g. simple restyle of an existing production style, urgent reorder"/></Field>}<Field label="Approved tech pack"><select required value={releaseForm.tech_pack_id} onChange={e=>setReleaseForm({...releaseForm,tech_pack_id:e.target.value})}>{data.tech_packs.filter(t=>t.design_no===data.projects.find(p=>p.id===releaseForm.project_id)?.design_no).map(t=><option key={t.id} value={t.id}>{t.tech_pack_no} · {t.version}</option>)}</select></Field><Field label="Style BOM / material plan"><select value={releaseForm.material_plan_id} onChange={e=>setReleaseForm({...releaseForm,material_plan_id:e.target.value,auto_create_bom:false})}><option value="">No existing BOM selected</option>{data.material_plans.map(p=><option key={p.id} value={p.id}>{p.plan_no} · {p.style_name}</option>)}</select></Field><label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={Boolean(releaseForm.auto_create_bom)} onChange={e=>setReleaseForm({...releaseForm,auto_create_bom:e.target.checked,material_plan_id:e.target.checked?"":releaseForm.material_plan_id})}/><span><b>Automatically create Style BOM</b><br/><span className="text-slate-500">Uses planned quantity and the latest pattern consumption/wastage.</span></span></label>{releaseForm.auto_create_bom&&<Field label="Main material name"><input value={releaseForm.material_name||""} onChange={e=>setReleaseForm({...releaseForm,material_name:e.target.value})} placeholder="Main fabric"/></Field>}</div></FormModal>}
    {modal==="research"&&<FormModal title={researchForm.id?"Update research reference":"Add research reference"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("research",researchForm.id,{...researchForm,tags:researchForm.tags.split(",").map(x=>x.trim()).filter(Boolean),reference_urls:researchForm.reference_urls.split("\n").filter(Boolean)},"Research reference saved.")}}><div className="grid gap-4 md:grid-cols-2">{["title","category","season","market_segment"].map(k=><Field key={k} label={pretty(k)}><input required={k==="title"} value={researchForm[k]} onChange={e=>setResearchForm({...researchForm,[k]:e.target.value})}/></Field>)}<Field label="Department"><select value={researchForm.department} onChange={e=>setResearchForm({...researchForm,department:e.target.value})}>{deptOptions.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Tags (comma separated)"><input value={researchForm.tags} onChange={e=>setResearchForm({...researchForm,tags:e.target.value})}/></Field><AttachmentEditor label="Attach mood-board images and research documents" accept="image/*,.pdf" value={researchForm.reference_urls} onChange={v=>setResearchForm({...researchForm,reference_urls:v})}/><Field label="Research findings" wide><textarea rows="4" value={researchForm.notes} onChange={e=>setResearchForm({...researchForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="artwork"&&<FormModal title={artworkForm.id?"Update artwork":"Add print or artwork"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("artworks",artworkForm.id,{...artworkForm,file_urls:artworkForm.file_urls.split("\n").filter(Boolean)},"Artwork saved.")}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={artworkForm.project_id} onChange={v=>setArtworkForm({...artworkForm,project_id:v})} projects={data.projects}/>{["name","kind","version","width","height","placement","technique","colours","status"].map(k=><Field key={k} label={pretty(k)}><input required={k==="name"} value={artworkForm[k]} onChange={e=>setArtworkForm({...artworkForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach artwork previews and source files" accept="image/*,.pdf,.ai,.psd,.cdr" value={artworkForm.file_urls} onChange={v=>setArtworkForm({...artworkForm,file_urls:v})}/><Field label="Instructions" wide><textarea rows="3" value={artworkForm.notes} onChange={e=>setArtworkForm({...artworkForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="change"&&<FormModal title="Create formal change request" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/change-requests",{...changeForm,before_urls:changeForm.before_urls.split("\n").filter(Boolean),after_urls:changeForm.after_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={changeForm.project_id} onChange={v=>setChangeForm({...changeForm,project_id:v})} projects={data.projects}/>{["reason","previous_spec","new_spec","material_impact","cost_impact","delivery_impact"].map(k=><Field key={k} label={pretty(k)} wide={["reason","previous_spec","new_spec"].includes(k)}><textarea required={["reason","previous_spec","new_spec"].includes(k)} rows="2" value={changeForm[k]} onChange={e=>setChangeForm({...changeForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach photos of the current specification" value={changeForm.before_urls} onChange={v=>setChangeForm({...changeForm,before_urls:v})}/><AttachmentEditor label="Attach marked-up or proposed revision images" value={changeForm.after_urls} onChange={v=>setChangeForm({...changeForm,after_urls:v})}/></div></FormModal>}
    {modal==="floorlog"&&<FormModal title="Log a floor entry" onClose={()=>setModal("")} onSubmit={submitFloorLog}>
      <div className="mb-4 rounded-xl bg-violet-50 p-3 text-xs text-violet-900">Floor workers have no login — fill this in on their behalf. Pick a name from the directory, or type a walk-in's name below.</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date"><input type="date" required value={floorLogForm.date} onChange={e=>setFloorLogForm({...floorLogForm,date:e.target.value})}/></Field>
        <Field label="Time"><input type="time" value={floorLogForm.time} onChange={e=>setFloorLogForm({...floorLogForm,time:e.target.value})}/></Field>
        <Field label="Department *"><select required value={floorLogForm.department} onChange={e=>setFloorLogForm({...floorLogForm,department:e.target.value})}><option value="">Select department</option>{floorDepts.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}</select></Field>
        <Field label="Worker (from directory)"><select value={floorLogForm.worker_id} onChange={e=>{const w=floorWorkers.find(x=>x.id===e.target.value);setFloorLogForm({...floorLogForm,worker_id:e.target.value,worker_name:w?w.name:floorLogForm.worker_name});}}><option value="">— Not in directory, type below —</option>{floorWorkers.filter(w=>w.active!==false).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="Worker name *"><input required value={floorLogForm.worker_name} onChange={e=>setFloorLogForm({...floorLogForm,worker_name:e.target.value,worker_id:""})} placeholder="Full name"/></Field>
        <Field label="Style / Design no."><input list="dp-floor-design-list" value={floorLogForm.design_no} onChange={e=>setFloorLogForm({...floorLogForm,design_no:e.target.value})}/></Field>
        <Field label="Job Work Order # (blank for in-house staff)"><input value={floorLogForm.job_work_order_id} onChange={e=>setFloorLogForm({...floorLogForm,job_work_order_id:e.target.value})} placeholder="Only if this is a job worker's output"/></Field>
        {!currentFloorFields.length&&<p className="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">Choose a department to see its fields.</p>}
        {currentFloorFields.map(key=>{
          const meta=FLOOR_FIELD_META[key]||{label:pretty(key),type:"text"};
          const label=currentFloorDept?.labels?.[key]||meta.label;
          if(key==="remarks") return <Field key={key} label={label} wide><textarea rows="2" value={floorLogForm.remarks} onChange={e=>setFloorLogForm({...floorLogForm,remarks:e.target.value})}/></Field>;
          if(key==="on_time") return <Field key={key} label={label}><select value={floorLogForm.on_time?"yes":"no"} onChange={e=>setFloorLogForm({...floorLogForm,on_time:e.target.value==="yes"})}><option value="yes">Yes</option><option value="no">No</option></select></Field>;
          if(meta.type==="number") return <Field key={key} label={label}><input type="number" min="0" step="0.01" value={floorLogForm[key]} onChange={e=>setFloorLogForm({...floorLogForm,[key]:e.target.value})}/></Field>;
          return <Field key={key} label={label}><input value={floorLogForm[key]} onChange={e=>setFloorLogForm({...floorLogForm,[key]:e.target.value})}/></Field>;
        })}
      </div>
      <datalist id="dp-floor-design-list">{data.projects.map(p=><option key={p.id} value={p.design_no}/>)}</datalist>
    </FormModal>}
    {modal==="floorworker"&&<FormModal title="Add floor worker" onClose={()=>setModal("")} onSubmit={submitFloorWorker}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name *"><input required value={floorWorkerForm.name} onChange={e=>setFloorWorkerForm({...floorWorkerForm,name:e.target.value})}/></Field>
        <Field label="Phone (optional)"><input value={floorWorkerForm.phone} onChange={e=>setFloorWorkerForm({...floorWorkerForm,phone:e.target.value})}/></Field>
        <Field label="Departments this worker does" wide><div className="flex flex-wrap gap-2">{floorDepts.map(d=><label key={d.name} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={floorWorkerForm.departments.includes(d.name)} onChange={e=>setFloorWorkerForm({...floorWorkerForm,departments:e.target.checked?[...floorWorkerForm.departments,d.name]:floorWorkerForm.departments.filter(x=>x!==d.name)})}/>{d.name}</label>)}</div></Field>
        <Field label="Notes" wide><textarea rows="2" value={floorWorkerForm.notes} onChange={e=>setFloorWorkerForm({...floorWorkerForm,notes:e.target.value})}/></Field>
      </div>
    </FormModal>}
    {modal==="floorbulk"&&floorBulk?.preview&&<Modal title="Import daily floor log" onClose={()=>{setModal("");setFloorBulk(null);}}>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">{[["Rows in file",floorBulk.preview.summary.row_count],["Will import",floorBulk.preview.summary.valid_count],["Will skip",floorBulk.preview.summary.invalid_count]].map(([l,v])=><div key={l} className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{l}</p><p className="mt-1 text-2xl font-black text-slate-900">{v}</p></div>)}</div>
        {floorBulk.preview.summary.new_workers?.length>0&&<p className="rounded-xl bg-violet-50 p-3 text-xs text-violet-800"><b>{floorBulk.preview.summary.new_workers.length} new worker(s)</b> will be added to the directory: {floorBulk.preview.summary.new_workers.join(", ")}</p>}
        {(()=>{const bad=floorBulk.preview.rows.filter(r=>r.errors.length);return bad.length?<div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50 text-left font-black uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Worker</th><th className="px-3 py-2">Problem</th></tr></thead><tbody className="divide-y divide-slate-100">{bad.slice(0,50).map(r=><tr key={r.row_no}><td className="px-3 py-2">{r.row_no}</td><td className="px-3 py-2">{r.worker_name||"—"}</td><td className="px-3 py-2 text-rose-600">{r.errors.join("; ")}</td></tr>)}</tbody></table>{bad.length>50&&<p className="p-2 text-center text-[11px] text-slate-400">{bad.length-50} more problem row(s) not shown</p>}</div>:<p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Every row is valid.</p>;})()}
        <p className="text-xs text-slate-400">Nothing is written until you press Import. Skipped rows are not saved — fix them in the sheet and upload again.</p>
        <div className="flex justify-end gap-3"><button onClick={()=>{setModal("");setFloorBulk(null);}} className={BTN_GHOST}>Cancel</button><button disabled={!floorBulk.preview.summary.valid_count} onClick={commitFloorBulk} className={BTN_PRIMARY}>Import {floorBulk.preview.summary.valid_count} row(s)</button></div>
      </div>
    </Modal>}
    {modal==="revision"&&revisionForm&&<FormModal title="Create pattern revision" onClose={()=>{setModal("");setRevisionForm(null);}} onSubmit={e=>{e.preventDefault();run(`/patterns/${revisionForm.id}/revision`,{version:revisionForm.version,reason:revisionForm.reason||"Technical revision"},"Pattern revision created.");setRevisionForm(null);}}>
      <div className="grid gap-4">
        <Field label="New version *"><input required value={revisionForm.version} onChange={e=>setRevisionForm({...revisionForm,version:e.target.value})}/></Field>
        <Field label="Revision reason"><textarea rows="3" value={revisionForm.reason} onChange={e=>setRevisionForm({...revisionForm,reason:e.target.value})} placeholder="What changed and why"/></Field>
      </div>
    </FormModal>}
    {prompt&&<PromptDialog spec={prompt} onClose={()=>setPrompt(null)}/>}
  </div>;
}

function SettingsPanel({settings,onSaved,onError}){
  const base=settings||DEFAULT_SETTINGS;
  const [section,setSection]=useState("workflow");
  const [form,setForm]=useState({
    departments:(base.departments||[]).join("\n"),
    sample_types:(base.sample_types||[]).join("\n"),
    default_base_size:base.default_base_size||"M",
    default_size_run:base.default_size_run||"S, M, L, XL",
    default_wastage_pct:String(base.default_wastage_pct??5),
    require_sample_approval:base.require_sample_approval!==false,
    require_design_head_approval:base.require_design_head_approval!==false,
    require_production_feasibility:base.require_production_feasibility!==false,
  });
  const [saving,setSaving]=useState(false);
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  const save=async()=>{
    setSaving(true);
    try{
      const payload={
        departments:form.departments.split("\n").map(value=>value.trim()).filter(Boolean),
        sample_types:form.sample_types.split("\n").map(value=>value.trim()).filter(Boolean),
        default_base_size:form.default_base_size.trim(),
        default_size_run:form.default_size_run.trim(),
        default_wastage_pct:Number(form.default_wastage_pct)||0,
        require_sample_approval:form.require_sample_approval,
        require_design_head_approval:form.require_design_head_approval,
        require_production_feasibility:form.require_production_feasibility,
      };
      const result=await api("/settings",{method:"PUT",body:JSON.stringify(payload)});
      onSaved(result.data,result.message);
    }catch(error){onError(error.message);}
    finally{setSaving(false);}
  };
  const box="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
  const labelClass="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500";
  const sectionButton=(value)=>"rounded-xl px-4 py-2.5 text-sm font-bold transition "+(section===value?"bg-violet-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50");
  return <div className="space-y-5">
    <PageHead title="Settings" subtitle="Design & Pattern defaults. Account and security controls are shared with the other RMS departments."/>
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Design settings sections">
      <button type="button" onClick={()=>setSection("workflow")} className={sectionButton("workflow")}>Design workflow</button>
      <button type="button" onClick={()=>setSection("account")} className={sectionButton("account")}>Account &amp; Security</button>
    </nav>
    {section==="account"?<AdminSettings departmentMode/>:<section className="max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div><h3 className="text-base font-black text-slate-900">Design workflow defaults</h3><p className="mt-1 text-sm text-slate-500">Control lists and starting values used in Design Projects, Research, Patterns and Sample Approval.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Departments" value={form.departments.split("\n").filter(Boolean).length} accent="violet"/>
        <StatCard label="Sample stages" value={form.sample_types.split("\n").filter(Boolean).length} accent="cyan"/>
        <StatCard label="Pattern default" value={`${form.default_base_size||"—"} · ${form.default_wastage_pct||0}%`} accent="emerald" hint="base size · wastage"/>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className="block"><span className={labelClass}>Product departments <span className="font-semibold normal-case text-slate-400">— one per line</span></span><textarea rows="8" value={form.departments} onChange={event=>set("departments",event.target.value)} className={box}/><span className="mt-1 block text-xs text-slate-400">Used by Design Projects and Research &amp; Mood Boards.</span></label>
        <label className="block"><span className={labelClass}>Sample types <span className="font-semibold normal-case text-slate-400">— one per line</span></span><textarea rows="8" value={form.sample_types} onChange={event=>set("sample_types",event.target.value)} className={box}/><span className="mt-1 block text-xs text-slate-400">Used when recording sample requests and approvals.</span></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block"><span className={labelClass}>Default base size</span><input value={form.default_base_size} onChange={event=>set("default_base_size",event.target.value)} className={box}/></label>
        <label className="block"><span className={labelClass}>Default size run</span><input value={form.default_size_run} onChange={event=>set("default_size_run",event.target.value)} className={box}/></label>
        <label className="block"><span className={labelClass}>Default wastage %</span><input type="number" min="0" max="100" value={form.default_wastage_pct} onChange={event=>set("default_wastage_pct",event.target.value)} className={box}/></label>
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
        <p className={labelClass}>Production handoff gates</p>
        <p className="text-xs text-slate-400">Which sign-offs a design needs before it can be released to Production. Turn off what your shop doesn't do — a design-owned Tech Pack can still always be released without them via "Release without sign-off".</p>
        {[["require_sample_approval","Require an approved sample"],["require_design_head_approval","Require Design Head approval"],["require_production_feasibility","Require Production feasibility approval"]].map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form[key]} onChange={event=>set(key,event.target.checked)}/>{label}</label>)}
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Safe default behavior:</b> these values prefill new records only. Existing projects, approved patterns and released production references are never rewritten.</div>
      <div className="flex justify-end border-t border-slate-100 pt-5"><button type="button" onClick={save} disabled={saving} className={BTN_PRIMARY}>{saving?"Saving…":"Save workflow defaults"}</button></div>
    </section>}
  </div>;
}
function Panel({title,subtitle,action,actionText,children}){return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div><h2 className="text-sm font-black text-slate-900">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div>{action&&<button onClick={action} className={BTN_PRIMARY}>{actionText}</button>}</header><div className="space-y-2 p-4">{children}</div></section>}
function FormModal({title,onClose,onSubmit,children}){return <Modal title={title} onClose={onClose}><form onSubmit={onSubmit} className="p-5 sm:p-6">{children}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button><button className={BTN_PRIMARY}>Save</button></div></form></Modal>}
function ProjectSelect({value,onChange,projects}){return <Field label="Design project *"><select required value={value} onChange={e=>onChange(e.target.value)}><option value="">Select design</option>{projects.map(p=><option key={p.id} value={p.id}>{p.design_no} · {p.style_name}</option>)}</select></Field>}
function AssetUploader({label,onUploaded,accept="image/*"}){const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const upload=async(files)=>{if(!files?.length)return;setBusy(true);setMessage("Uploading "+files.length+" file"+(files.length===1?"":"s")+"...");try{const body=new FormData();[...files].forEach(f=>body.append("files",f));const token=localStorage.getItem("admin_token")||localStorage.getItem("access_token")||localStorage.getItem("token")||"";const response=await fetch(API_BASE_URL+"/api/design-pattern/assets",{method:"POST",headers:token?{Authorization:"Bearer "+token}:{},body});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Upload failed");onUploaded(result.data.map(x=>x.url));setMessage(result.data.length+" file"+(result.data.length===1?"":"s")+" uploaded successfully");}catch(e){setMessage(e.message);}finally{setBusy(false);}};const failed=message.toLowerCase().includes("failed")||message.toLowerCase().includes("error");return <div className="w-full min-w-0 md:col-span-2"><div className="w-full min-w-0 overflow-hidden rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 p-4"><p className="break-words text-xs font-black uppercase tracking-wide text-violet-700">{label}</p><p className="mt-1 text-xs text-slate-500">Choose one or more files. They upload immediately and appear below.</p><input type="file" multiple accept={accept} onChange={e=>{upload(e.target.files);e.target.value="";}} className="mt-3 block w-full min-w-0 cursor-pointer overflow-hidden rounded-xl border border-violet-200 bg-white text-sm text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-white hover:file:bg-violet-700 disabled:cursor-wait disabled:opacity-60" disabled={busy}/>{message&&<p className={"mt-2 break-words text-xs font-semibold "+(failed?"text-rose-600":"text-slate-600")}>{message}</p>}</div></div>}
function Reports({data}){const byDesigner=Object.entries(data.projects.reduce((a,p)=>{const k=p.designer||"Unassigned";a[k]=(a[k]||0)+1;return a;},{}));const sampleCost=data.samples.reduce((s,x)=>s+Number(x.actual_cost||x.estimated_cost||0),0);const deadlines=[...data.projects.filter(p=>p.launch_date).map(p=>({date:p.launch_date,label:`Launch · ${p.design_no}`})),...data.samples.filter(s=>s.required_date&&s.decision==="PENDING").map(s=>({date:s.required_date,label:`Sample · ${s.design_no}`}))].sort((a,b)=>a.date.localeCompare(b.date));return <div className="space-y-5"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard label="Designs" value={data.projects.length} accent="violet"/>
    <StatCard label="Release rate" value={`${data.projects.length?Math.round(data.projects.filter(p=>p.status==="RELEASED_TO_PRODUCTION").length/data.projects.length*100):0}%`} accent="emerald"/>
    <StatCard label="Sample cost" value={`₹${sampleCost.toLocaleString("en-IN")}`} accent="cyan"/>
    <StatCard label="Revisions" value={data.samples.filter(s=>s.decision?.includes("REVISION")||s.decision==="RESAMPLE_REQUIRED").length} accent="amber"/>
  </section><div className="grid gap-5 xl:grid-cols-2"><Panel title="Designer workload" subtitle="Current project ownership.">{byDesigner.length?byDesigner.map(([name,count])=><div key={name} className="flex justify-between rounded-xl border p-3"><b>{name}</b><span>{count} project(s)</span></div>):<Empty>No workload data.</Empty>}</Panel><Panel title="Deadline calendar" subtitle="Upcoming sample and launch commitments.">{deadlines.length?deadlines.slice(0,12).map(x=><div key={`${x.date}${x.label}`} className="flex justify-between rounded-xl border p-3"><b>{x.label}</b><span>{x.date}</span></div>):<Empty>No dated commitments.</Empty>}</Panel></div><Panel title="Design cost & sales performance" subtitle="BOM material estimate, sampling cost and matched sales units.">{(data.insights||[]).length?(data.insights||[]).map(x=><div key={x.project_id} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-5"><b>{x.design_no} · {x.style_name}</b><span>Target ₹{x.target_cost}</span><span>Material ₹{x.material_cost}</span><span>Samples ₹{x.sample_cost}</span><span className="font-bold text-emerald-700">Sales {x.sales_units} units</span></div>):<Empty>No linked costing or sales data.</Empty>}</Panel></div>}

function FloorOpsView({section,setSection,depts,workers,logs,kpis,filters,setFilters,onApplyFilters,onAddLog,onAddWorker,onToggleWorker,onUpload,onTemplate}){
  const sectionBtn=(v)=>"rounded-lg px-3.5 py-2 text-sm font-bold transition "+(section===v?"bg-violet-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-100");
  return <div className="space-y-5">
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Floor operations sections">
      <button type="button" onClick={()=>setSection("log")} className={sectionBtn("log")}>Daily Log</button>
      <button type="button" onClick={()=>setSection("workers")} className={sectionBtn("workers")}>Floor Workers</button>
      <button type="button" onClick={()=>setSection("kpi")} className={sectionBtn("kpi")}>KPI Summary</button>
    </nav>
    {section==="log"&&<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div><h2 className="text-base font-black text-slate-900">Daily production log</h2><p className="mt-0.5 text-sm text-slate-500">One entry per worker, per department, per day. Upload one spreadsheet for the whole day instead of a form each.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onTemplate} className={`${BTN_GHOST} !py-2`}>Template</button>
          <label className={`${BTN_SUBTLE} !py-2 cursor-pointer`}>Upload Excel<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)onUpload(f);}}/></label>
          <button onClick={onAddLog} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Log entry</button>
        </div>
      </div>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-5">
        <label className="block"><span className="mb-1 block text-[11px] font-black uppercase text-slate-500">From</span><input type="date" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <label className="block"><span className="mb-1 block text-[11px] font-black uppercase text-slate-500">To</span><input type="date" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <label className="block"><span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Department</span><select value={filters.department} onChange={e=>setFilters({...filters,department:e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"><option value="">All</option>{depts.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[11px] font-black uppercase text-slate-500">Style / Design no.</span><input value={filters.design_no} onChange={e=>setFilters({...filters,design_no:e.target.value})} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <div className="flex items-end"><button onClick={onApplyFilters} className="w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">Apply filters</button></div>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {logs.length?logs.map(l=><div key={l.id} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{l.worker_name}{l.source==="JOB_WORK"?<span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Job worker</span>:null}</p>
            <span className="shrink-0 text-[11px] text-slate-400">{l.date}{l.time?` · ${l.time}`:""}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{l.department}{l.design_no?` · ${l.design_no}`:""}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>Target <b className="text-slate-900">{l.target_qty||0}</b></span>
            <span>Done <b className="text-slate-900">{l.completed_qty||0}</b></span>
            <span>Rework <b className="text-slate-900">{l.rework_qty||0}</b></span>
            <span>Rejected <b className="text-rose-600">{l.rejected_qty||0}</b></span>
            <span>Fabric <b className="text-slate-900">{l.fabric_used_mtrs||0}m</b></span>
            <span>Waste <b className="text-slate-900">{l.wastage_mtrs||0}m</b></span>
            <span>On-time <b className="text-slate-900">{l.on_time?"Yes":"No"}</b></span>
          </div>
          {l.remarks&&<p className="mt-1.5 text-xs text-slate-500">{l.remarks}</p>}
        </div>):<p className="p-10 text-center text-sm text-slate-400">No entries yet for this filter.</p>}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{["Date","Dept","Worker","Style","Target","Done","Rework","Rejected","Fabric(m)","Waste(m)","On-time","Remarks"].map(h=><th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length?logs.map(l=><tr key={l.id}>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">{l.date}{l.time?` · ${l.time}`:""}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-800">{l.department}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">{l.worker_name}{l.source==="JOB_WORK"?<span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Job worker</span>:null}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{l.design_no||"—"}</td>
              <td className="px-3 py-2.5 text-xs">{l.target_qty||0}</td>
              <td className="px-3 py-2.5 text-xs font-bold text-slate-900">{l.completed_qty||0}</td>
              <td className="px-3 py-2.5 text-xs">{l.rework_qty||0}</td>
              <td className="px-3 py-2.5 text-xs text-rose-600">{l.rejected_qty||0}</td>
              <td className="px-3 py-2.5 text-xs">{l.fabric_used_mtrs||0}</td>
              <td className="px-3 py-2.5 text-xs">{l.wastage_mtrs||0}</td>
              <td className="px-3 py-2.5 text-xs">{l.on_time?"Yes":"No"}</td>
              <td className="max-w-[220px] truncate px-3 py-2.5 text-xs text-slate-500" title={l.remarks}>{l.remarks||"—"}</td>
            </tr>):<tr><td colSpan={12} className="p-10 text-center text-sm text-slate-400">No entries yet for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>}
    {section==="workers"&&<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div><h2 className="text-base font-black text-slate-900">Floor worker directory</h2><p className="mt-0.5 text-sm text-slate-500">Names only — no login or email needed. A worker can be tagged to more than one department.</p></div>
        <button onClick={onAddWorker} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Add worker</button>
      </div>
      <div className="divide-y divide-slate-100">
        {workers.length?workers.map(w=><div key={w.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div><p className="font-black text-slate-900">{w.name}</p><p className="text-xs text-slate-500">{w.phone||"No phone on file"} · {(w.departments||[]).join(", ")||"No department set"}</p></div>
          <div className="flex items-center gap-2"><span className={`text-xs font-bold ${w.active!==false?"text-emerald-600":"text-slate-400"}`}>{w.active!==false?"Active":"Inactive"}</span><button onClick={()=>onToggleWorker(w)} className="rounded-lg border px-3 py-1.5 text-xs font-bold">{w.active!==false?"Deactivate":"Activate"}</button></div>
        </div>):<Empty>No floor workers added yet.</Empty>}
      </div>
    </section>}
    {section==="kpi"&&<div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">From</span><input type="date" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value})} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">To</span><input type="date" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value})} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <button onClick={onApplyFilters} className={BTN_SUBTLE}><RefreshCw className="h-4 w-4"/>Refresh KPIs</button>
      </div>
      {kpis?.totals?<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Entries" value={kpis.entry_count} accent="violet"/>
        <StatCard label="Efficiency" value={kpis.totals.efficiency_pct!=null?`${kpis.totals.efficiency_pct}%`:"—"} accent="cyan"/>
        <StatCard label="Rework" value={kpis.totals.rework_pct!=null?`${kpis.totals.rework_pct}%`:"—"} accent="amber"/>
        <StatCard label="Rejection" value={kpis.totals.rejection_pct!=null?`${kpis.totals.rejection_pct}%`:"—"} accent="rose"/>
        <StatCard label="On-time" value={kpis.totals.on_time_pct!=null?`${kpis.totals.on_time_pct}%`:"—"} accent="emerald"/>
      </section>:<Empty>No entries yet for this range.</Empty>}
      <div className="grid gap-5 xl:grid-cols-3">
        <KpiTable title="By department" rows={kpis?.by_department}/>
        <KpiTable title="By worker" rows={kpis?.by_worker}/>
        <KpiTable title="By style" rows={kpis?.by_design}/>
      </div>
    </div>}
  </div>;
}
function KpiTable({title,rows}){return <Panel title={title} subtitle="Efficiency = completed/target · rework & rejection = % of completed.">{rows?.length?rows.map(r=><div key={r.key} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm"><b className="truncate">{r.key}</b><span className="shrink-0 text-xs font-bold text-slate-500">{r.entries} entr{r.entries===1?"y":"ies"} · Eff {r.efficiency_pct!=null?`${r.efficiency_pct}%`:"—"} · Rej {r.rejection_pct!=null?`${r.rejection_pct}%`:"—"}</span></div>):<Empty>No data.</Empty>}</Panel>}

