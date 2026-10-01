import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, Factory, FileText, Gauge, Image as ImageIcon, LayoutDashboard, LayoutGrid, List, LogOut, Menu, MessageSquare, Package, Palette, Plus, RefreshCw, Ruler, Search, Send, Settings, TrendingUp, X } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";
import { logoutOrReturnToDepartmentSelector, getAdminName, getAdminScope, getStoreName } from "../utils/authRedirect.js";
import TechPackLibrary from "./Production/TechPackLibrary.jsx";
import AdminSettings from "./Admin/AdminSettings.jsx";
import InternalNotificationBell from "./InternalNotificationBell.jsx";
import InternalChatPanel from "./InternalChatPanel.jsx";
import DocumentComments from "./DocumentComments.jsx";

const TABS = [
  ["dashboard", "Dashboard", LayoutDashboard], ["research", "Research & Mood Boards", Search], ["themes", "Collections & Themes", Palette], ["projects", "Design Projects", Palette], ["patterns", "Patterns", Ruler],
  ["artwork", "Print & Artwork", FileText], ["samples", "Samples & Approval", ClipboardCheck], ["techpacks", "Tech Packs", BookOpen], ["handoff", "Production Handoff", Factory],
  ["floorops", "Daily Floor Log", Gauge],
  ["fabric", "Fabric & Production", Package],
  ["queries", "Queries", MessageSquare], ["changes", "Change Control", AlertCircle], ["reports", "Reports", CheckCircle2],
];
const GUIDES={
dashboard:["Review live counts and Production Readiness.","Open the tab connected to any missing item.","Next: start Research or create a Design Project."],
research:["Add season, market, department, tags and findings.","Attach source, image and document links.","Next: turn the approved direction into a Design Project."],
themes:["Create the season/collection direction, palette, customer and mood board; keep it Draft while Design is deciding.","Link Design Projects while the theme is being developed, then Approve it when the creative direction is final.","Next: choose the approved theme in a Tech Pack. Production receives a locked snapshot and can source fabric without editing Design decisions."],
projects:["Create one master project per style and keep its design number unchanged.","Set owner, priority, quantity, cost and launch date; update status as work progresses.","Next: add the first Pattern Version."],
patterns:["Choose the project; record base size, sizes, width, consumption and wastage.","Enter grading as Point | Base | S:value,M:value and upload CAD/DXF/PDF files.","Use the Pattern-piece register below to break the pattern into Front/Back/Collar/Sleeve etc. with front/back/side reference images — and check Reuse from library for an existing similar pattern before building a new one from scratch. Use Create Revision for V2/V3 of the SAME design, or Clone as variation to start a DIFFERENT design from this one."],
artwork:["Link the print/embroidery to a project.","Record version, dimensions, placement, technique, colours and file links.","Next: validate it on a sample and include the approved version in the Tech Pack."],
samples:["Choose project, pattern, sample type, assignee, materials, cost and due date.","On receipt, record fit/construction results and the decision.","Approved continues to Tech Pack; Revision/Resample returns to Pattern or Artwork."],
techpacks:["Use the exact Design Project number.","Complete Sketch, Spec Sheet, Details, Artwork, Trims/Labels and Colourways; upload references.","Download/review the PDF. Use a new version for major changes. Next: Handoff."],
handoff:["Confirm approved sample and matching Tech Pack.","Record Design Head approval; Production separately records feasibility.","Choose an existing BOM or auto-create one from pattern consumption, then Release to Production."],
floorops:["Floor workers have no login — a supervisor logs each entry on their behalf; pick a name or type one for a walk-in.","Or generate the Kiosk link at the top of this tab and open it on a shared floor tablet/PC — a worker can then pick their own name, tap Start and End themselves, no login needed.","Choose the department first; the form only shows the fields that department needs (set these up under Settings).","For Cutting/Stitching-style departments, use the Size and Wastage breakdown rows instead of typing one total — the total is calculated for you.","Switch to KPI Summary for efficiency, rework, rejection and on-time % by department, worker or style.","A genuinely wrong entry (duplicate kiosk tap, wrong worker, test entry) can be removed with Delete — it asks for a reason every time, and automatically reverses any fabric it already posted to the Fabric Lot ledger."],
fabric:[
  "Step 1 — Receive: the moment fabric physically arrives, log it as a lot (name, colour, width, GSM, lot/roll no., vendor, quantity). This is entered once per roll.",
  "Step 2 — Issue: when fabric is actually handed to Layering/Cutting for a design, click Issue on that lot. This is the moment it leaves the store balance.",
  "Step 3 — Consume / Waste / Return: as the work happens, record what was really used (Consume), lost (Waste, with a category) and any genuine unused leftover (Return). The balance updates itself — nothing here is typed by hand.",
  "Step 4 — Utilization: load a design (or leave blank for all) to see Received/Issued/Consumed/Waste/Balance and Utilization %/Wastage %, calculated automatically. Export Excel to share or archive it.",
  "Step 5 — Reuse: before ordering fresh fabric for a new design, check Reuse matches on any lot with leftover balance — it may already cover the new design.",
  "Step 6 — FY Planning: once a real season of data exists, load it for best/worst utilization designs, real time efficiency, and next-year fabric purchase suggestions from actual sales.",
],
queries:["Select the affected design, category and priority.","Describe one clear technical issue; Design and Production share the same feed.","Resolve with a written answer. Use Change Control if released instructions change."],
changes:["Record reason, previous spec, new spec, and material/cost/delivery impact.","The system identifies affected open job orders.","Production accepts/rejects and acknowledges; accepted changes require a new controlled version."],
reports:["Review release rate, sample cost and revisions.","Balance work using Designer Workload and Deadline Calendar.","Compare target, BOM material and sample cost with matched sales units."]
};
// Per-button reference: what each button on a tab actually does, and when
// (not) to use it. Kept separate from GUIDES (the 3-step workflow order)
// since this is about individual buttons, not sequence.
const BUTTON_GUIDES = {
  themes: [
    ["+ New theme", "Starts a new collection/theme record.", "Use once per season/collection direction.", "Don't create a second theme for a direction that already exists — edit the draft instead."],
    ["Edit", "Changes any field while still deciding (Draft only).", "Use freely before Approve.", "Not available once Approved — that's intentional, so a locked reference can't quietly change under Production."],
    ["Approve", "Permanently locks the creative direction; Production can then source fabric against it.", "Use only when the direction is truly final.", "There is no \"unapprove\" — don't approve early just to unblock someone; create the theme as Draft until it's really settled."],
    ["Delete", "Removes an unused Draft theme.", "Use to clean up a draft that was never used.", "Blocked automatically once any project or Tech Pack links to it — you can't delete a theme that's actually in use."],
  ],
  projects: [
    ["+ New project / New design", "Creates one master record per style.", "Use the same Design No. everywhere for that style.", "Don't create a second project for a design that already exists — find it and update its status instead."],
    ["Status dropdown", "Moves the project's lifecycle stage by hand (Idea → ... → Released to Production).", "Use to keep the pipeline view accurate as work progresses.", "This is a visibility flag only — it doesn't release anything to Production. Do the actual release from Production Handoff, with its approvals."],
    ["Pattern / Sample / Query buttons", "Jump straight to adding a pattern, sample or query already scoped to this project.", "Use instead of re-selecting the project by hand in those tabs.", ""],
  ],
  patterns: [
    ["+ Add pattern", "Creates the first pattern/grading version for a project.", "Use once per project to start pattern work.", "Check \"Reuse from library\" first — if a similar block already exists in the same family, Clone it instead of starting fresh."],
    ["Pattern family", "Tags this pattern with a reusable base-silhouette name (e.g. \"Classic Shirt\", \"Straight Pant\") so every variation built on it — across ANY design number — can be found together later.", "Use the same family name every time it's genuinely the same base block with a construction difference (different collar, sleeve, closure).", "Leave blank for a one-off pattern with no real family — it still works exactly as before, just won't show up in the library."],
    ["Reuse from library", "Browses every existing pattern tagged with a family, across ALL design numbers, with a preview image and what's different about each one.", "Use BEFORE starting a brand-new pattern, to check whether something close already exists.", "Shows nothing for families nobody has tagged yet — that's expected until patterns start being tagged."],
    ["Clone as variation", "Creates a NEW pattern under a DIFFERENT design number, copying construction vocabulary, measurements, size ratio and pattern pieces (with their images) from the source.", "Use when the new design is genuinely a variation of an existing block (same shirt, different collar) — edit only what's actually changing afterwards.", "This is NOT the same as Revise — Revise makes v2/v3 of the SAME design; Clone starts a different design number entirely."],
    ["Revise", "Creates a NEW version (v2, v3…) rather than editing the old one.", "Use for any change to sizing, grading or consumption on the SAME design.", "There is no plain \"Edit\" for a saved pattern by design — this keeps historical grading intact for anything already cut against an earlier version. Don't try to work around it; always revise."],
    ["Pattern-piece register (below the table)", "Breaks a DRAFT pattern into its named construction pieces (Front, Back, Collar, Sleeve, Cuff, Pocket…) each with optional front/back/side reference images.", "Use to document exactly what each piece looks like, not just upload one flat CAD file for the whole pattern.", "Only available while the pattern is still DRAFT — create a revision first if you need to change pieces on an already-progressed pattern."],
  ],
  artwork: [
    ["+ Add artwork", "Creates a new print/embroidery/placement reference.", "Use for a new design.", ""],
    ["Edit", "Changes the record in place — artwork has no version lock like Tech Packs or Patterns.", "Use for small corrections.", "For a real creative change, consider a new artwork record instead so the old placement stays on file for anything already produced with it."],
  ],
  samples: [
    ["Review sample", "Logs a new sample round: type, quantity, cost, due date.", "Use each time a new physical sample is requested.", ""],
    ["Decision filter", "Filters the list shown on screen only.", "Use to find samples by decision.", "Changes nothing on any record."],
    ["Edit / decision", "Records the fit/construction result and the decision once the sample is back.", "Use as soon as a sample round is reviewed.", "\"Approved\" is what satisfies Production Handoff's sample gate (when that gate is turned on in Settings) — don't mark Approved before it's actually been checked."],
  ],
  techpacks: [
    ["+ Create tech pack", "Creates one tech pack for a Design No.", "Use once per design; use the exact Design No.", ""],
    ["View", "Read-only preview.", "Safe to use anytime.", ""],
    ["Edit", "Changes any field (Draft only).", "Use freely before release.", "Disabled once Released — protects the exact spec Production is already building against."],
    ["Delete", "Removes an unused Draft pack.", "Use to clean up a draft never used.", "Blocked once a job order already references it, and never available once Released."],
    ["Release", "Releases a Draft pack straight to Production, skipping Production Handoff's approval screen.", "Use ONLY for a design with no Design Project to route it through — e.g. it already sold in an earlier season, before this pack was tracked here.", "If a Design Project for this design exists, use Production Handoff instead so the real sign-off gets recorded. Don't use this as a shortcut to skip approvals on a design that's genuinely still under review — it's blocked automatically when a matching project exists, but still needs a written reason every time."],
    ["Download PDF", "Exports the pack for sharing outside RMS.", "Safe anytime, any status.", ""],
    ["Use in job order", "Jumps to Production Handoff with this pack pre-selected.", "Use to move straight to releasing it.", "Doesn't release anything by itself — Handoff still applies its own gates."],
  ],
  handoff: [
    ["Approve (Design Head)", "Records one sign-off on the project.", "Use when a Design Head has actually reviewed it.", "This alone doesn't release anything — it just clears one of the configured gates."],
    ["Release", "The real release: locks the selected Tech Pack as Production's reference, and optionally creates/links a BOM.", "Enabled once every gate this tenant has turned on (sample, Design Head, feasibility) is satisfied.", "Once released, the Tech Pack is locked — further changes need a new version, not an edit."],
    ["Override", "Releases anyway when a gate is missing, with a mandatory written reason saved permanently on the record.", "Use for a genuine, explainable exception — e.g. urgent reorder of an already-proven style.", "Don't use this as a habit to skip approvals — the reason is kept as a permanent audit note, and it's meant to stand out precisely because it's an exception."],
  ],
  queries: [
    ["Raise query", "Logs a technical question for Production to see.", "Use for a clarification, not a spec change.", "If the released spec itself needs to change, use Change Control instead."],
    ["Resolve", "Writes the answer and closes the query.", "Use once you have a real answer.", ""],
  ],
  changes: [
    ["Change request", "Records a spec change after release, with its material/cost/delivery impact.", "Use for a real change to something already released — RMS lists every open job order it affects.", ""],
    ["Accept / Reject", "Not done here — Production decides and acknowledges change requests from their own Production & Job Work screen.", "Check there for the decision.", "Don't look for an accept/reject button in this tab; it doesn't exist here by design, since Production is the one whose work is affected."],
  ],
  floorops: [
    ["Log entry", "Records one worker's output for one department on one day.", "Use once per worker per department per day — not once per piece.", "Don't log the same worker/day/department twice; edit isn't available by design, so a mistaken entry should be logged again with a note rather than guessed at."],
    ["Add size (Size-wise quantity)", "Lets you type pieces per size (S, M, L…) instead of one lump completed-qty.", "Use for Cutting/Stitching-type departments so size-wise output is tracked — needed for the Fabric Utilization and FY Planning views to be accurate.", "Leave it empty and use the plain total field above if size doesn't matter for this entry — both are optional, not required."],
    ["Add category (Wastage by category)", "Lets you tag wastage to one of the 10 real categories (marker, cutting, shade issue, recoverable, etc) instead of one lump number.", "Use whenever there's real fabric loss to record, picking the category that matches what actually happened.", "Don't pick a category at random to get past the field — an inaccurate category quietly corrupts the wastage-by-category rollup used elsewhere. Categories are scoped to the selected department on purpose; if the right one doesn't show, wrong department is likely selected."],
    ["Upload Excel", "Bulk-imports a whole day's paper register in one spreadsheet.", "Use when the floor keeps a physical register and someone transcribes it at day's end.", "Size/wastage breakdown rows aren't part of the bulk template yet — use the on-screen form for those."],
    ["Generate kiosk link / Rotate link", "Creates (or replaces) a no-login link a worker opens directly on a shared floor tablet/PC to log their own Start/End work.", "Generate once, print the link/QR near the workstation. Rotate only if it's lost or leaked.", "Rotating immediately breaks the OLD link/QR — anything printed with it will stop working, so only rotate when you actually mean to replace it."],
    ["Delete (on a log row)", "Permanently removes one floor log entry and reverses any Consume/Waste it already posted to the Fabric Lot ledger, in the same step.", "Use ONLY for a genuine mistake — duplicate kiosk tap, wrong worker/department picked, a test entry. A reason is mandatory and kept forever in a separate audit trail even after the row is gone.", "Don't use this to \"correct\" a real entry with wrong numbers — delete it and log it again correctly instead, so the audit trail reflects what actually happened. Not available from the Kiosk or to any store-scoped admin — HQ Design & Pattern / Production & Job Work access only."],
  ],
  fabric: [
    ["Receive lot", "Records a physical fabric roll the moment it arrives — name, colour, width, GSM, vendor, qty, QC status. This is entered ONCE per roll.", "Use every time fabric physically comes in, whether or not it's tied to a specific design yet.", "Don't re-receive the same roll to \"top up\" its quantity — that creates a duplicate lot with its own separate balance. Use Issue/Consume/Waste/Return on the existing lot instead."],
    ["Swatch upload", "Attaches a photo of the fabric to its lot for visual reference.", "Use so anyone approving a cut plan can see the actual fabric.", "Optional — nothing else depends on it being uploaded."],
    ["Issue", "Moves fabric OUT of the store balance to the floor for a design/batch. Reduces the lot's balance immediately.", "Use the moment fabric is actually handed to Layering/Cutting, not when it's merely planned.", "Don't issue more than the current balance shows — RMS blocks it; if you're short, receive more stock or check another lot first."],
    ["Consume", "Records how much of the ISSUED fabric was actually used/cut. Doesn't touch the store balance (that already happened at Issue).", "Use after cutting/layering is done, from the real fabric_used figure.", "Can't exceed what's still unaccounted for from that lot's issue — consume + waste + return together can never be more than what was issued."],
    ["Waste", "Records fabric lost during use, tagged to one of the 10 wastage categories (marker, cutting, shade issue, recoverable, etc).", "Use for every genuine loss, picking the category that actually matches what happened.", "Don't default to \"Production waste\" for everything — a wrong category here quietly ruins the utilization dashboard's real diagnostic value. \"Recoverable fabric\" specifically means it can still be reused elsewhere (see Reuse matches)."],
    ["Return", "Sends unused issued fabric back to the store — adds back to the balance.", "Use when a cutting job finishes with genuine leftover, unused fabric.", "This is for fabric that's still good and unused — a fabric that was cut wrong is Waste, not a Return."],
    ["Reuse matches", "Shows other designs already using the exact same fabric type+colour+width+GSM as this lot's leftover.", "Use before ordering fresh fabric for a new design — check if an existing leftover can cover it instead.", "This only ever SUGGESTS a match — it never moves fabric by itself. You still record the actual Issue against whichever lot you decide to use."],
    ["Load utilization", "Shows Received/Issued/Consumed/Waste/Recoverable/Balance and Utilization %/Wastage % for one design (or every design if left blank).", "Use anytime to check how a design's fabric is actually performing, not just how much was planned.", "Utilization % is measured against ISSUED fabric, not received — fabric still sitting unused in the store correctly does NOT count against utilization yet."],
    ["Export Excel (Utilization)", "Downloads the currently loaded utilization view as a workbook — Fabric Utilization sheet + Waste by Category sheet + a Read Me with the filter/date applied.", "Use after Load utilization, to share the numbers outside RMS or archive a season's figures.", "Exports exactly what's on screen — change the Design No. filter and click Load utilization again before exporting a different scope."],
    ["Load FY planning", "Rolls up best/worst utilization designs, real time efficiency by worker/vendor, and next-year fabric suggestions from actual sales.", "Use once a real season of data exists — a handful of days won't produce meaningful rankings.", "The \"suggested fabric qty\" and size-ratio mismatch are guidance from real sell-through, not an order — always sense-check before committing a purchase."],
  ],
};
function ButtonGuide({tab}){const rows=BUTTON_GUIDES[tab]||[];if(!rows.length)return null;return <details className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"><BookOpen className="h-3.5 w-3.5"/>What each button does</summary><div className="divide-y divide-slate-100 border-t border-slate-100">{rows.map(([name,what,use,avoid])=><div key={name} className="grid gap-2 p-4 sm:grid-cols-[160px_1fr] sm:gap-4"><p className="text-sm font-black text-slate-900">{name}</p><div className="space-y-1 text-sm leading-6 text-slate-600"><p>{what}</p><p><span className="font-bold text-emerald-700">Use when:</span> {use}</p>{avoid&&<p><span className="font-bold text-rose-700">Don't:</span> {avoid}</p>}</div></div>)}</div></details>}

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
  fabric: "Fabric lot ledger, utilization, reuse matching and next-year fabric planning.",
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
// Mirrors DEFAULT_WASTAGE_CATEGORIES in design_pattern_routes.py — only the
// factory default shown before a tenant's own settings load; a tenant can
// rename/add/remove/re-scope these via the Settings screen below.
const DEFAULT_WASTAGE_CATEGORIES = [
  {code:"marker_waste",label:"Marker waste",is_recoverable:false,departments:["Cutting"]},
  {code:"cutting_waste",label:"Cutting waste",is_recoverable:false,departments:["Cutting"]},
  {code:"end_loss",label:"End loss",is_recoverable:false,departments:["Cutting"]},
  {code:"spreading_loss",label:"Spreading loss",is_recoverable:false,departments:["Layering","Cutting"]},
  {code:"fabric_defect",label:"Fabric defect",is_recoverable:false,departments:["Layering","Embroidery"]},
  {code:"shade_issue",label:"Shade issue",is_recoverable:false,departments:["Layering"]},
  {code:"production_waste",label:"Production waste",is_recoverable:false,departments:["Stitching","Embroidery","Pattern Making"]},
  {code:"rejection",label:"Rejection",is_recoverable:false,departments:["Stitching","Embroidery","Finishing & Packing"]},
  {code:"recoverable_fabric",label:"Recoverable fabric",is_recoverable:true,departments:["Cutting"]},
  {code:"scrap",label:"Scrap",is_recoverable:false,departments:["Stitching","Finishing & Packing"]},
];
const DEFAULT_SETTINGS = { departments: DEPARTMENTS, sample_types: ["Proto sample", "Development sample", "Fit sample", "Size-set sample", "Print / embroidery sample", "Wash sample", "Pre-production sample", "Production sample"], default_base_size: "M", default_size_run: "S, M, L, XL", allowance_limits:{PATTERN:{value:7,unit:"inches"},LAYERING:{value:7,unit:"inches_per_lay"},CUTTING:{value:5,unit:"percent"},STITCHING:{value:2,unit:"percent"},FINISHING:{value:2,unit:"percent"}}, wastage_categories: DEFAULT_WASTAGE_CATEGORIES, require_sample_approval: true, require_design_head_approval: true, require_production_feasibility: true };
const PROJECT_STATUSES = ["IDEA", "IN_DEVELOPMENT", "PATTERN_DEVELOPMENT", "SAMPLE_DEVELOPMENT", "REVISION_REQUIRED", "AWAITING_APPROVAL", "APPROVED_FOR_PRODUCTION", "ON_HOLD", "REJECTED", "ARCHIVED"];
const SAMPLE_TYPES = ["Proto sample", "Development sample", "Fit sample", "Size-set sample", "Print / embroidery sample", "Wash sample", "Pre-production sample", "Production sample"];
const DECISIONS = ["PENDING", "APPROVED", "APPROVED_WITH_COMMENTS", "REVISION_REQUIRED", "REJECTED", "RESAMPLE_REQUIRED"];
const emptyProject = { design_no:"", style_name:"", department:"Women", category:"", theme_id:"", theme:"", collection:"", season:"", designer:"", target_customer:"", target_cost:"", planned_quantity:"", launch_date:"", priority:"MEDIUM", description:"", moodboard_urls:"", document_urls:"" };
const emptyTheme = { id:"", theme_name:"", collection:"", season:"", department:"Women", target_customer:"", target_date:"", creative_direction:"", palette:"", moodboard_urls:"", document_urls:"" };
const emptyPattern = { project_id:"", pattern_no:"", pattern_name:"", version:"v1", base_size:"M", sizes:"S, M, L, XL", fabric_width:"", consumption_per_unit:"", wastage_pct:"", marker_length:"", marker_efficiency:"", seam_allowance:"", shrinkage_allowance:"", measurement_rows:"", file_urls:"", notes:"", base_block:"", seam_types:[], closure_types:[], dart_pleat_tuck_details:[], hem_finishes:[], family_name:"", variation_notes:"" };
// Fallback if /pattern-vocabulary hasn't loaded yet — kept in sync with
// PATTERN_VOCABULARY in design_pattern_routes.py.
const DEFAULT_PATTERN_VOCABULARY = {
  base_block: ["Bodice block", "Sleeve block", "Skirt block", "Trouser block", "Dress block", "Collar block", "Custom / draped"],
  seam_types: ["Plain (open) seam", "French seam", "Flat-felled seam", "Overlocked seam", "Bound seam", "Lapped seam", "Welt seam", "Mock flat-felled seam"],
  closure_types: ["Concealed zipper", "Exposed zipper", "Buttons", "Hooks & eyes", "Drawstring", "Elastic", "Snap buttons", "Velcro", "None"],
  dart_pleat_tuck_details: ["Bust dart", "Waist dart", "Box pleat", "Knife pleat", "Accordion pleat", "Pin tucks", "Shirring", "Smocking", "None"],
  hem_finishes: ["Blind hem", "Rolled hem", "Bound hem", "Overlocked hem", "Double-fold hem", "Lettuce hem", "Raw / unfinished edge"],
};
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
const emptyFabricLot = () => ({ fabric_name:"", lot_no:"", roll_no:"", colour:"", width:"", gsm:"", vendor_name:"", unit:"MTR", rate:"", qc_status:"PENDING", qc_note:"", design_no:"", opening_qty:"", received_qty:"", notes:"" });
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

function PatternPieceRegister({ patterns, projects=[], onChanged }) {
  const [patternId, setPatternId] = useState("");
  const emptyPieceForm = { piece_name:"", piece_code:"", callout_no:"", fabric_reference:"", cut_quantity:"", grainline:"", seam_allowance:"", grading_note:"", file_url:"", image_front:"", image_back:"", image_side:"", notes:"" };
  const [form, setForm] = useState(emptyPieceForm);
  const [error, setError] = useState("");
  const [vocabulary, setVocabulary] = useState({ piece_name_suggestions:{}, default_piece_name_suggestions:[] });
  useEffect(() => { api("/pattern-vocabulary").then(setVocabulary).catch(() => {}); }, []);
  const selected = patterns.find((item) => item.id === patternId);
  const project = selected && projects.find((p) => p.id === selected.project_id);
  const suggestions = (project && vocabulary.piece_name_suggestions?.[project.category]) || vocabulary.default_piece_name_suggestions || [];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const add = async (event) => {
    event.preventDefault(); setError("");
    if (!patternId) return setError("Select a draft pattern version first.");
    try { await api(`/patterns/${patternId}/pieces`, { method:"POST", body:JSON.stringify(form) }); setForm(emptyPieceForm); await onChanged(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (pieceId) => {
    if (!window.confirm("Remove this pattern piece?")) return;
    try { await api(`/patterns/${patternId}/pieces/${pieceId}`, { method:"DELETE" }); await onChanged(); } catch (err) { setError(err.message); }
  };
  return <section className="mt-5 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
    <div className="mb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Pattern construction</p><h3 className="mt-1 text-lg font-black text-slate-900">Pattern-piece register</h3><p className="mt-1 text-sm text-slate-500">Keep front body, back body, sleeve, collar, cuff, pocket and other cutting pieces in the Pattern version—not in the Tech Pack.</p></div>
    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Draft pattern version<select value={patternId} onChange={(event) => { setPatternId(event.target.value); setError(""); }} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800"><option value="">Select a draft pattern</option>{patterns.filter((pattern) => String(pattern.status || "DRAFT").toUpperCase() === "DRAFT").map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.pattern_no} · {pattern.version} · {pattern.design_no}</option>)}</select></label>
    {selected && <><form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <datalist id="piece-name-suggestions">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      {[["piece_name","Piece name *","Front body"],["piece_code","Piece code","F-01"],["callout_no","Sketch callout","1"],["fabric_reference","Fabric reference","Main fabric"],["cut_quantity","Cut quantity","2"],["grainline","Grainline","Straight grain"],["seam_allowance","Seam allowance","1 cm"],["file_url","CAD / DXF / PDF link","https://..."]].map(([key,label,placeholder]) => <label key={key} className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}<input required={key==="piece_name"} list={key==="piece_name"?"piece-name-suggestions":undefined} value={form[key]} onChange={(event) => update(key,event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-slate-700" /></label>)}
      <label className="xl:col-span-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Grading / size note<input value={form.grading_note} onChange={(event) => update("grading_note",event.target.value)} placeholder="e.g. Grade sleeve length +1 cm each size" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-slate-700" /></label>
      <label className="xl:col-span-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Piece / cutting notes<input value={form.notes} onChange={(event) => update("notes",event.target.value)} placeholder="Notches, cut-on-fold, fusing, directional print etc." className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium normal-case tracking-normal text-slate-700" /></label>
      <div className="xl:col-span-4 grid gap-3 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-3 md:grid-cols-3">
        <p className="md:col-span-3 text-[11px] font-black uppercase tracking-wide text-violet-600">Reference images for this piece (optional)</p>
        {[["image_front","Front view"],["image_back","Back view"],["image_side","Side view"]].map(([key,label]) => <div key={key}>
          <AssetUploader label={label} onUploaded={(urls) => update(key, urls[0] || form[key])} />
          {form[key] && <a href={form[key]} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[11px] font-semibold text-violet-700 underline">{label} uploaded — view</a>}
        </div>)}
      </div>
      <div className="xl:col-span-4"><button className={BTN_PRIMARY}>+ Add pattern piece</button></div>
    </form>
    {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>}
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[1000px] w-full text-xs"><thead className="bg-slate-50"><tr>{["Piece","Code","Callout","Fabric","Cut","Grainline","Seam allowance","File","Views",""].map((heading) => <th key={heading} className="px-3 py-2 text-left font-bold text-slate-500">{heading}</th>)}</tr></thead><tbody>{(selected.pattern_pieces || []).length ? selected.pattern_pieces.map((piece) => <tr key={piece.piece_id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold">{piece.piece_name}</td><td className="px-3 py-2">{piece.piece_code || "—"}</td><td className="px-3 py-2">{piece.callout_no || "—"}</td><td className="px-3 py-2">{piece.fabric_reference || "—"}</td><td className="px-3 py-2">{piece.cut_quantity || "—"}</td><td className="px-3 py-2">{piece.grainline || "—"}</td><td className="px-3 py-2">{piece.seam_allowance || "—"}</td><td className="max-w-[160px] break-all px-3 py-2">{piece.file_url || "—"}</td><td className="px-3 py-2"><div className="flex gap-1">{[["image_front","F"],["image_back","B"],["image_side","S"]].map(([key,tag]) => piece[key] ? <a key={key} href={piece[key]} target="_blank" rel="noreferrer" title={key}><img src={piece[key]} alt={tag} className="h-8 w-8 rounded border object-cover"/></a> : null)}{!piece.image_front && !piece.image_back && !piece.image_side && "—"}</div></td><td className="px-3 py-2"><button type="button" onClick={() => remove(piece.piece_id)} className="font-bold text-rose-600">Remove</button></td></tr>) : <tr><td colSpan="10" className="px-3 py-8 text-center text-slate-400">No pieces recorded for this pattern version yet.</td></tr>}</tbody></table></div></>}
  </section>;
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
  const [patternVocabulary,setPatternVocabulary]=useState(DEFAULT_PATTERN_VOCABULARY);
  const [customVocabInput,setCustomVocabInput]=useState({base_block:"",seam_types:"",closure_types:"",dart_pleat_tuck_details:"",hem_finishes:""});
  const [projectForm,setProjectForm]=useState(emptyProject), [patternForm,setPatternForm]=useState(emptyPattern), [sampleForm,setSampleForm]=useState(emptySample), [queryForm,setQueryForm]=useState(emptyQuery), [releaseForm,setReleaseForm]=useState({project_id:"",tech_pack_id:"",material_plan_id:""});
  const [researchForm,setResearchForm]=useState(emptyResearch), [themeForm,setThemeForm]=useState(emptyTheme), [artworkForm,setArtworkForm]=useState(emptyArtwork), [changeForm,setChangeForm]=useState(emptyChange);
  const [viewChange,setViewChange]=useState(null);
  const [floorDepts,setFloorDepts]=useState(DEFAULT_FLOOR_DEPARTMENTS), [floorWorkers,setFloorWorkers]=useState([]), [floorLogs,setFloorLogs]=useState([]), [floorKpis,setFloorKpis]=useState(null);
  const [floorSection,setFloorSection]=useState("log"), [floorLoaded,setFloorLoaded]=useState(false);
  const [floorError,setFloorError]=useState("");
  const [floorFilters,setFloorFilters]=useState({date_from:"",date_to:"",department:"",worker_id:"",design_no:""});
  const [floorLogForm,setFloorLogForm]=useState(emptyFloorLog()), [floorWorkerForm,setFloorWorkerForm]=useState(emptyFloorWorker), [floorBulk,setFloorBulk]=useState(null);
  // Size-wise cutting entry (Step 2) and wastage-by-category (Step 5): the
  // worker only ever types Size->Qty and Category->Qty rows here; the total
  // completed_qty/wastage_mtrs sent to the backend is derived from these,
  // never a separate number kept in sync by hand.
  const [floorSizeRows,setFloorSizeRows]=useState([]), [floorWasteRows,setFloorWasteRows]=useState([]), [floorWasteCatOptions,setFloorWasteCatOptions]=useState([]);
  // Floor Log Kiosk — a worker's own no-login side of this same tab, opened
  // from a shared link/QR (same pattern as Hybrid Production's Workstation
  // Display). Generating/rotating the link is the only kiosk-related thing
  // HQ does here; the kiosk itself is a separate public page.
  const [kioskToken,setKioskToken]=useState(null), [kioskBusy,setKioskBusy]=useState(false), [kioskCopied,setKioskCopied]=useState(false);
  const [prompt,setPrompt]=useState(null), [projView,setProjView]=useState("table"), [sampleFilter,setSampleFilter]=useState("ALL"), [revisionForm,setRevisionForm]=useState(null);
  // Pattern family/variation library (Part B/C) — browse existing patterns
  // across ALL design numbers before starting a new one from scratch.
  const [patternFamilies,setPatternFamilies]=useState([]), [libraryFamily,setLibraryFamily]=useState(""), [libraryRows,setLibraryRows]=useState([]), [libraryBusy,setLibraryBusy]=useState(false);
  const [cloneForm,setCloneForm]=useState(null);
  const loadFamilies=useCallback(()=>{api("/patterns/families").then(r=>setPatternFamilies(r.data||[])).catch(()=>{});},[]);
  useEffect(()=>{loadFamilies();},[loadFamilies]);
  const browseLibrary=async(family)=>{setLibraryFamily(family);setLibraryBusy(true);try{const r=await api(`/patterns/library?family=${encodeURIComponent(family)}`);setLibraryRows(r.data||[]);}catch(e){setError(e.message);}finally{setLibraryBusy(false);}};
  const load=useCallback(async()=>{ setLoading(true);setError("");try{const [workspace,insights]=await Promise.all([api("/workspace"),api("/insights")]);setData({...workspace,insights:insights.data||[]});api("/settings").then(r=>setSettings(r.data)).catch(()=>setSettings(DEFAULT_SETTINGS));api("/pattern-vocabulary").then(r=>setPatternVocabulary(r.data)).catch(()=>setPatternVocabulary(DEFAULT_PATTERN_VOCABULARY));}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const run=async(path,payload,message)=>{try{const result=await api(path,{method:"POST",body:JSON.stringify(payload)});setNotice(result.message||message);setModal("");await load();}catch(e){setError(e.message);}};
  const saveEditable=async(collection,id,payload,message)=>{try{const result=id?await api(`/${collection}/${id}`,{method:"PATCH",body:JSON.stringify(payload)}):await api(`/${collection}`,{method:"POST",body:JSON.stringify(payload)});setNotice(result.message||message);setModal("");await load();}catch(e){setError(e.message);}};
  const loadFloorOps=useCallback(async()=>{try{setFloorError("");const [depts,workers,kiosk]=await Promise.all([api("/floor-departments"),api("/floor-workers"),api("/floor-kiosk/link")]);setFloorDepts(depts.data?.length?depts.data:DEFAULT_FLOOR_DEPARTMENTS);setFloorWorkers(workers.data||[]);setKioskToken(kiosk.data?.kiosk_token||null);}catch(e){setFloorError(e.message);}},[]);
  const generateKioskLink=async()=>{setKioskBusy(true);try{const r=await api("/floor-kiosk/link",{method:"POST"});setKioskToken(r.data.kiosk_token);setKioskCopied(false);}catch(e){setFloorError(e.message);}finally{setKioskBusy(false);}};
  const kioskUrl=kioskToken?`${window.location.origin}/floor-log-kiosk/${kioskToken}`:"";
  const copyKioskLink=async()=>{if(!kioskUrl)return;try{await navigator.clipboard.writeText(kioskUrl);setKioskCopied(true);setTimeout(()=>setKioskCopied(false),2500);}catch{/* clipboard may be unavailable — the link is still shown on screen to copy by hand */}};
  const loadFloorLogs=useCallback(async(filters)=>{try{setFloorError("");const q=new URLSearchParams(Object.entries(filters||{}).filter(([,v])=>v));const [logs,kpis]=await Promise.all([api(`/floor-logs?${q}`),api(`/floor-kpis?date_from=${filters?.date_from||""}&date_to=${filters?.date_to||""}`)]);setFloorLogs(logs.data||[]);setFloorKpis(kpis);}catch(e){setFloorError(e.message);}},[]);
  useEffect(()=>{if(active==="floorops"&&!floorLoaded){setFloorLoaded(true);loadFloorOps();loadFloorLogs(floorFilters);}},[active,floorLoaded,loadFloorOps,loadFloorLogs,floorFilters]);
  const applyFloorFilters=()=>loadFloorLogs(floorFilters);
  const deleteFloorLog=async(row)=>{
    const reason=window.prompt(`Delete the floor log entry for ${row.worker_name} (${row.department}, ${row.date})?\n\nThis also reverses any fabric it already posted to the Fabric Lot ledger. Enter a reason to continue:`);
    if(reason===null) return;
    if(!reason.trim()) return setFloorError("A reason is required to delete a floor log entry.");
    try{const r=await api(`/floor-logs/${row.id}?reason=${encodeURIComponent(reason.trim())}`,{method:"DELETE"});setNotice(r.message||"Floor log entry deleted.");await loadFloorLogs(floorFilters);}
    catch(e){setFloorError(e.message);}
  };

  // ── Fabric & Production (fabric lot ledger, utilization, reuse, FY planning) ──
  const [fabricSection,setFabricSection]=useState("lots"), [fabricLoaded,setFabricLoaded]=useState(false), [fabricError,setFabricError]=useState("");
  const [fabricLots,setFabricLots]=useState([]), [fabricLotForm,setFabricLotForm]=useState(emptyFabricLot());
  const [fabricTxnTarget,setFabricTxnTarget]=useState(null), [fabricTxnForm,setFabricTxnForm]=useState({type:"ISSUE",qty:"",design_no:"",category:"",note:""});
  const [fabricUtilFilter,setFabricUtilFilter]=useState(""), [fabricUtilData,setFabricUtilData]=useState(null);
  const [fabricReuseTarget,setFabricReuseTarget]=useState(null), [fabricReuseData,setFabricReuseData]=useState(null);
  const [fyDays,setFyDays]=useState(365), [fyData,setFyData]=useState(null), [fyLoading,setFyLoading]=useState(false);
  const [exportingFabric,setExportingFabric]=useState(false);
  const [fabricLotFile,setFabricLotFile]=useState(null);
  const loadFabricLots=useCallback(async()=>{try{setFabricError("");const r=await api("/fabric-lots");setFabricLots(r.data||[]);}catch(e){setFabricError(e.message);}},[]);
  useEffect(()=>{if(active==="fabric"&&!fabricLoaded){setFabricLoaded(true);loadFabricLots();}},[active,fabricLoaded,loadFabricLots]);
  const uploadFabricSwatch=async(lotId,file)=>{if(!file)return;try{await apiUpload(`/fabric-lots/${lotId}/swatch`,file);setNotice("Swatch image saved.");await loadFabricLots();}catch(e2){setFabricError(e2.message);}};
  // Swatch photo can be attached right here at receipt, or added/changed
  // later from the lot's own row — both call the same /swatch upload, so
  // "add it now" and "add it later" are just two doors into one action.
  const submitFabricLot=async(e)=>{e.preventDefault();try{const payload={...fabricLotForm,rate:Number(fabricLotForm.rate)||0,opening_qty:Number(fabricLotForm.opening_qty)||0,received_qty:Number(fabricLotForm.received_qty)||0};const r=await api("/fabric-lots",{method:"POST",body:JSON.stringify(payload)});const newLotId=r.data?.id;setModal("");setFabricLotForm(emptyFabricLot());if(newLotId&&fabricLotFile){await uploadFabricSwatch(newLotId,fabricLotFile);setNotice((r.message||"Fabric lot recorded.")+" Swatch image saved.");}else{setNotice(r.message||"Fabric lot recorded.");await loadFabricLots();}setFabricLotFile(null);}catch(e2){setFabricError(e2.message);}};
  const openFabricTxn=(lot,type)=>{setFabricTxnTarget(lot);setFabricTxnForm({type,qty:"",design_no:lot.design_no||"",category:"",note:""});setModal("fabrictxn");};
  const submitFabricTxn=async(e)=>{e.preventDefault();if(!fabricTxnTarget)return;try{const payload={...fabricTxnForm,qty:Number(fabricTxnForm.qty)||0};const r=await api(`/fabric-lots/${fabricTxnTarget.id}/transactions`,{method:"POST",body:JSON.stringify(payload)});setNotice(r.message||"Transaction recorded.");setModal("");await loadFabricLots();}catch(e2){setFabricError(e2.message);}};
  const loadFabricUtilization=async(designNo)=>{try{setFabricError("");const q=designNo?`?design_no=${encodeURIComponent(designNo)}`:"";const r=await api(`/fabric-utilization${q}`);setFabricUtilData(r.data);}catch(e2){setFabricError(e2.message);}};
  const openFabricReuse=async(lot)=>{setFabricReuseTarget(lot);try{setFabricError("");const r=await api(`/fabric-lots/${lot.id}/reuse-matches`);setFabricReuseData(r.data);}catch(e2){setFabricError(e2.message);}};
  const loadFyPlanning=async()=>{setFyLoading(true);try{setFabricError("");const r=await api(`/fy-planning?days=${fyDays}`);setFyData(r.data);}catch(e2){setFabricError(e2.message);}finally{setFyLoading(false);}};
  const exportFabricUtilization=async()=>{
    if(!fabricUtilData?.by_design?.length){setFabricError("Load utilization data first — nothing to export yet.");return;}
    setExportingFabric(true);setFabricError("");
    try{
      const XLSX=await import("xlsx");
      const summaryRows=fabricUtilData.by_design.map(r=>({
        "Design No.":r.design_no,"Fabric lots":r.lot_count,
        "Received":r.fabric_received,"Issued":r.fabric_issued,"Consumed":r.fabric_consumed,
        "Waste":r.fabric_waste,"Recoverable":r.fabric_recoverable,"Returned":r.fabric_returned,
        "Closing balance":r.closing_balance,
        "Utilization %":r.utilization_pct??"",  "Wastage %":r.wastage_pct??"",
      }));
      const wasteRows=fabricUtilData.by_design.flatMap(r=>(r.waste_by_category||[]).map(w=>({
        "Design No.":r.design_no,"Category":w.label||w.category,"Qty":w.qty,
      })));
      const workbook=XLSX.utils.book_new();
      const summarySheet=XLSX.utils.json_to_sheet(summaryRows);
      summarySheet["!cols"]=[{wch:16},{wch:12},{wch:12},{wch:10},{wch:12},{wch:10},{wch:14},{wch:12},{wch:16},{wch:14},{wch:12}];
      XLSX.utils.book_append_sheet(workbook,summarySheet,"Fabric Utilization");
      const wasteSheet=XLSX.utils.json_to_sheet(wasteRows.length?wasteRows:[{"Design No.":"","Category":"","Qty":""}]);
      wasteSheet["!cols"]=[{wch:16},{wch:22},{wch:10}];
      XLSX.utils.book_append_sheet(workbook,wasteSheet,"Waste by Category");
      const overall=fabricUtilData.overall;
      const readMeSheet=XLSX.utils.aoa_to_sheet([
        ["RMS Fabric Utilization Overview"],
        ["Design filter",fabricUtilFilter?fabricUtilFilter:"All designs"],
        ["Generated at",new Date().toLocaleString("en-IN")],
        ["Designs in this export",summaryRows.length],
        [],
        ...(overall?[["Overall — Received",overall.fabric_received],["Overall — Issued",overall.fabric_issued],["Overall — Consumed",overall.fabric_consumed],["Overall — Waste",overall.fabric_waste],["Overall — Utilization %",overall.utilization_pct??""],["Overall — Wastage %",overall.wastage_pct??""],[]]:[]),
        ["Utilization %","Consumed ÷ Issued — measured against fabric actually issued to the floor, not received (unused stock still in the store correctly doesn't count against it yet)."],
        ["Wastage %","Waste ÷ Issued, by the categories set under Settings → Wastage categories."],
      ]);
      readMeSheet["!cols"]=[{wch:26},{wch:90}];
      XLSX.utils.book_append_sheet(workbook,readMeSheet,"Read Me");
      XLSX.writeFile(workbook,`rms-fabric-utilization-${(fabricUtilFilter||"all-designs").replace(/[^a-z0-9]+/gi,"-")}-${todayISO()}.xlsx`,{compression:true});
    }catch(e2){setFabricError(e2.message||"Unable to export the Excel file.");}
    finally{setExportingFabric(false);}
  };
  const currentFloorDept=floorDepts.find(d=>d.name===floorLogForm.department);
  const currentFloorFields=currentFloorDept?.fields||[];
  const submitFloorLog=async(e)=>{e.preventDefault();try{
    const size_breakdown=floorSizeRows.filter(r=>r.size&&Number(r.qty)>0).map(r=>({size:r.size,qty:Number(r.qty)}));
    const wastage_breakdown=floorWasteRows.filter(r=>r.category&&Number(r.qty)>0).map(r=>({category:r.category,qty:Number(r.qty)}));
    await api("/floor-logs",{method:"POST",body:JSON.stringify({...floorLogForm,size_breakdown,wastage_breakdown})});
    setNotice("Floor log entry saved.");setModal("");setFloorLogForm(emptyFloorLog());setFloorSizeRows([]);setFloorWasteRows([]);await loadFloorLogs(floorFilters);
  }catch(e2){setFloorError(e2.message);}};
  const setFloorLogDepartment=async(deptName)=>{
    setFloorLogForm(f=>({...f,department:deptName}));setFloorSizeRows([]);setFloorWasteRows([]);setFloorWasteCatOptions([]);
    if(!deptName)return;
    try{const r=await api(`/wastage-categories?department=${encodeURIComponent(deptName)}`);setFloorWasteCatOptions(r.data||[]);}catch{/* non-fatal — Waste breakdown just won't offer categories yet */}
  };
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
  const startPattern=(id="")=>{setPatternForm({...emptyPattern,project_id:id,base_size:cfg.default_base_size||emptyPattern.base_size,sizes:cfg.default_size_run||emptyPattern.sizes,wastage_pct:""});setCustomVocabInput({base_block:"",seam_types:"",closure_types:"",dart_pleat_tuck_details:"",hem_finishes:""});setModal("pattern");};
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
          <InternalNotificationBell />
          <InternalChatPanel />
          <button onClick={load} className={BTN_GHOST}><RefreshCw className="h-4 w-4"/><span className="hidden sm:inline">Refresh</span></button>
          <button onClick={()=>{setError("");setActive("settings");}} title="Settings" aria-label="Settings" className={`inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition ${active==="settings"?"border-violet-300 bg-violet-100 text-violet-700":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><Settings className="h-4 w-4"/></button>
          <button onClick={()=>logoutOrReturnToDepartmentSelector()} className={`${BTN} border border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}><LogOut className="h-4 w-4"/><span className="hidden sm:inline">Log out</span></button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1540px] p-4 sm:p-6 lg:p-9">
        {notice&&<div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ {notice}</div>}{error&&<div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/>{error}</div>}
      {GUIDES[active]&&<TabGuide tab={active}/>}
      {BUTTON_GUIDES[active]&&<ButtonGuide tab={active}/>}
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
        {active==="patterns"&&<><PageHead title="Pattern Versions" subtitle="Controlled pattern, grading and consumption." count={data.patterns.length}>
            <button onClick={()=>{setModal("library");browseLibrary(libraryFamily||patternFamilies[0]?.family_name||"");}} className={BTN_GHOST}>Reuse from library</button>
            <button onClick={()=>startPattern()} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Add pattern</button>
          </PageHead>
          <DataTable columns={[
            {key:"pattern_no",label:"Pattern no.",strong:true,nowrap:true},
            {key:"style",label:"Style",render:r=>projectName(r.project_id)},
            {key:"version",label:"Version"},{key:"base_size",label:"Base"},
            {key:"base_block",label:"Block",render:r=>r.base_block||"—"},
            {key:"family",label:"Family",render:r=>r.family_name||"—"},
            {key:"graded",label:"Graded pts",align:"right",render:r=>r.measurement_rows?.length||0},
            {key:"consumption_per_unit",label:"Consumption",align:"right"},{key:"wastage_pct",label:"Manual cutting wastage %",align:"right",render:r=>r.wastage_pct||"—"},
            {key:"status",label:"Status",render:r=><Badge value={r.status}/>},
            {key:"act",label:"",align:"right",render:r=><div className="flex justify-end gap-1.5"><button onClick={()=>{setRevisionForm({id:r.id,version:`v${(Number(String(r.version).replace(/\D/g,""))||1)+1}`,reason:""});setModal("revision");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Revise</button><button onClick={()=>{setCloneForm({source_id:r.id,source_label:`${r.pattern_no} · ${r.family_name||r.base_block||"—"}`,project_id:"",variation_notes:""});setModal("clone");}} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}>Clone as variation</button></div>},
          ]} rows={data.patterns} empty="No pattern versions yet."/>
          <PatternPieceRegister patterns={data.patterns} projects={data.projects} onChanged={load}/>
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
        {active==="floorops"&&<>{floorError&&<div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/><span>{floorError === "Not Found" ? "Daily Floor Log API is not available on the running backend. Restart or redeploy the backend, then refresh this tab." : floorError}</span></div>}<FloorOpsView section={floorSection} setSection={setFloorSection} depts={floorDepts} workers={floorWorkers} logs={floorLogs} kpis={floorKpis} filters={floorFilters} setFilters={setFloorFilters} onApplyFilters={applyFloorFilters} onAddLog={()=>{setFloorLogForm(emptyFloorLog());setFloorSizeRows([]);setFloorWasteRows([]);setFloorWasteCatOptions([]);setModal("floorlog");}} onAddWorker={()=>{setFloorWorkerForm(emptyFloorWorker);setModal("floorworker");}} onToggleWorker={toggleFloorWorker} onUpload={openFloorBulk} onTemplate={()=>apiDownload("/floor-logs/template","daily-floor-log-template.csv").catch(e=>setFloorError(e.message))} onDeleteLog={deleteFloorLog}
          kioskUrl={kioskUrl} kioskBusy={kioskBusy} kioskCopied={kioskCopied} onGenerateKiosk={generateKioskLink} onCopyKiosk={copyKioskLink}/></>}
        {active==="fabric"&&<>{fabricError&&<div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/><span>{fabricError}</span></div>}<FabricProductionView
          section={fabricSection} setSection={setFabricSection}
          lots={fabricLots} onAddLot={()=>{setFabricLotForm(emptyFabricLot());setFabricLotFile(null);setModal("fabriclot");}}
          onIssue={l=>openFabricTxn(l,"ISSUE")} onConsume={l=>openFabricTxn(l,"CONSUME")} onWaste={l=>openFabricTxn(l,"WASTE")} onReturn={l=>openFabricTxn(l,"RETURN")}
          onUploadSwatch={uploadFabricSwatch} onReuse={openFabricReuse}
          utilFilter={fabricUtilFilter} setUtilFilter={setFabricUtilFilter} utilData={fabricUtilData} onLoadUtil={loadFabricUtilization}
          onExportUtil={exportFabricUtilization} exportingUtil={exportingFabric}
          reuseTarget={fabricReuseTarget} reuseData={fabricReuseData}
          fyDays={fyDays} setFyDays={setFyDays} fyData={fyData} fyLoading={fyLoading} onLoadFy={loadFyPlanning}
        /></>}
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
          ]} rows={data.change_requests} empty="No formal change requests." onRow={r=>setViewChange(r)}/>
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
    {modal==="pattern"&&<FormModal title="Add pattern version" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/patterns",{...patternForm,sizes:patternForm.sizes.split(",").map(x=>x.trim()).filter(Boolean),measurement_rows:gradingRows(patternForm.measurement_rows),file_urls:patternForm.file_urls.split("\n").filter(Boolean)}).then(loadFamilies)}}><div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900"><b>Check for an existing pattern first:</b> use "Reuse from library" on the Pattern Versions screen to see if a similar block/style already exists before building a new one from scratch.</div>
      <ProjectSelect value={patternForm.project_id} onChange={v=>setPatternForm({...patternForm,project_id:v})} projects={data.projects}/>
      <Field label="Pattern family (e.g. Classic Shirt, Straight Pant)"><input list="pattern-family-suggestions" value={patternForm.family_name} onChange={e=>setPatternForm({...patternForm,family_name:e.target.value})} placeholder="Group this with other variations of the same base block"/></Field>
      <datalist id="pattern-family-suggestions">{patternFamilies.map(f=><option key={f.family_name} value={f.family_name}/>)}</datalist>
      <Field label="What's different in this variation" wide><input value={patternForm.variation_notes} onChange={e=>setPatternForm({...patternForm,variation_notes:e.target.value})} placeholder="e.g. Same base shirt, Mandarin collar instead of classic collar"/></Field>
      {["pattern_no","pattern_name","version","base_size","sizes","fabric_width","consumption_per_unit","wastage_pct","marker_length","marker_efficiency","seam_allowance","shrinkage_allowance"].map(k=><Field key={k} label={pretty(k)}><input required={["pattern_name","version"].includes(k)} type={["consumption_per_unit","wastage_pct","marker_efficiency"].includes(k)?"number":"text"} value={patternForm[k]} onChange={e=>setPatternForm({...patternForm,[k]:e.target.value})}/></Field>)}<Field label="Base block used"><div><select value={(patternVocabulary.base_block||[]).includes(patternForm.base_block)?patternForm.base_block:""} onChange={e=>setPatternForm({...patternForm,base_block:e.target.value})} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-violet-400"><option value="">Select block</option>{(patternVocabulary.base_block||[]).map(x=><option key={x}>{x}</option>)}</select><div className="mt-1.5 flex gap-1.5"><input value={customVocabInput.base_block} onChange={e=>setCustomVocabInput({...customVocabInput,base_block:e.target.value})} placeholder="Not in the list? Type a custom block" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-violet-400"/><button type="button" onClick={()=>{const v=customVocabInput.base_block.trim();if(v){setPatternForm({...patternForm,base_block:v});setCustomVocabInput({...customVocabInput,base_block:""});}}} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs shrink-0`}>Use</button></div>{patternForm.base_block&&!(patternVocabulary.base_block||[]).includes(patternForm.base_block)&&<p className="mt-1 text-[11px] font-bold text-violet-600">Custom: {patternForm.base_block}</p>}</div></Field>{["seam_types","closure_types","dart_pleat_tuck_details","hem_finishes"].map(field=><Field key={field} label={pretty(field)} wide><div><div className="flex flex-wrap gap-2">{(patternVocabulary[field]||[]).map(opt=><label key={opt} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={patternForm[field].includes(opt)} onChange={e=>setPatternForm({...patternForm,[field]:e.target.checked?[...patternForm[field],opt]:patternForm[field].filter(x=>x!==opt)})}/>{opt}</label>)}{patternForm[field].filter(v=>!(patternVocabulary[field]||[]).includes(v)).map(v=><span key={v} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700">{v}<button type="button" onClick={()=>setPatternForm({...patternForm,[field]:patternForm[field].filter(x=>x!==v)})} className="text-violet-400 hover:text-violet-700">×</button></span>)}</div><div className="mt-1.5 flex gap-1.5"><input value={customVocabInput[field]} onChange={e=>setCustomVocabInput({...customVocabInput,[field]:e.target.value})} placeholder="Not in the list? Type your own and add it" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-violet-400"/><button type="button" onClick={()=>{const v=customVocabInput[field].trim();if(v&&!patternForm[field].includes(v)){setPatternForm({...patternForm,[field]:[...patternForm[field],v]});}setCustomVocabInput({...customVocabInput,[field]:""});}} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs shrink-0`}>Add</button></div></div></Field>)}<Field label="Measurement grading (Point | Base | S:36,M:38...)" wide><textarea rows="4" value={patternForm.measurement_rows} onChange={e=>setPatternForm({...patternForm,measurement_rows:e.target.value})} placeholder={'Chest | 40 | S:36, M:38, L:40, XL:42\nLength | 28 | S:27, M:28, L:29, XL:30'}/></Field><AssetUploader label="Upload CAD / DXF / PDF files" onUploaded={urls=>setPatternForm({...patternForm,file_urls:[patternForm.file_urls,...urls].filter(Boolean).join("\n")})}/><Field label="Technical file links" wide><textarea rows="2" value={patternForm.file_urls} onChange={e=>setPatternForm({...patternForm,file_urls:e.target.value})}/></Field><Field label="Pattern / grading notes" wide><textarea rows="3" value={patternForm.notes} onChange={e=>setPatternForm({...patternForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="sample"&&<FormModal title={sampleForm.id?"Update sample review":"Record sample request / review"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("samples",sampleForm.id,{...sampleForm,image_urls:sampleForm.image_urls.split("\n").filter(Boolean)},"Sample saved.")}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={sampleForm.project_id} onChange={v=>setSampleForm({...sampleForm,project_id:v})} projects={data.projects}/><Field label="Pattern version"><select value={sampleForm.pattern_id} onChange={e=>setSampleForm({...sampleForm,pattern_id:e.target.value})}><option value="">No pattern linked</option>{data.patterns.filter(p=>p.project_id===sampleForm.project_id).map(p=><option key={p.id} value={p.id}>{p.pattern_no} · {p.version}</option>)}</select></Field><Field label="Sample type"><select value={sampleForm.sample_type} onChange={e=>setSampleForm({...sampleForm,sample_type:e.target.value})}>{sampleTypeOptions.map(x=><option key={x}>{x}</option>)}</select></Field>{["quantity","required_date","received_date","assigned_to","estimated_cost","actual_cost"].map(k=><Field key={k} label={pretty(k)}><input type={k.includes("date")?"date":["quantity","estimated_cost","actual_cost"].includes(k)?"number":"text"} value={sampleForm[k]} onChange={e=>setSampleForm({...sampleForm,[k]:e.target.value})}/></Field>)}<Field label="Decision"><select value={sampleForm.decision} onChange={e=>setSampleForm({...sampleForm,decision:e.target.value})}>{DECISIONS.map(x=><option key={x}>{x}</option>)}</select></Field>{["materials","fit_result","construction_result"].map(k=><Field key={k} label={pretty(k)}><input value={sampleForm[k]} onChange={e=>setSampleForm({...sampleForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach front, back, side and fit-review photos" value={sampleForm.image_urls} onChange={v=>setSampleForm({...sampleForm,image_urls:v})}/><Field label="Review / correction notes" wide><textarea required rows="3" value={sampleForm.review_notes} onChange={e=>setSampleForm({...sampleForm,review_notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="query"&&<FormModal title="Raise design query" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/queries",{...queryForm,attachment_urls:queryForm.attachment_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={queryForm.project_id} onChange={v=>setQueryForm({...queryForm,project_id:v})} projects={data.projects}/><Field label="Category"><select value={queryForm.category} onChange={e=>setQueryForm({...queryForm,category:e.target.value})}>{["Measurement clarification","Pattern file missing","Fabric specification","Artwork placement","Trim unavailable","Consumption concern","Construction feasibility","Other"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Priority"><select value={queryForm.priority} onChange={e=>setQueryForm({...queryForm,priority:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></Field><Field label="Question / issue" wide><textarea required rows="4" value={queryForm.description} onChange={e=>setQueryForm({...queryForm,description:e.target.value})}/></Field><AttachmentEditor label="Attach issue photos or screenshots" value={queryForm.attachment_urls} onChange={v=>setQueryForm({...queryForm,attachment_urls:v})}/></div></FormModal>}
    {modal==="release"&&<FormModal title={releaseForm.force?"Release without full sign-off":"Release approved design to Production"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run(`/projects/${releaseForm.project_id}/release`,releaseForm)}}><div className="space-y-4">{releaseForm.force?<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>Override:</b> one or more handoff gates are not met. This still locks the Tech Pack for Production; the reason below is saved on the record.</div>:<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">This locks the selected Tech Pack as the Production reference. Active job orders retain their own snapshot.</div>}{releaseForm.force&&<Field label="Reason for releasing without sign-off *"><textarea required rows="2" value={releaseForm.force_reason||""} onChange={e=>setReleaseForm({...releaseForm,force_reason:e.target.value})} placeholder="e.g. simple restyle of an existing production style, urgent reorder"/></Field>}<Field label="Approved tech pack"><select required value={releaseForm.tech_pack_id} onChange={e=>setReleaseForm({...releaseForm,tech_pack_id:e.target.value})}>{data.tech_packs.filter(t=>t.design_no===data.projects.find(p=>p.id===releaseForm.project_id)?.design_no).map(t=><option key={t.id} value={t.id}>{t.tech_pack_no} · {t.version}</option>)}</select></Field><Field label="Style BOM / material plan"><select value={releaseForm.material_plan_id} onChange={e=>setReleaseForm({...releaseForm,material_plan_id:e.target.value,auto_create_bom:false})}><option value="">No existing BOM selected</option>{data.material_plans.map(p=><option key={p.id} value={p.id}>{p.plan_no} · {p.style_name}</option>)}</select></Field><label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={Boolean(releaseForm.auto_create_bom)} onChange={e=>setReleaseForm({...releaseForm,auto_create_bom:e.target.checked,material_plan_id:e.target.checked?"":releaseForm.material_plan_id})}/><span><b>Automatically create Style BOM</b><br/><span className="text-slate-500">Uses planned quantity and the latest pattern consumption/wastage.</span></span></label>{releaseForm.auto_create_bom&&<Field label="Main material name"><input value={releaseForm.material_name||""} onChange={e=>setReleaseForm({...releaseForm,material_name:e.target.value})} placeholder="Main fabric"/></Field>}</div></FormModal>}
    {modal==="research"&&<FormModal title={researchForm.id?"Update research reference":"Add research reference"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("research",researchForm.id,{...researchForm,tags:researchForm.tags.split(",").map(x=>x.trim()).filter(Boolean),reference_urls:researchForm.reference_urls.split("\n").filter(Boolean)},"Research reference saved.")}}><div className="grid gap-4 md:grid-cols-2">{["title","category","season","market_segment"].map(k=><Field key={k} label={pretty(k)}><input required={k==="title"} value={researchForm[k]} onChange={e=>setResearchForm({...researchForm,[k]:e.target.value})}/></Field>)}<Field label="Department"><select value={researchForm.department} onChange={e=>setResearchForm({...researchForm,department:e.target.value})}>{deptOptions.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Tags (comma separated)"><input value={researchForm.tags} onChange={e=>setResearchForm({...researchForm,tags:e.target.value})}/></Field><AttachmentEditor label="Attach mood-board images and research documents" accept="image/*,.pdf" value={researchForm.reference_urls} onChange={v=>setResearchForm({...researchForm,reference_urls:v})}/><Field label="Research findings" wide><textarea rows="4" value={researchForm.notes} onChange={e=>setResearchForm({...researchForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="artwork"&&<FormModal title={artworkForm.id?"Update artwork":"Add print or artwork"} onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();saveEditable("artworks",artworkForm.id,{...artworkForm,file_urls:artworkForm.file_urls.split("\n").filter(Boolean)},"Artwork saved.")}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={artworkForm.project_id} onChange={v=>setArtworkForm({...artworkForm,project_id:v})} projects={data.projects}/>{["name","kind","version","width","height","placement","technique","colours","status"].map(k=><Field key={k} label={pretty(k)}><input required={k==="name"} value={artworkForm[k]} onChange={e=>setArtworkForm({...artworkForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach artwork previews and source files" accept="image/*,.pdf,.ai,.psd,.cdr" value={artworkForm.file_urls} onChange={v=>setArtworkForm({...artworkForm,file_urls:v})}/><Field label="Instructions" wide><textarea rows="3" value={artworkForm.notes} onChange={e=>setArtworkForm({...artworkForm,notes:e.target.value})}/></Field></div></FormModal>}
    {modal==="change"&&<FormModal title="Create formal change request" onClose={()=>setModal("")} onSubmit={e=>{e.preventDefault();run("/change-requests",{...changeForm,before_urls:changeForm.before_urls.split("\n").filter(Boolean),after_urls:changeForm.after_urls.split("\n").filter(Boolean)})}}><div className="grid gap-4 md:grid-cols-2"><ProjectSelect value={changeForm.project_id} onChange={v=>setChangeForm({...changeForm,project_id:v})} projects={data.projects}/>{["reason","previous_spec","new_spec","material_impact","cost_impact","delivery_impact"].map(k=><Field key={k} label={pretty(k)} wide={["reason","previous_spec","new_spec"].includes(k)}><textarea required={["reason","previous_spec","new_spec"].includes(k)} rows="2" value={changeForm[k]} onChange={e=>setChangeForm({...changeForm,[k]:e.target.value})}/></Field>)}<AttachmentEditor label="Attach photos of the current specification" value={changeForm.before_urls} onChange={v=>setChangeForm({...changeForm,before_urls:v})}/><AttachmentEditor label="Attach marked-up or proposed revision images" value={changeForm.after_urls} onChange={v=>setChangeForm({...changeForm,after_urls:v})}/></div></FormModal>}
    {viewChange&&<Modal title={`Change request ${viewChange.change_no||""}`} onClose={()=>setViewChange(null)}><div className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Design</p><p className="text-sm font-bold text-slate-800">{projectName(viewChange.project_id)}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p><Badge value={viewChange.status}/></div>
        <div className="sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Reason</p><p className="text-sm text-slate-700">{viewChange.reason||"—"}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Previous spec</p><p className="text-sm text-slate-700">{viewChange.previous_spec||"—"}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">New spec</p><p className="text-sm text-slate-700">{viewChange.new_spec||"—"}</p></div>
      </div>
      <DocumentComments refType="wastage_exception" refId={viewChange.id} title="Comments on this change request"/>
    </div></Modal>}
    {modal==="floorlog"&&<FormModal title="Log a floor entry" onClose={()=>setModal("")} onSubmit={submitFloorLog}>
      <div className="mb-4 rounded-xl bg-violet-50 p-3 text-xs text-violet-900">Floor workers have no login — fill this in on their behalf. Pick a name from the directory, or type a walk-in's name below.</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date"><input type="date" required value={floorLogForm.date} onChange={e=>setFloorLogForm({...floorLogForm,date:e.target.value})}/></Field>
        <Field label="Time"><input type="time" value={floorLogForm.time} onChange={e=>setFloorLogForm({...floorLogForm,time:e.target.value})}/></Field>
        <Field label="Department *"><select required value={floorLogForm.department} onChange={e=>setFloorLogDepartment(e.target.value)}><option value="">Select department</option>{floorDepts.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}</select></Field>
        <Field label="Worker (from directory)"><select value={floorLogForm.worker_id} onChange={e=>{const w=floorWorkers.find(x=>x.id===e.target.value);setFloorLogForm({...floorLogForm,worker_id:e.target.value,worker_name:w?w.name:floorLogForm.worker_name});}}><option value="">— Not in directory, type below —</option>{floorWorkers.filter(w=>w.active!==false).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="Worker name *"><input required value={floorLogForm.worker_name} onChange={e=>setFloorLogForm({...floorLogForm,worker_name:e.target.value,worker_id:""})} placeholder="Full name"/></Field>
        <Field label="Style / Design no."><input list="dp-floor-design-list" value={floorLogForm.design_no} onChange={e=>setFloorLogForm({...floorLogForm,design_no:e.target.value})}/></Field>
        <Field label="Job Work Order # (blank for in-house staff)"><input value={floorLogForm.job_work_order_id} onChange={e=>setFloorLogForm({...floorLogForm,job_work_order_id:e.target.value})} placeholder="Only if this is a job worker's output"/></Field>
        {!currentFloorFields.length&&<p className="md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">Choose a department to see its fields.</p>}
        {currentFloorFields.map(key=>{
          const meta=FLOOR_FIELD_META[key]||{label:pretty(key),type:"text"};
          const label=currentFloorDept?.labels?.[key]||meta.label;
          // completed_qty/wastage_mtrs are replaced by the Size and Wastage
          // breakdown editors below once at least one row is in use — the
          // worker enters Size->Qty / Category->Qty, never a second total
          // that has to be kept in sync by hand.
          if(key==="completed_qty"&&floorSizeRows.length) return null;
          if(key==="wastage_mtrs"&&floorWasteRows.length) return null;
          if(key==="remarks") return <Field key={key} label={label} wide><textarea rows="2" value={floorLogForm.remarks} onChange={e=>setFloorLogForm({...floorLogForm,remarks:e.target.value})}/></Field>;
          if(key==="on_time") return <Field key={key} label={label}><select value={floorLogForm.on_time?"yes":"no"} onChange={e=>setFloorLogForm({...floorLogForm,on_time:e.target.value==="yes"})}><option value="yes">Yes</option><option value="no">No</option></select></Field>;
          if(meta.type==="number") return <Field key={key} label={label}><input type="number" min="0" step="0.01" value={floorLogForm[key]} onChange={e=>setFloorLogForm({...floorLogForm,[key]:e.target.value})}/></Field>;
          return <Field key={key} label={label}><input value={floorLogForm[key]} onChange={e=>setFloorLogForm({...floorLogForm,[key]:e.target.value})}/></Field>;
        })}
      </div>
      {currentFloorFields.includes("completed_qty")&&<div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Size-wise quantity (optional — leave off to just use the total above)</p><button type="button" onClick={()=>setFloorSizeRows([...floorSizeRows,{size:"",qty:""}])} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}><Plus className="h-3 w-3"/>Add size</button></div>
        {floorSizeRows.map((row,i)=><div key={i} className="mb-2 flex items-center gap-2">
          <input placeholder="Size (S, M, L…)" value={row.size} onChange={e=>setFloorSizeRows(floorSizeRows.map((r,idx)=>idx===i?{...r,size:e.target.value}:r))} className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/>
          <input type="number" min="0" placeholder="Qty" value={row.qty} onChange={e=>setFloorSizeRows(floorSizeRows.map((r,idx)=>idx===i?{...r,qty:e.target.value}:r))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/>
          <button type="button" onClick={()=>setFloorSizeRows(floorSizeRows.filter((_,idx)=>idx!==i))} className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4"/></button>
        </div>)}
        {floorSizeRows.length>0&&<p className="text-xs font-bold text-violet-700">Total: {floorSizeRows.reduce((s,r)=>s+(Number(r.qty)||0),0)} pcs — this becomes the completed qty automatically.</p>}
      </div>}
      {currentFloorFields.includes("wastage_mtrs")&&<div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Wastage by category (optional — leave off to just use the total above)</p><button type="button" onClick={()=>setFloorWasteRows([...floorWasteRows,{category:"",qty:""}])} disabled={!floorWasteCatOptions.length} className={`${BTN_SUBTLE} !px-2 !py-1 text-xs`}><Plus className="h-3 w-3"/>Add category</button></div>
        {!floorWasteCatOptions.length&&<p className="text-xs text-slate-400">Categories load once a department is selected.</p>}
        {floorWasteRows.map((row,i)=><div key={i} className="mb-2 flex items-center gap-2">
          <select value={row.category} onChange={e=>setFloorWasteRows(floorWasteRows.map((r,idx)=>idx===i?{...r,category:e.target.value}:r))} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"><option value="">Select category</option>{floorWasteCatOptions.map(c=><option key={c.code} value={c.code}>{c.label}{c.is_recoverable?" (recoverable)":""}</option>)}</select>
          <input type="number" min="0" step="0.01" placeholder="Qty" value={row.qty} onChange={e=>setFloorWasteRows(floorWasteRows.map((r,idx)=>idx===i?{...r,qty:e.target.value}:r))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/>
          <button type="button" onClick={()=>setFloorWasteRows(floorWasteRows.filter((_,idx)=>idx!==i))} className="text-rose-500 hover:text-rose-700"><X className="h-4 w-4"/></button>
        </div>)}
        {floorWasteRows.length>0&&<p className="text-xs font-bold text-violet-700">Total: {floorWasteRows.reduce((s,r)=>s+(Number(r.qty)||0),0)} — this becomes the wastage total automatically.</p>}
      </div>}
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
    {modal==="fabriclot"&&<FormModal title="Receive fabric lot" onClose={()=>setModal("")} onSubmit={submitFabricLot}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fabric name *"><input required value={fabricLotForm.fabric_name} onChange={e=>setFabricLotForm({...fabricLotForm,fabric_name:e.target.value})}/></Field>
        <Field label="Lot No. *"><input required value={fabricLotForm.lot_no} onChange={e=>setFabricLotForm({...fabricLotForm,lot_no:e.target.value})}/></Field>
        <Field label="Roll No."><input value={fabricLotForm.roll_no} onChange={e=>setFabricLotForm({...fabricLotForm,roll_no:e.target.value})}/></Field>
        <Field label="Colour / shade"><input value={fabricLotForm.colour} onChange={e=>setFabricLotForm({...fabricLotForm,colour:e.target.value})}/></Field>
        <Field label="Width"><input value={fabricLotForm.width} onChange={e=>setFabricLotForm({...fabricLotForm,width:e.target.value})} placeholder="e.g. 58in"/></Field>
        <Field label="GSM"><input value={fabricLotForm.gsm} onChange={e=>setFabricLotForm({...fabricLotForm,gsm:e.target.value})}/></Field>
        <Field label="Vendor"><input value={fabricLotForm.vendor_name} onChange={e=>setFabricLotForm({...fabricLotForm,vendor_name:e.target.value})}/></Field>
        <Field label="Unit"><select value={fabricLotForm.unit} onChange={e=>setFabricLotForm({...fabricLotForm,unit:e.target.value})}><option value="MTR">MTR</option><option value="KG">KG</option><option value="UNIT">UNIT</option></select></Field>
        <Field label="Received qty *"><input required type="number" min="0.01" step="0.01" value={fabricLotForm.received_qty} onChange={e=>setFabricLotForm({...fabricLotForm,received_qty:e.target.value})}/></Field>
        <Field label="Opening qty (carried over, if any)"><input type="number" min="0" step="0.01" value={fabricLotForm.opening_qty} onChange={e=>setFabricLotForm({...fabricLotForm,opening_qty:e.target.value})}/></Field>
        <Field label="Rate (per unit)"><input type="number" min="0" step="0.01" value={fabricLotForm.rate} onChange={e=>setFabricLotForm({...fabricLotForm,rate:e.target.value})}/></Field>
        <Field label="Design No. (optional link)"><input value={fabricLotForm.design_no} onChange={e=>setFabricLotForm({...fabricLotForm,design_no:e.target.value})}/></Field>
        <Field label="QC status"><select value={fabricLotForm.qc_status} onChange={e=>setFabricLotForm({...fabricLotForm,qc_status:e.target.value})}><option value="PENDING">Pending</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option></select></Field>
        <Field label="QC note"><input value={fabricLotForm.qc_note} onChange={e=>setFabricLotForm({...fabricLotForm,qc_note:e.target.value})}/></Field>
        <Field label="Notes" wide><textarea rows="2" value={fabricLotForm.notes} onChange={e=>setFabricLotForm({...fabricLotForm,notes:e.target.value})}/></Field>
        <Field label="Swatch photo (optional)" wide>
          <div>
            <input type="file" accept="image/*" onChange={e=>setFabricLotFile(e.target.files?.[0]||null)}/>
            {fabricLotFile&&<p className="mt-1.5 text-xs font-semibold text-violet-700">{fabricLotFile.name} selected — uploaded once the lot is saved.</p>}
          </div>
        </Field>
      </div>
    </FormModal>}
    {modal==="fabrictxn"&&fabricTxnTarget&&<FormModal title={`${pretty(fabricTxnForm.type)} — ${fabricTxnTarget.lot_no}`} onClose={()=>{setModal("");setFabricTxnTarget(null);}} onSubmit={submitFabricTxn}>
      <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Balance on hand: <b className="text-slate-900">{fabricTxnTarget.closing_balance} {fabricTxnTarget.unit}</b>{fabricTxnForm.type!=="ISSUE"&&<> · Issued fabric still unaccounted for: <b className="text-slate-900">{Math.max(0,(fabricTxnTarget.issued_qty||0)-(fabricTxnTarget.consumed_qty||0)-(fabricTxnTarget.waste_qty||0)-(fabricTxnTarget.returned_qty||0)).toFixed(2)} {fabricTxnTarget.unit}</b></>}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type"><select value={fabricTxnForm.type} onChange={e=>setFabricTxnForm({...fabricTxnForm,type:e.target.value})}><option value="ISSUE">Issue (to floor)</option><option value="CONSUME">Consume</option><option value="WASTE">Waste</option><option value="RETURN">Return (unused, back to store)</option></select></Field>
        <Field label={`Quantity (${fabricTxnTarget.unit}) *`}><input required type="number" min="0.01" step="0.01" value={fabricTxnForm.qty} onChange={e=>setFabricTxnForm({...fabricTxnForm,qty:e.target.value})}/></Field>
        {fabricTxnForm.type==="WASTE"&&<Field label="Wastage category *"><select required value={fabricTxnForm.category} onChange={e=>setFabricTxnForm({...fabricTxnForm,category:e.target.value})}><option value="">Select category</option>{(cfg.wastage_categories||DEFAULT_WASTAGE_CATEGORIES).map(c=><option key={c.code} value={c.code}>{c.label}{c.is_recoverable?" (recoverable)":""}</option>)}</select></Field>}
        <Field label="Design No."><input value={fabricTxnForm.design_no} onChange={e=>setFabricTxnForm({...fabricTxnForm,design_no:e.target.value})}/></Field>
        <Field label="Note" wide><input value={fabricTxnForm.note} onChange={e=>setFabricTxnForm({...fabricTxnForm,note:e.target.value})}/></Field>
      </div>
    </FormModal>}
    {modal==="library"&&<Modal title="Pattern variation library" onClose={()=>setModal("")}><div className="space-y-4 p-5 sm:p-6">
      <p className="text-sm text-slate-500">Browse every pattern already built for a given base silhouette, across all design numbers — reuse or clone the closest match instead of starting from scratch.</p>
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Family<select value={libraryFamily} onChange={e=>browseLibrary(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800"><option value="">Select a pattern family</option>{patternFamilies.map(f=><option key={f.family_name} value={f.family_name}>{f.family_name} ({f.variations})</option>)}</select></label>
      {!patternFamilies.length&&<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No patterns are tagged with a family yet. Add a "Pattern family" name next time you create a pattern to start building this library.</p>}
      {libraryBusy?<p className="text-sm text-slate-400">Loading…</p>:<div className="grid gap-3 sm:grid-cols-2">{libraryRows.map(row=><div key={row.id} className="rounded-xl border border-slate-200 p-3">
        {row.preview_image&&<img src={row.preview_image} alt="" className="mb-2 h-28 w-full rounded-lg object-cover"/>}
        <p className="text-sm font-bold text-slate-900">{row.pattern_no} · {row.design_no}</p>
        <p className="text-xs text-slate-500">{row.base_block||"No base block set"}</p>
        {row.variation_notes&&<p className="mt-1 text-xs font-semibold text-violet-700">{row.variation_notes}</p>}
        <button onClick={()=>{setCloneForm({source_id:row.id,source_label:`${row.pattern_no} · ${row.family_name}`,project_id:"",variation_notes:""});setModal("clone");}} className={`${BTN_SUBTLE} mt-2 !px-2.5 !py-1 text-xs`}>Clone as new variation</button>
      </div>)}{libraryFamily&&!libraryRows.length&&!libraryBusy&&<p className="sm:col-span-2 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-400">No variations found for this family yet — this would be the first.</p>}</div>}
    </div></Modal>}
    {modal==="clone"&&cloneForm&&<FormModal title="Clone as new pattern variation" onClose={()=>{setModal("");setCloneForm(null);}} onSubmit={e=>{e.preventDefault();run(`/patterns/${cloneForm.source_id}/clone`,{project_id:cloneForm.project_id,variation_notes:cloneForm.variation_notes},"Pattern cloned.").then(loadFamilies);setCloneForm(null);}}>
      <div className="grid gap-4">
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900">Copying construction, measurements, size ratio and pattern pieces (with their images) from <b>{cloneForm.source_label}</b> onto a new pattern under the design you pick below. Edit only what's actually different afterwards.</div>
        <ProjectSelect value={cloneForm.project_id} onChange={v=>setCloneForm({...cloneForm,project_id:v})} projects={data.projects}/>
        <Field label="What's different in this variation" wide><input value={cloneForm.variation_notes} onChange={e=>setCloneForm({...cloneForm,variation_notes:e.target.value})} placeholder="e.g. Mandarin collar instead of classic collar"/></Field>
      </div>
    </FormModal>}
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
    allowance_limits:{...DEFAULT_SETTINGS.allowance_limits,...(base.allowance_limits||{})},
    wastage_categories:(base.wastage_categories?.length?base.wastage_categories:DEFAULT_WASTAGE_CATEGORIES).map(c=>({...c,departments_text:(c.departments||[]).join(", ")})),
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
        allowance_limits:form.allowance_limits,
        wastage_categories:form.wastage_categories.map(c=>({code:c.code,label:c.label,is_recoverable:c.is_recoverable,departments:c.departments_text.split(",").map(x=>x.trim()).filter(Boolean)})).filter(c=>c.code.trim()),
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
        <StatCard label="Pattern base size" value={form.default_base_size||"—"} accent="emerald" hint="No automatic wastage"/>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className="block"><span className={labelClass}>Product departments <span className="font-semibold normal-case text-slate-400">— one per line</span></span><textarea rows="8" value={form.departments} onChange={event=>set("departments",event.target.value)} className={box}/><span className="mt-1 block text-xs text-slate-400">Used by Design Projects and Research &amp; Mood Boards.</span></label>
        <label className="block"><span className={labelClass}>Sample types <span className="font-semibold normal-case text-slate-400">— one per line</span></span><textarea rows="8" value={form.sample_types} onChange={event=>set("sample_types",event.target.value)} className={box}/><span className="mt-1 block text-xs text-slate-400">Used when recording sample requests and approvals.</span></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={labelClass}>Default base size</span><input value={form.default_base_size} onChange={event=>set("default_base_size",event.target.value)} className={box}/></label>
        <label className="block"><span className={labelClass}>Default size run</span><input value={form.default_size_run} onChange={event=>set("default_size_run",event.target.value)} className={box}/></label>
      </div>
      <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <div><p className={labelClass}>Manual allowance exception limits</p><p className="text-xs leading-5 text-slate-500">These numbers never add wastage automatically. They only decide when a manually entered Tech Pack allowance must be approved by HQ.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(form.allowance_limits||{}).map(([process,rule])=><label key={process} className="block"><span className={labelClass}>{pretty(process)}</span><div className="flex"><input type="number" min="0" step="0.01" value={rule.value} onChange={event=>setForm(current=>({...current,allowance_limits:{...current.allowance_limits,[process]:{...rule,value:Number(event.target.value)||0}}}))} className={box}/><span className="ml-1 grid min-w-20 place-items-center rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500">{String(rule.unit||"").replaceAll("_"," / ")}</span></div></label>)}</div>
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div><p className={labelClass}>Wastage categories</p><p className="text-xs leading-5 text-slate-500">Rename, remove, add or re-scope these to your own floor departments. "Recoverable" means the fabric can still be reused elsewhere (Fabric &amp; Production → Reuse matches) rather than true scrap. A category left with no departments is offered everywhere.</p></div>
        <div className="space-y-2">{form.wastage_categories.map((cat,i)=><div key={i} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-[1fr_1fr_auto_1fr_auto]">
          <input value={cat.code} onChange={e=>setForm(cur=>({...cur,wastage_categories:cur.wastage_categories.map((x,n)=>n===i?{...x,code:e.target.value.toLowerCase().replace(/\s+/g,"_")}:x)}))} placeholder="code (e.g. shade_issue)" className={`${box} !py-1.5 text-xs`}/>
          <input value={cat.label} onChange={e=>setForm(cur=>({...cur,wastage_categories:cur.wastage_categories.map((x,n)=>n===i?{...x,label:e.target.value}:x)}))} placeholder="Label shown to staff" className={`${box} !py-1.5 text-xs`}/>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold text-slate-600"><input type="checkbox" checked={cat.is_recoverable} onChange={e=>setForm(cur=>({...cur,wastage_categories:cur.wastage_categories.map((x,n)=>n===i?{...x,is_recoverable:e.target.checked}:x)}))}/>Recoverable</label>
          <input value={cat.departments_text} onChange={e=>setForm(cur=>({...cur,wastage_categories:cur.wastage_categories.map((x,n)=>n===i?{...x,departments_text:e.target.value}:x)}))} placeholder="Departments, comma separated (blank = everywhere)" className={`${box} !py-1.5 text-xs`}/>
          <button type="button" onClick={()=>setForm(cur=>({...cur,wastage_categories:cur.wastage_categories.filter((_,n)=>n!==i)}))} className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">Remove</button>
        </div>)}</div>
        <button type="button" onClick={()=>setForm(cur=>({...cur,wastage_categories:[...cur.wastage_categories,{code:"",label:"",is_recoverable:false,departments_text:""}]}))} className={`${BTN_SUBTLE} !px-3 !py-1.5 text-xs`}><Plus className="h-3.5 w-3.5"/>Add category</button>
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
        <p className={labelClass}>Production handoff gates</p>
        <p className="text-xs text-slate-400">Which sign-offs a design needs before it can be released to Production. Turn off what your shop doesn't do — a design-owned Tech Pack can still always be released without them via "Release without sign-off".</p>
        {[["require_sample_approval","Require an approved sample"],["require_design_head_approval","Require Design Head approval"],["require_production_feasibility","Require Production feasibility approval"]].map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form[key]} onChange={event=>set(key,event.target.checked)}/>{label}</label>)}
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Safe additive behavior:</b> existing projects, saved pattern wastage and released production references are never rewritten. New wastage and allowances are always entered manually.</div>
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

function FloorOpsView({section,setSection,depts,workers,logs,kpis,filters,setFilters,onApplyFilters,onAddLog,onAddWorker,onToggleWorker,onUpload,onTemplate,onDeleteLog,kioskUrl,kioskBusy,kioskCopied,onGenerateKiosk,onCopyKiosk}){
  const sectionBtn=(v)=>"rounded-lg px-3.5 py-2 text-sm font-bold transition "+(section===v?"bg-violet-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-100");
  return <div className="space-y-5">
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Floor operations sections">
      <button type="button" onClick={()=>setSection("log")} className={sectionBtn("log")}>Daily Log</button>
      <button type="button" onClick={()=>setSection("workers")} className={sectionBtn("workers")}>Floor Workers</button>
      <button type="button" onClick={()=>setSection("kpi")} className={sectionBtn("kpi")}>KPI Summary</button>
    </nav>
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/60">
      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div><h3 className="text-sm font-black text-slate-900">Floor Log Kiosk — a worker's own side of this same log</h3><p className="mt-0.5 text-xs text-slate-500">No login needed. Open this link on a shared floor tablet/PC — the worker picks their name, taps Start, then End when the work is done. This is purely an extra entry point; manual entry and Excel upload below still work exactly the same.</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button onClick={onGenerateKiosk} disabled={kioskBusy} className={BTN_SUBTLE}>{kioskBusy?"Working…":(kioskUrl?"Rotate link":"Generate kiosk link")}</button>
          {kioskUrl&&<button onClick={onCopyKiosk} className={BTN_PRIMARY}>{kioskCopied?"Copied ✓":"Copy link"}</button>}
        </div>
      </div>
      {kioskUrl&&<div className="border-t border-violet-100 bg-white px-4 py-3"><p className="break-all font-mono text-xs text-slate-600">{kioskUrl}</p><p className="mt-1 text-[11px] text-amber-700">Rotating replaces this link — the old one stops working immediately. Use that if a printed QR is lost.</p></div>}
    </section>
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
          {(l.size_breakdown||[]).length>0&&<p className="mt-1.5 text-[11px] text-slate-500">Sizes: {l.size_breakdown.map(s=>`${s.size} ${s.qty}`).join(", ")}</p>}
          {(l.wastage_breakdown||[]).length>0&&<p className="mt-1 text-[11px] text-slate-500">Waste: {l.wastage_breakdown.map(w=>`${w.label||w.category} ${w.qty}`).join(", ")}</p>}
          {l.remarks&&<p className="mt-1.5 text-xs text-slate-500">{l.remarks}</p>}
          <button onClick={()=>onDeleteLog(l)} className="mt-2 text-[11px] font-bold text-rose-600">Delete entry</button>
        </div>):<p className="p-10 text-center text-sm text-slate-400">No entries yet for this filter.</p>}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{["Date","Dept","Worker","Style","Target","Done","Rework","Rejected","Fabric(m)","Waste(m)","On-time","Remarks",""].map(h=><th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
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
              <td className="px-3 py-2.5 text-xs"><button onClick={()=>onDeleteLog(l)} className="font-bold text-rose-600">Delete</button></td>
            </tr>):<tr><td colSpan={13} className="p-10 text-center text-sm text-slate-400">No entries yet for this filter.</td></tr>}
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

// ── Fabric & Production ──────────────────────────────────────────────────
// Fabric Lot/Roll ledger, Utilization dashboard, Reuse matching and Annual/FY
// Planning — all additive, all reading/writing the /api/design-pattern
// endpoints built for this module. Every derived number here (balance,
// utilization %, planned fabric, next-year suggestion) is computed by the
// backend; this view only ever asks for the raw facts (received qty, issue
// qty, category…) per the module's core principle.
function FabricProductionView({section,setSection,lots,onAddLot,onIssue,onConsume,onWaste,onReturn,onUploadSwatch,onReuse,utilFilter,setUtilFilter,utilData,onLoadUtil,onExportUtil,exportingUtil,reuseTarget,reuseData,fyDays,setFyDays,fyData,fyLoading,onLoadFy}){
  const sectionBtn=(v)=>"rounded-lg px-3.5 py-2 text-sm font-bold transition "+(section===v?"bg-violet-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-100");
  return <div className="space-y-5">
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Fabric & Production sections">
      <button type="button" onClick={()=>setSection("lots")} className={sectionBtn("lots")}>Fabric Lots</button>
      <button type="button" onClick={()=>setSection("utilization")} className={sectionBtn("utilization")}>Utilization</button>
      <button type="button" onClick={()=>setSection("fy")} className={sectionBtn("fy")}>FY Planning</button>
    </nav>

    {section==="lots"&&<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div><h2 className="text-base font-black text-slate-900">Fabric lot / roll ledger</h2><p className="mt-0.5 text-sm text-slate-500">Every physical roll received, with a live balance. Balance, issued and consumed are calculated — never typed.</p></div>
        <button onClick={onAddLot} className={BTN_PRIMARY}><Plus className="h-4 w-4"/>Receive lot</button>
      </div>
      <div className="divide-y divide-slate-100">
        {lots.length?lots.map(l=><div key={l.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {l.swatch_image_url?<img src={l.swatch_image_url} alt="Fabric swatch" className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"/>:<label className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-100">Swatch<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)onUploadSwatch(l.id,f);}}/></label>}
              <div>
                <p className="font-black text-slate-900">{l.fabric_name} <span className="font-normal text-slate-400">· {l.lot_no}{l.roll_no?` / ${l.roll_no}`:""}</span></p>
                <p className="text-xs text-slate-500">{[l.colour,l.width,l.gsm&&`${l.gsm} GSM`,l.vendor_name].filter(Boolean).join(" · ")||"No details recorded"}{l.design_no?<span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{l.design_no}</span>:null}</p>
              </div>
            </div>
            <Badge value={l.qc_status}/>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[["Received",l.received_qty],["Issued",l.issued_qty],["Consumed",l.consumed_qty],["Waste",l.waste_qty],["Returned",l.returned_qty],["Balance",l.closing_balance]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-2 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className={`text-sm font-black ${label==="Balance"?"text-violet-700":"text-slate-900"}`}>{value} <span className="text-[9px] font-normal text-slate-400">{l.unit}</span></p></div>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button onClick={()=>onIssue(l)} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs`}>Issue</button>
            <button onClick={()=>onConsume(l)} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs`}>Consume</button>
            <button onClick={()=>onWaste(l)} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs`}>Waste</button>
            <button onClick={()=>onReturn(l)} className={`${BTN_SUBTLE} !px-2.5 !py-1 text-xs`}>Return</button>
            <button onClick={()=>onReuse(l)} className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100">Reuse matches</button>
          </div>
          {reuseTarget?.id===l.id&&reuseData&&<div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 text-xs text-cyan-900">
            {reuseData.matches?.length?<><p className="font-bold">Same fabric ({reuseData.fabric_name}, {reuseData.colour}, {reuseData.width}, {reuseData.gsm} GSM) is also in use for:</p><ul className="mt-1.5 space-y-1">{reuseData.matches.map(m=><li key={m.design_no}>• <b>{m.design_no}</b> — {m.own_balance} {reuseData.unit} of its own balance, {m.lot_count} lot(s)</li>)}</ul></>:<p>{reuseData.note}</p>}
          </div>}
        </div>):<Empty>No fabric lots received yet.</Empty>}
      </div>
    </section>}

    {section==="utilization"&&<div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Design No. (blank = all designs)</span><input value={utilFilter} onChange={e=>setUtilFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" placeholder="e.g. D-101"/></label>
        <button onClick={()=>onLoadUtil(utilFilter)} className={BTN_PRIMARY}><RefreshCw className="h-4 w-4"/>Load utilization</button>
        <button onClick={onExportUtil} disabled={!utilData?.by_design?.length||exportingUtil} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"><FileText className="mr-1 inline h-4 w-4"/>{exportingUtil?"Preparing…":"Export Excel"}</button>
      </div>
      {utilData?<>
        {utilData.by_design?.map(row=><section key={row.design_no} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4"><p className="font-black text-slate-900">{row.design_no}</p><p className="text-xs text-slate-500">{row.lot_count} fabric lot(s)</p></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-8">
            {[["Received",row.fabric_received],["Issued",row.fabric_issued],["Consumed",row.fabric_consumed],["Waste",row.fabric_waste],["Recoverable",row.fabric_recoverable],["Returned",row.fabric_returned],["Balance",row.closing_balance]].map(([l,v])=><StatCard key={l} label={l} value={v} accent="cyan"/>)}
            <StatCard label="Utilization" value={row.utilization_pct!=null?`${row.utilization_pct}%`:"—"} accent={row.utilization_pct>=70?"emerald":row.utilization_pct>=40?"amber":"rose"} hint={`Wastage ${row.wastage_pct!=null?row.wastage_pct+"%":"—"}`}/>
          </div>
          {row.waste_by_category?.length>0&&<div className="border-t border-slate-100 p-4"><p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">Waste by category</p><div className="flex flex-wrap gap-2">{row.waste_by_category.map(w=><span key={w.category} className={CHIP}>{w.label}: {w.qty}</span>)}</div></div>}
        </section>)}
        {!utilData.by_design?.length&&<Empty>No fabric lots recorded for this filter yet.</Empty>}
      </>:<Empty>Load a design (or leave blank for every design) to see its fabric utilization.</Empty>}
    </div>}

    {section==="fy"&&<div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Look-back period (days)</span><input type="number" min="1" max="1095" value={fyDays} onChange={e=>setFyDays(e.target.value)} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"/></label>
        <button onClick={onLoadFy} disabled={fyLoading} className={BTN_PRIMARY}><TrendingUp className="h-4 w-4"/>{fyLoading?"Loading…":"Load FY planning"}</button>
      </div>
      {fyData?<div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Best fabric utilization" subtitle="Highest consumed÷issued — replicate what these designs did right.">{fyData.utilization_ranking?.best?.length?fyData.utilization_ranking.best.map(r=><div key={r.design_no} className="flex items-center justify-between rounded-xl border p-3 text-sm"><b>{r.design_no}</b><span className="text-xs font-bold text-emerald-600">{r.utilization_pct}% utilized</span></div>):<Empty>No data yet.</Empty>}</Panel>
          <Panel title="Worst fabric utilization" subtitle="Lowest consumed÷issued — investigate marker/cutting practice.">{fyData.utilization_ranking?.worst?.length?fyData.utilization_ranking.worst.map(r=><div key={r.design_no} className="flex items-center justify-between rounded-xl border p-3 text-sm"><b>{r.design_no}</b><span className="text-xs font-bold text-rose-600">{r.utilization_pct}% utilized</span></div>):<Empty>No data yet.</Empty>}</Panel>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Time efficiency — internal workers" subtitle="Elapsed vs standard time, summed across every operation.">{fyData.time_efficiency?.by_worker?.length?fyData.time_efficiency.by_worker.map(w=><div key={w.name} className="flex items-center justify-between rounded-xl border p-3 text-sm"><b>{w.name}</b><span className={`text-xs font-bold ${w.variance_pct>0?"text-rose-600":"text-emerald-600"}`}>{w.variance_pct>0?"+":""}{w.variance_pct}%</span></div>):<Empty>No timed operations yet.</Empty>}</Panel>
          <Panel title="Time efficiency — external job workers" subtitle="Elapsed vs standard time, summed across every operation.">{fyData.time_efficiency?.by_vendor?.length?fyData.time_efficiency.by_vendor.map(v=><div key={v.name} className="flex items-center justify-between rounded-xl border p-3 text-sm"><b>{v.name}</b><span className={`text-xs font-bold ${v.variance_pct>0?"text-rose-600":"text-emerald-600"}`}>{v.variance_pct>0?"+":""}{v.variance_pct}%</span></div>):<Empty>No timed operations yet.</Empty>}</Panel>
        </div>
        <Panel title="Next-FY fabric purchase suggestions" subtitle="Sold qty × this design's own pattern consumption. A size-ratio mismatch means the cut plan is worth re-grading before next year.">
          {fyData.next_fy_suggestions?.length?fyData.next_fy_suggestions.map(s=><div key={s.design_no} className="rounded-xl border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{s.design_no}</b><span className="text-xs text-slate-500">Sold {s.sold_qty} pcs{s.suggested_fabric_qty!=null?` · Suggested fabric: ${s.suggested_fabric_qty}`:""}</span></div>
            {s.note&&<p className="mt-1 text-xs text-amber-700">{s.note}</p>}
            {s.size_ratio_mismatches?.length>0&&<div className="mt-2 flex flex-wrap gap-1.5">{s.size_ratio_mismatches.map(m=><span key={m.size} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">{m.size}: pattern {m.pattern_ratio_pct}% vs sold {m.actual_sold_pct}%</span>)}</div>}
          </div>):<Empty>No sale-proven designs in this period yet.</Empty>}
        </Panel>
      </div>:<Empty>Load FY planning to see utilization ranking, time efficiency and next-year fabric suggestions from real sales.</Empty>}
    </div>}
  </div>;
}
