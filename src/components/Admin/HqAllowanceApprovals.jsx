import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Ruler, XCircle } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const authHeaders = () => ({
  "Content-Type":"application/json",
  Authorization:"Bearer "+(localStorage.getItem("admin_token")||localStorage.getItem("access_token")||localStorage.getItem("token")||""),
});

async function request(path,options={}){
  const response=await fetch(API_BASE_URL+"/api/job-work"+path,{...options,headers:{...authHeaders(),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.detail||"Unable to load allowance approvals.");
  return data;
}

export default function HqAllowanceApprovals(){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const result=await request("/allowance-approvals?status=PENDING");setRows(result.data||[]);}catch(err){setError(err.message);}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const decide=async(pack,decision)=>{
    const promptText=decision==="APPROVED"?"Optional approval note:":"Reason / correction required:";
    const note=window.prompt(promptText,"");
    if(note===null)return;
    if(decision!=="APPROVED"&&!note.trim()){window.alert("A reason is required.");return;}
    setBusy(pack.id);setError("");
    try{await request("/tech-packs/"+pack.id+"/allowance-decision",{method:"POST",body:JSON.stringify({decision,note:note.trim()})});setRows(current=>current.filter(item=>item.id!==pack.id));}
    catch(err){setError(err.message);}finally{setBusy("");}
  };
  return <div className="space-y-5 p-5 sm:p-7">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-3xl bg-gradient-to-br from-slate-950 via-amber-950 to-violet-900 p-6 text-white shadow-xl"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-200">HQ exception control</p><h1 className="mt-2 text-2xl font-black">Fabric allowance approvals</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">Review only manually declared pattern, layering, cutting, stitching or finishing allowances that exceed this tenant's configured limit. Approval never adds wastage automatically.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black"><RefreshCw size={15}/>Refresh</button></header>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><b>What to check:</b> confirm the fabric, process, value, basis, production quantity and technical reason. Approve only the exception; the Tech Pack still follows its normal sample, Design Head and Production feasibility gates.</div>
    {error&&<p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
    {loading?<p className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Loading requests...</p>:rows.length===0?<div className="rounded-2xl border bg-white p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-500"/><p className="mt-3 font-black text-slate-800">No allowance exceptions are waiting</p><p className="mt-1 text-sm text-slate-500">Normal manual entries within policy do not enter this queue.</p></div>:<div className="space-y-4">{rows.map(pack=><article key={pack.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><Ruler size={19}/></span><div><h2 className="font-black text-slate-900">{pack.design_no} · {pack.style_name}</h2><p className="text-xs text-slate-500">{pack.tech_pack_no} · {pack.version} · submitted by {pack.allowance_approval?.submitted_by||"Design & Pattern"}</p></div></div><span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800"><AlertTriangle size={12}/>PENDING HQ</span></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-xs"><thead className="bg-white"><tr>{["Process","Allowance","Fabric","Entered","HQ limit","Basis","Worker","Justification"].map(value=><th key={value} className="px-4 py-3 text-left font-black uppercase text-slate-500">{value}</th>)}</tr></thead><tbody>{(pack.process_allowances||[]).filter(row=>row.exceeds_limit).map((row,index)=><tr key={index} className="border-t"><td className="px-4 py-3 font-black">{row.process}</td><td className="px-4 py-3">{row.allowance_type}</td><td className="px-4 py-3">{row.fabric_reference||"All"}</td><td className="px-4 py-3 font-black text-rose-700">{row.value} {String(row.unit).replaceAll("_"," / ")}</td><td className="px-4 py-3">{row.approval_limit} {String(row.approval_limit_unit).replaceAll("_"," / ")}</td><td className="px-4 py-3">{row.basis}</td><td className="px-4 py-3">{row.worker_scope}</td><td className="max-w-sm px-4 py-3">{row.reason}</td></tr>)}</tbody></table></div>
      <footer className="flex justify-end gap-2 border-t p-4"><button disabled={busy===pack.id} onClick={()=>decide(pack,"CHANGES_REQUESTED")} className="inline-flex items-center gap-1 rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-700"><AlertTriangle size={14}/>Request changes</button><button disabled={busy===pack.id} onClick={()=>decide(pack,"REJECTED")} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700"><XCircle size={14}/>Reject</button><button disabled={busy===pack.id} onClick={()=>decide(pack,"APPROVED")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><CheckCircle2 size={14}/>Approve exception</button></footer>
    </article>)}</div>}
  </div>;
}
