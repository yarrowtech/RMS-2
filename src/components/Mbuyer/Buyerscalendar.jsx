import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";

const API = `${APP_API_URL}/mbuyer/calendar`;

/* ─── Event type config ─── */
const EVENT_TYPES = {
  season_open:       { label:"Season Open",        color:"#22C55E", icon:"🌱" },
  season_close:      { label:"Season Close",       color:"#EF4444", icon:"🍂" },
  trade_fair:        { label:"Trade Fair",         color:"#6366F1", icon:"🏪" },
  sample_deadline:   { label:"Sample Deadline",    color:"#F97316", icon:"📦" },
  negotiation:       { label:"Negotiation",        color:"#0EA5E9", icon:"🤝" },
  otb_review:        { label:"OTB Review",         color:"#7C3AED", icon:"💰" },
  vendor_visit:      { label:"Vendor Visit",       color:"#10B981", icon:"🚗" },
  ordering_deadline: { label:"Ordering Deadline",  color:"#EF4444", icon:"⏰" },
  payment:           { label:"Payment Milestone",  color:"#F59E0B", icon:"💳" },
  custom:            { label:"Custom",             color:"#64748B", icon:"📌" },
  po_due:            { label:"PO Due",             color:"#0EA5E9", icon:"📋", auto:true },
  po_overdue:        { label:"PO Overdue",         color:"#EF4444", icon:"🔴", auto:true },
  vendor_review:     { label:"Vendor Submitted",   color:"#7C3AED", icon:"⏳", auto:true },
  vendor_pending:    { label:"Pending Approval",   color:"#F97316", icon:"🏪", auto:true },
};

const MANUAL_TYPES = Object.entries(EVENT_TYPES)
  .filter(([,v]) => !v.auto)
  .map(([k,v]) => ({ key:k, ...v }));

/* ─── helpers ─── */
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = (d) => d ? new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "";
const ymd = (y,m,d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function firstDayOfMonth(year, month) { return new Date(year, month-1, 1).getDay(); }

/* ─── EventPill ─── */
function EventPill({ ev, onClick }) {
  const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
  return (
    <div onClick={e => { e.stopPropagation(); onClick(ev); }}
      style={{
        display:"flex", alignItems:"center", gap:3,
        padding:"1px 5px", borderRadius:4, marginBottom:2,
        background: cfg.color+"22", border:`1px solid ${cfg.color}44`,
        cursor:"pointer", overflow:"hidden",
      }}>
      <span style={{ fontSize:9 }}>{cfg.icon}</span>
      <span style={{ fontSize:9, fontWeight:700, color:cfg.color,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:80 }}>
        {ev.title}
      </span>
    </div>
  );
}

/* ─── EventDetail modal ─── */
function EventDetail({ ev, onClose, onEdit, onDelete }) {
  if (!ev) return null;
  const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
      zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:20, padding:24, width:"100%", maxWidth:420,
        boxShadow:"0 24px 64px rgba(15,27,45,0.25)", fontFamily:"'Plus Jakarta Sans',sans-serif" }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:20 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:cfg.color+"18",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
            {cfg.icon}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#0F1B2D",
              wordBreak:"break-word" }}>{ev.title}</div>
            <div style={{ fontSize:11, fontWeight:700, marginTop:3,
              color:cfg.color, textTransform:"uppercase", letterSpacing:"0.06em" }}>
              {cfg.label} {ev.source==="auto" ? "• Auto" : "• Manual"}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8,
              width:28, height:28, cursor:"pointer", fontSize:14, color:"#64748B",
              flexShrink:0 }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
          <Row icon="📅" label="Date"   value={fmtDate(ev.date)} />
          {ev.endDate && <Row icon="📅" label="End Date" value={fmtDate(ev.endDate)} />}
          {ev.vendorName && <Row icon="🏪" label="Vendor"   value={ev.vendorName} />}
          {ev.poNo      && <Row icon="📋" label="PO No"     value={ev.poNo} />}
          {ev.notes     && <Row icon="📝" label="Notes"     value={ev.notes} />}
        </div>

        {ev.editable && (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onEdit}
              style={{ flex:1, padding:"9px", borderRadius:10, background:"#6366F1",
                color:"#fff", fontWeight:700, fontSize:13, border:"none", cursor:"pointer" }}>
              ✏ Edit
            </button>
            <button onClick={onDelete}
              style={{ flex:1, padding:"9px", borderRadius:10, background:"#FEF2F2",
                color:"#EF4444", fontWeight:700, fontSize:13, border:"1px solid #FECACA", cursor:"pointer" }}>
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
          textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
        <div style={{ fontSize:13, color:"#0F1B2D", fontWeight:500, marginTop:1 }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Add/Edit form modal ─── */
function EventForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    title:"", type:"custom", date:today(), endDate:"", notes:"", vendorName:"", poNo:"",
    color: EVENT_TYPES.custom.color,
  });
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (t) => {
    setForm(f => ({ ...f, type:t, color: EVENT_TYPES[t]?.color || f.color }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    if (!form.date)          { alert("Date is required."); return; }
    setSaving(true);
    try { await onSave(form); }
    catch { alert("Failed to save."); }
    finally { setSaving(false); }
  };

  const INP = {
    width:"100%", padding:"9px 12px", borderRadius:10,
    border:"1.5px solid #E4EAF3", fontSize:13, outline:"none",
    boxSizing:"border-box", fontFamily:"inherit",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:20, padding:24, width:"100%", maxWidth:480,
        boxShadow:"0 24px 64px rgba(15,27,45,0.25)", fontFamily:"'Plus Jakarta Sans',sans-serif",
        maxHeight:"90vh", overflowY:"auto" }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:"#0F1B2D" }}>
            {initial?.id ? "Edit Event" : "Add Event"}
          </h3>
          <button onClick={onClose}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8,
              width:30, height:30, cursor:"pointer", fontSize:15, color:"#64748B" }}>✕</button>
        </div>

        {/* Event Type selector */}
        <div style={{ marginBottom:16 }}>
          <Label>Event Type</Label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {MANUAL_TYPES.map(t => (
              <button key={t.key} onClick={() => handleTypeChange(t.key)}
                style={{
                  padding:"5px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                  cursor:"pointer", border:"1.5px solid",
                  background: form.type===t.key ? t.color : t.color+"12",
                  borderColor: t.color,
                  color: form.type===t.key ? "#fff" : t.color,
                  transition:"all 0.15s",
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        {[
          { label:"Title *",      field:"title",      type:"text",     ph:"e.g. Delhi Trade Fair" },
          { label:"Date *",       field:"date",        type:"date",     ph:"" },
          { label:"End Date",     field:"endDate",     type:"date",     ph:"" },
          { label:"Vendor Name",  field:"vendorName",  type:"text",     ph:"Optional" },
          { label:"PO Reference", field:"poNo",        type:"text",     ph:"Optional" },
        ].map(({ label, field, type, ph }) => (
          <div key={field} style={{ marginBottom:14 }}>
            <Label>{label}</Label>
            <input type={type} value={form[field]||""} placeholder={ph}
              onChange={e => setForm(f=>({...f,[field]:e.target.value}))}
              style={INP}/>
          </div>
        ))}

        <div style={{ marginBottom:14 }}>
          <Label>Notes</Label>
          <textarea value={form.notes||""} placeholder="Additional details…" rows={2}
            onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
            style={{...INP, resize:"vertical"}}/>
        </div>

        {/* Color picker */}
        <div style={{ marginBottom:20 }}>
          <Label>Colour</Label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["#6366F1","#0EA5E9","#22C55E","#F97316","#EF4444","#7C3AED","#F59E0B","#10B981","#64748B","#EC4899"].map(c=>(
              <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                style={{ width:26, height:26, borderRadius:"50%", background:c, border:"none",
                  cursor:"pointer", outline: form.color===c ? `3px solid ${c}` : "none",
                  outlineOffset:2, transition:"outline 0.1s" }}/>
            ))}
            <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
              style={{ width:26, height:26, borderRadius:"50%", border:"none",
                cursor:"pointer", padding:0 }}/>
          </div>
        </div>

        {/* Preview dot */}
        <div style={{ marginBottom:16, display:"flex", alignItems:"center", gap:8,
          padding:"8px 12px", borderRadius:10, background:form.color+"12",
          border:`1px solid ${form.color}33` }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:form.color, flexShrink:0 }}/>
          <span style={{ fontSize:12, fontWeight:700, color:form.color }}>
            {EVENT_TYPES[form.type]?.icon} {form.title || "Event preview"}
          </span>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:1, padding:"11px", borderRadius:12,
              background:`linear-gradient(135deg,#6366F1,#4F46E5)`,
              color:"#fff", fontWeight:700, fontSize:14, border:"none",
              cursor:"pointer", opacity:saving?0.6:1 }}>
            {saving ? "Saving…" : initial?.id ? "Update Event" : "Create Event"}
          </button>
          <button onClick={onClose}
            style={{ padding:"11px 18px", borderRadius:12, background:"#F1F5F9",
              color:"#64748B", fontWeight:600, fontSize:14, border:"none", cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748B",
      textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>
      {children}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN CALENDAR COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function BuyersCalendar() {
  const now     = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);   // "YYYY-MM-DD"
  const [detailEv,    setDetailEv]    = useState(null);   // event being viewed
  const [formData,    setFormData]    = useState(null);   // null=closed, {}=new, ev=edit
  const [listFilter,  setListFilter]  = useState("all");

  const monthStr = `${year}-${String(month).padStart(2,"0")}`;

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(API, { params:{ month: monthStr } });
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }, [monthStr]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /* ── Navigation ── */
  const prevMonth = () => {
    if (month === 1) { setYear(y=>y-1); setMonth(12); }
    else setMonth(m=>m-1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y=>y+1); setMonth(1); }
    else setMonth(m=>m+1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth()+1);
    setSelectedDay(today());
  };

  /* ── Calendar grid ── */
  const gridDays = useMemo(() => {
    const total   = daysInMonth(year, month);
    const firstDow= firstDayOfMonth(year, month); // 0=Sun
    const cells   = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const dayMap  = data?.day_map || {};
  const summary = data?.summary || {};
  const events  = data?.events  || [];

  /* ── CRUD ── */
  const handleCreate = async (form) => {
    await axios.post(API, form);
    setFormData(null);
    await fetchEvents();
  };

  const handleUpdate = async (form) => {
    await axios.put(`${API}/${form.id}`, form);
    setFormData(null);
    setDetailEv(null);
    await fetchEvents();
  };

  const handleDelete = async (ev) => {
    if (!window.confirm("Delete this event?")) return;
    await axios.delete(`${API}/${ev.id}`);
    setDetailEv(null);
    await fetchEvents();
  };

  /* ── Selected day events ── */
  const selectedEvents = selectedDay ? (dayMap[selectedDay] || []) : [];

  /* ── List view filtered events ── */
  const listEvents = useMemo(() => {
    if (listFilter === "all") return events;
    return events.filter(e => e.type === listFilter);
  }, [events, listFilter]);

  const todayStr = today();
  const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTH_NAMES  = ["","January","February","March","April","May","June",
                         "July","August","September","October","November","December"];

  return (
    <div style={{ padding:24, fontFamily:"'Plus Jakarta Sans',sans-serif",
      minHeight:"100%", display:"flex", flexDirection:"column", gap:16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#0F1B2D" }}>
            Buyer's Calendar
          </h2>
          <p style={{ margin:"4px 0 0", fontSize:13, color:"#64748B" }}>
            Season plans, trade fairs, PO deadlines and vendor meetings
          </p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={goToday}
            style={{ padding:"8px 14px", borderRadius:10, background:"#F1F5F9",
              border:"1px solid #E4EAF3", color:"#475569", fontSize:13,
              fontWeight:600, cursor:"pointer" }}>
            Today
          </button>
          <button onClick={() => setFormData({})}
            style={{ padding:"8px 16px", borderRadius:10,
              background:"linear-gradient(135deg,#6366F1,#4F46E5)",
              color:"#fff", fontSize:13, fontWeight:700, border:"none", cursor:"pointer" }}>
            + Add Event
          </button>
        </div>
      </div>

      {/* ── Summary pills ── */}
      {!loading && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { label:"Total Events", val:summary.total||0,          color:"#6366F1" },
            { label:"PO Due",       val:summary.po_due||0,         color:"#0EA5E9" },
            { label:"PO Overdue",   val:summary.po_overdue||0,     color:"#EF4444" },
            { label:"Needs Review", val:summary.vendor_review||0,  color:"#7C3AED" },
            { label:"Approvals",    val:summary.vendor_pending||0, color:"#F97316" },
            { label:"Manual",       val:summary.manual||0,         color:"#22C55E" },
          ].map(s => (
            <div key={s.label} style={{ padding:"5px 12px", borderRadius:20,
              background:s.color+"12", border:`1px solid ${s.color}33`,
              fontSize:12, fontWeight:700, color:s.color }}>
              {s.val} {s.label}
            </div>
          ))}
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:16, minHeight:0 }}>

        {/* Calendar */}
        <div style={{ background:"#fff", borderRadius:18, border:"1px solid #E4EAF3",
          overflow:"hidden", boxShadow:"0 2px 12px rgba(15,27,45,0.06)" }}>

          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"16px 20px", borderBottom:"1px solid #F1F5F9" }}>
            <button onClick={prevMonth}
              style={{ width:34, height:34, borderRadius:10, border:"1px solid #E4EAF3",
                background:"#F8FAFD", cursor:"pointer", fontSize:16, color:"#475569",
                display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
            <div style={{ fontWeight:800, fontSize:17, color:"#0F1B2D" }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={nextMonth}
              style={{ width:34, height:34, borderRadius:10, border:"1px solid #E4EAF3",
                background:"#F8FAFD", cursor:"pointer", fontSize:16, color:"#475569",
                display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)",
            borderBottom:"1px solid #F1F5F9" }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ padding:"8px 0", textAlign:"center",
                fontSize:10, fontWeight:800, color:"#94A3B8",
                textTransform:"uppercase", letterSpacing:"0.08em" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>
              Loading calendar…
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
              {gridDays.map((day, i) => {
                if (!day) return (
                  <div key={`empty-${i}`} style={{ minHeight:90, borderRight:"1px solid #F8FAFD",
                    borderBottom:"1px solid #F8FAFD", background:"#FAFBFD" }}/>
                );

                const dateStr    = ymd(year, month, day);
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;
                const cellEvents = dayMap[dateStr] || [];
                const hasOverdue = cellEvents.some(e => e.type === "po_overdue");
                const hasPODue   = cellEvents.some(e => e.type === "po_due");

                return (
                  <div key={day}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    style={{
                      minHeight:90, padding:"6px 6px 4px",
                      borderRight:"1px solid #F8FAFD",
                      borderBottom:"1px solid #F8FAFD",
                      cursor:"pointer",
                      background: isSelected ? "#EEF2FF"
                        : isToday ? "#F0F9FF"
                        : "#fff",
                      transition:"background 0.15s",
                      position:"relative",
                    }}>

                    {/* Day number */}
                    <div style={{
                      width:26, height:26, borderRadius:"50%",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, fontWeight:isToday?800:600,
                      background: isToday ? "#6366F1" : "transparent",
                      color: isToday ? "#fff" : isSelected ? "#6366F1" : "#374151",
                      marginBottom:3,
                    }}>{day}</div>

                    {/* Event pills — show max 2 + overflow */}
                    {cellEvents.slice(0,2).map((ev,ei) => (
                      <EventPill key={ei} ev={ev} onClick={setDetailEv}/>
                    ))}
                    {cellEvents.length > 2 && (
                      <div style={{ fontSize:9, color:"#6366F1", fontWeight:700,
                        padding:"1px 4px" }}>
                        +{cellEvents.length-2} more
                      </div>
                    )}

                    {/* Urgency dot in corner */}
                    {(hasOverdue || hasPODue) && (
                      <div style={{
                        position:"absolute", top:4, right:4,
                        width:6, height:6, borderRadius:"50%",
                        background: hasOverdue ? "#EF4444" : "#0EA5E9",
                      }}/>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, overflow:"auto" }}>

          {/* Selected day detail */}
          {selectedDay ? (
            <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3",
              padding:16, boxShadow:"0 2px 10px rgba(15,27,45,0.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#0F1B2D" }}>
                    {fmtDate(selectedDay)}
                  </div>
                  <div style={{ fontSize:11, color:"#94A3B8" }}>
                    {selectedEvents.length} event{selectedEvents.length!==1?"s":""}
                  </div>
                </div>
                <button onClick={() => setFormData({ date: selectedDay })}
                  style={{ padding:"5px 10px", borderRadius:8, background:"#6366F1",
                    color:"#fff", fontSize:11, fontWeight:700, border:"none", cursor:"pointer" }}>
                  + Add
                </button>
              </div>

              {selectedEvents.length === 0 ? (
                <div style={{ textAlign:"center", padding:"20px 0", color:"#94A3B8",
                  fontSize:13 }}>
                  No events on this day.
                  <br/>
                  <button onClick={() => setFormData({ date: selectedDay })}
                    style={{ marginTop:8, padding:"6px 14px", borderRadius:8,
                      background:"#F1F5F9", border:"1px solid #E4EAF3", color:"#475569",
                      fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    Add Event
                  </button>
                </div>
              ) : selectedEvents.map((ev, i) => {
                const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
                return (
                  <div key={i}
                    onClick={() => setDetailEv(ev)}
                    style={{
                      display:"flex", alignItems:"flex-start", gap:10,
                      padding:"8px 10px", borderRadius:10, cursor:"pointer",
                      background: cfg.color+"0D", border:`1px solid ${cfg.color}22`,
                      marginBottom:8, transition:"background 0.15s",
                    }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{cfg.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#0F1B2D",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize:10, color:cfg.color, fontWeight:700,
                        marginTop:1 }}>{cfg.label}</div>
                      {ev.vendorName && (
                        <div style={{ fontSize:10, color:"#94A3B8" }}>🏪 {ev.vendorName}</div>
                      )}
                    </div>
                    {ev.editable && (
                      <span style={{ fontSize:10, color:"#CBD5E1" }}>›</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Event list view */
            <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3",
              padding:16, boxShadow:"0 2px 10px rgba(15,27,45,0.05)", flex:1, overflow:"auto" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:800, color:"#0F1B2D" }}>
                  {data?.month_label || "Events"}
                </div>
              </div>

              {/* Filter */}
              <select value={listFilter} onChange={e=>setListFilter(e.target.value)}
                style={{ width:"100%", padding:"7px 10px", borderRadius:8,
                  border:"1.5px solid #E4EAF3", fontSize:12, outline:"none",
                  marginBottom:12, background:"#fff" }}>
                <option value="all">All Events</option>
                {Object.entries(EVENT_TYPES).map(([k,v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>

              {/* Legend */}
              <div style={{ marginBottom:12, display:"flex", flexWrap:"wrap", gap:4 }}>
                {[
                  { label:"Auto (PO/Vendor)", color:"#0EA5E9" },
                  { label:"Manual",           color:"#22C55E" },
                ].map(l => (
                  <div key={l.label} style={{ display:"flex", alignItems:"center",
                    gap:4, fontSize:10, color:"#64748B" }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:l.color, flexShrink:0 }}/>
                    {l.label}
                  </div>
                ))}
              </div>

              <div style={{ maxHeight:400, overflowY:"auto" }}>
                {loading ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94A3B8" }}>Loading…</div>
                ) : listEvents.length === 0 ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94A3B8", fontSize:13 }}>
                    No events this month.
                    <br/>Click a day or + Add Event to create one.
                  </div>
                ) : listEvents.map((ev, i) => {
                  const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.custom;
                  return (
                    <div key={i} onClick={() => setDetailEv(ev)}
                      style={{
                        display:"flex", alignItems:"flex-start", gap:10,
                        padding:"8px 10px", borderRadius:10, cursor:"pointer",
                        marginBottom:6, border:"1px solid #F1F5F9",
                        transition:"background 0.15s",
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background="#F8FAFD"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                        background:cfg.color+"18", display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:14 }}>{cfg.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#0F1B2D",
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {ev.title}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                          <span style={{ fontSize:10, color:cfg.color, fontWeight:700 }}>{cfg.label}</span>
                          <span style={{ fontSize:10, color:"#94A3B8",
                            fontFamily:"'DM Mono',monospace" }}>{ev.date}</span>
                        </div>
                        {ev.vendorName && (
                          <div style={{ fontSize:10, color:"#94A3B8" }}>🏪 {ev.vendorName}</div>
                        )}
                      </div>
                      <div style={{ width:8, height:8, borderRadius:"50%",
                        background:cfg.color, flexShrink:0, marginTop:6 }}/>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Event type legend */}
          <div style={{ background:"#fff", borderRadius:16, border:"1px solid #E4EAF3",
            padding:16, boxShadow:"0 2px 10px rgba(15,27,45,0.05)" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#0F1B2D", marginBottom:10 }}>
              Event Types
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {Object.entries(EVENT_TYPES).map(([k,v]) => (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12 }}>{v.icon}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:"#475569", flex:1 }}>{v.label}</span>
                  <span style={{ width:8, height:8, borderRadius:2,
                    background:v.color, flexShrink:0 }}/>
                  {v.auto && (
                    <span style={{ fontSize:9, color:"#94A3B8", fontWeight:700 }}>AUTO</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {detailEv && (
        <EventDetail
          ev={detailEv}
          onClose={() => setDetailEv(null)}
          onEdit={() => { setFormData({...detailEv}); setDetailEv(null); }}
          onDelete={() => handleDelete(detailEv)}
        />
      )}

      {formData !== null && (
        <EventForm
          initial={formData?.id ? formData : (formData?.date ? {...formData} : null)}
          onSave={formData?.id ? handleUpdate : handleCreate}
          onClose={() => setFormData(null)}
        />
      )}
    </div>
  );
}