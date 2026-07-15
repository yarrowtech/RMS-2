import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useEffect, useState, useCallback } from "react";
import { Plus, Search, Edit, Trash2, X, PlusCircle, MinusCircle, FileText } from "lucide-react";
import toast from "react-hot-toast";

const API   = `${APP_API_URL}/mbuyer/debit-notes`;
const token = localStorage.getItem("admin_token") || localStorage.getItem("token") || "";
const hdrs  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const makeId = () => `DN-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyItem = () => ({
  id: makeId(), description: "", hsnCode: "", qty: "", unit: "MTRS",
  goodsReturnRate: "", goodsReturnAmount: "", shortReceivedRate: "", shortReceivedAmount: "",
  rateDifferenceRate: "", rateDifferenceAmount: "", taxableValue: ""
});

const emptyForm = () => ({
  companyAddress: "", companyState: "", companyCode: "", companyContact: "", companyEmail: "", companyGSTIN: "",
  originalInvoiceNo: "", serialNo: "", originalInvoiceDate: "", date: "", placeOfSupply: "", despatchThrough: "",
  receiverName: "", receiverAddress: "", receiverState: "", receiverCode: "", receiverGSTIN: "",
  consigneeName: "", consigneeAddress: "", consigneeState: "", consigneeCode: "", consigneeGSTIN: "",
  items: [emptyItem()],
  cgstPercent: "0", sgstPercent: "0", igstPercent: "5",
  totalAmountInWords: "", remarks: "Being amount debited for Goods Returned",
  companyPan: "", cinNo: "", vendorSeal: "", authorisedSignatory: "",
});

const convertNumberToWords = (amount) => {
  if (!amount || amount === 0) return "Zero Only";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const numToWords = (num) => {
    if (num === 0) return "";
    if (num < 20) return a[num] + " ";
    if (num < 100) return b[Math.floor(num/10)] + (num%10!==0?" "+a[num%10]:"") + " ";
    return a[Math.floor(num/100)] + " Hundred " + (num%100!==0?numToWords(num%100):"");
  };
  const intPart = Math.floor(amount), frac = Math.round((amount-intPart)*100);
  let words = "";
  if (intPart>9999999) words += numToWords(Math.floor(intPart/10000000))+"Crore ";
  if (intPart>99999)   words += numToWords(Math.floor((intPart%10000000)/100000))+"Lakh ";
  if (intPart>999)     words += numToWords(Math.floor((intPart%100000)/1000))+"Thousand ";
  if (intPart>0)       words += numToWords(intPart%1000);
  else if (!words)     words = "Zero ";
  if (frac>0) words += "and "+numToWords(frac)+"Paise ";
  return words.trim()+" Only";
};

export default function Mbuyer1DebitNote() {
  const [view,      setView]      = useState("list");
  const [search,    setSearch]    = useState("");
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState(emptyForm());

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}${search ? `?search=${encodeURIComponent(search)}` : ""}`, { headers: hdrs });
      const data = await res.json();
      // Re-attach local ids to items so row remove works in edit mode
      setRecords((Array.isArray(data.data) ? data.data : []).map(r => ({
        ...r, items: (r.items||[]).map(it => ({ ...it, id: it.id || makeId() }))
      })));
    } catch { toast.error("Failed to load debit notes"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd  = () => { setEditingId(null); setForm(emptyForm()); setView("form"); };
  const openEdit = (r)  => {
    setEditingId(r.id);
    setForm({ ...r, items: (r.items||[]).map(it => ({ ...it, id: it.id||makeId() })) });
    setView("form");
  };

  const handleDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-1">
        <span className="font-bold text-black text-base">Are you sure you want to delete this debit note?</span>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => { toast.dismiss(t.id); toast.error("Cancelled"); }}
            className="px-4 py-2 text-sm font-bold text-black bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            await fetch(`${API}/${id}`, { method: "DELETE", headers: hdrs });
            toast.success("Debit note deleted successfully!");
            fetchAll();
          }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: "#ffffff", color: "#000000", border: "1px solid #e2e8f0" } });
  };

  const updateItem  = (id, field, value) => setForm(prev => ({ ...prev, items: prev.items.map(it => it.id===id ? {...it,[field]:value} : it) }));
  const addItemRow  = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItemRow = (id) => setForm(prev => ({ ...prev, items: prev.items.filter(it => it.id!==id) }));

  const handleSave = async () => {
    try {
      setSaving(true);
      // Strip local-only id from items
      const payload = { ...form, items: form.items.map(({ id: _id, ...rest }) => rest) };
      const url    = editingId ? `${API}/${editingId}` : API;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: hdrs, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.detail || "Save failed");
      toast.success(editingId ? "Debit note updated successfully!" : "Debit note created successfully!");
      setView("list");
      await fetchAll();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const totalTaxableAmount = form.items.reduce((s,it) => s+(parseFloat(it.taxableValue)||0), 0);
  const cgstAmount  = totalTaxableAmount*(parseFloat(form.cgstPercent)||0)/100;
  const sgstAmount  = totalTaxableAmount*(parseFloat(form.sgstPercent)||0)/100;
  const igstAmount  = totalTaxableAmount*(parseFloat(form.igstPercent)||0)/100;
  const totalInvoiceValue = totalTaxableAmount+cgstAmount+sgstAmount+igstAmount;
  const autoAmountInWords = convertNumberToWords(totalInvoiceValue);

  const filteredRecords = records;

  if (view === "list") {
    return (
      <div className="space-y-5 w-full h-full overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Debit Note</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-44" />
            </div>
            <button onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800 shadow-md">
              <Plus className="w-4 h-4" /> Add Debit Note
            </button>
          </div>
        </div>
        <div className="min-h-[420px] space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-800 bg-slate-100 border-b border-slate-200 uppercase font-black tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-200 w-40">Serial No</th>
                    <th className="px-4 py-3 border-r border-slate-200">Receiver Name</th>
                    <th className="px-4 py-3 border-r border-slate-200 w-32">Date</th>
                    <th className="px-4 py-3 border-r border-slate-200 w-32 text-right">Invoice Val</th>
                    <th className="px-4 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"/> Loading…
                      </div>
                    </td></tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-sm font-medium text-slate-500 bg-slate-50">No debit notes found. Click "Add Debit Note" to create one.</td></tr>
                  ) : filteredRecords.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-slate-700">
                      <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{r.serialNo||"—"}</td>
                      <td className="px-4 py-3 border-r border-slate-100 font-bold">{r.receiverName||"—"}</td>
                      <td className="px-4 py-3 border-r border-slate-100">{r.date||"—"}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right font-bold text-slate-900">
                        ₹{r.items ? r.items.reduce((acc,it)=>acc+(parseFloat(it.taxableValue)||0),0).toFixed(2) : "0.00"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══ FORM VIEW — identical UI to original ══
  const inp = "px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-medium text-slate-800";
  const lbl = "text-xs font-black text-slate-800 uppercase tracking-widest pl-1";

  return (
    <div className="flex flex-col w-full h-full bg-slate-50/50 relative overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><FileText className="w-5 h-5" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 leading-tight">{editingId ? "Edit Debit Note" : "New Debit Note"}</h2>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">Delivery Challan</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Company block */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col text-sm font-medium text-slate-800 space-y-3">
              <div className="text-center font-bold text-base mb-2 text-slate-900">19b,J. L. Nehru Road, Kolkata- 700087</div>
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-100 pb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center"><span className="font-bold">State:</span><span className="text-slate-700">West-Bengal</span></div>
                  <div className="flex gap-2 items-center"><span className="font-bold">Code:</span><span className="text-slate-700">19</span></div>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <div className="flex gap-2 items-center justify-end"><span className="font-bold">Contact Details:</span><span className="text-slate-700">9674961682/033-2249-1051</span></div>
                  <div className="flex gap-2 items-center justify-end"><span className="font-bold">Email Id:</span><span className="text-slate-700">subhadip.b@citimartindia.com</span></div>
                </div>
              </div>
              <div className="text-center pt-1"><span className="font-bold mr-2 text-slate-900">GSTIN:</span><span className="font-bold text-slate-800">19AAACL5546P1ZW</span></div>
            </div>
          </div>

          {/* Title */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm text-center">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">Debit Note Cum Delivery Challan</h1>
            <p className="text-xs font-semibold text-black tracking-wide">(Original for Recipient/Duplicate for Transporter/Triplicate for Supplier)</p>
          </div>

          {/* Top info */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6">
            <div className="flex flex-col gap-3">
              {[["Original Invoice No","originalInvoiceNo","text","SI/24345/22-23"],["Original Invoice Date","originalInvoiceDate","date",""],["Place of Supply","placeOfSupply","text","SURAT"]].map(([l,k,t,ph])=>(
                <div key={k}><label className={lbl}>{l}</label><input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className={`mt-1 ${inp} w-64`} placeholder={ph}/></div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {[["Serial No","serialNo","text","SI/24345/22-23"],["Date","date","date",""],["Despatch Through","despatchThrough","text","Transport details"]].map(([l,k,t,ph])=>(
                <div key={k}><label className={lbl}>{l}</label><input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className={`mt-1 ${inp} w-64`} placeholder={ph}/></div>
              ))}
            </div>
          </div>

          {/* Party details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[["Receiver (Billed to)","receiver","blue"],["Consignee (Shipped To)","consignee","indigo"]].map(([title,prefix,color])=>(
              <div key={prefix} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className={`text-sm font-black text-${color}-800 uppercase tracking-widest border-b border-${color}-100 pb-2 mb-4`}>Details of {title}</h3>
                <div className="space-y-4">
                  {[["Name",`${prefix}Name`,"text",`e.g. Gokul TexPrint pvt.ltd`],["Address",`${prefix}Address`,"textarea","Address..."],["GSTIN",`${prefix}GSTIN`,"text","GSTIN"]].map(([l,k,t,ph])=>(
                    <div key={k} className="flex flex-col gap-1.5">
                      <label className={lbl}>{l}</label>
                      {t==="textarea"
                        ? <textarea value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} rows={2} className={`w-full ${inp.replace("px-4 py-2.5","px-4 py-2")} text-sm resize-none`} placeholder={ph}/>
                        : <input type={t} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className={`w-full ${inp.replace("px-4 py-2.5","px-4 py-2")} text-sm font-bold`} placeholder={ph}/>}
                    </div>
                  ))}
                  <div className="flex gap-4">
                    {[["State",`${prefix}State`,"State"],["Code",`${prefix}Code`,"Code"]].map(([l,k,ph])=>(
                      <div key={k} className={`flex flex-col gap-1.5 ${k.includes("Code")?"w-24":"flex-1"}`}>
                        <label className={lbl}>{l}</label>
                        <input type="text" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className={`w-full ${inp.replace("px-4 py-2.5","px-4 py-2")} text-sm font-medium`} placeholder={ph}/>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Line items table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-lg text-left">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 uppercase text-sm font-black tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="px-2 py-3 text-center border-r border-slate-200" rowSpan={2}>Sl.No.</th>
                    <th className="px-2 py-3 border-r border-slate-200 min-w-[150px]" rowSpan={2}>Description of Goods</th>
                    <th className="px-2 py-3 border-r border-slate-200" rowSpan={2}>HSN Code</th>
                    <th className="px-2 py-3 border-r border-slate-200" rowSpan={2}>Qty.</th>
                    <th className="px-2 py-3 border-r border-slate-200" rowSpan={2}>Unit</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-center border-b" colSpan={2}>Goods Return</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-center border-b leading-tight" colSpan={2}>Short Received<br/>of Goods</th>
                    <th className="px-2 py-2 border-r border-slate-200 text-center border-b" colSpan={2}>Rate Difference</th>
                    <th className="px-2 py-3 text-right" rowSpan={2}>Taxable Value</th>
                  </tr>
                  <tr>
                    {["Rate","Amount","Rate","Amount","Rate","Amount"].map((h,i)=>(
                      <th key={i} className={`px-2 py-1.5 ${i<5?"border-r border-slate-200":""} text-center`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.items.map((it, i) => (
                    <tr key={it.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-2 py-1 border-r border-slate-100 text-center font-bold relative">
                        <span className="group-hover:opacity-0">{i+1}</span>
                        {form.items.length>1&&<button onClick={()=>removeItemRow(it.id)} className="absolute inset-0 m-auto w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-500"><MinusCircle className="w-3.5 h-3.5"/></button>}
                      </td>
                      <td className="p-1 border-r border-slate-100"><input type="text" value={it.description} onChange={e=>updateItem(it.id,'description',e.target.value)} className="w-full px-2 py-1.5 bg-transparent outline-none font-medium text-slate-800" placeholder="DIG - LIVA SUPER"/></td>
                      <td className="p-1 border-r border-slate-100"><input type="text" value={it.hsnCode} onChange={e=>updateItem(it.id,'hsnCode',e.target.value)} className="w-full px-2 py-1.5 bg-transparent outline-none text-slate-800" placeholder="540822"/></td>
                      <td className="p-1 border-r border-slate-100"><input type="number" min="0" onKeyDown={e=>{if(e.key==='-')e.preventDefault()}} value={it.qty} onChange={e=>updateItem(it.id,'qty',e.target.value)} className="w-16 px-1 py-1.5 bg-transparent outline-none text-slate-800 text-center font-bold"/></td>
                      <td className="p-1 border-r border-slate-100"><input type="text" value={it.unit} onChange={e=>updateItem(it.id,'unit',e.target.value)} className="w-16 px-1 py-1.5 bg-transparent outline-none text-slate-800 text-center"/></td>
                      {[['goodsReturnRate'],['goodsReturnAmount'],['shortReceivedRate'],['shortReceivedAmount'],['rateDifferenceRate'],['rateDifferenceAmount']].map(([k],idx)=>(
                        <td key={k} className={`p-1 ${idx<5?"border-r border-slate-100":""}`}>
                          <input type="number" min="0" onKeyDown={e=>{if(e.key==='-')e.preventDefault()}} value={it[k]} onChange={e=>updateItem(it.id,k,e.target.value)} className={`w-${idx%2===0?"16":"20"} px-1 py-1.5 bg-transparent outline-none text-slate-800 text-right`}/>
                        </td>
                      ))}
                      <td className="p-1 bg-blue-50/50"><input type="number" min="0" onKeyDown={e=>{if(e.key==='-')e.preventDefault()}} value={it.taxableValue} onChange={e=>updateItem(it.id,'taxableValue',e.target.value)} className="w-24 px-1 py-1.5 bg-transparent outline-none font-bold text-blue-900 text-right" placeholder="0.00"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50/50 border-t border-slate-200">
              <button onClick={addItemRow} className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors shadow-sm">
                <PlusCircle className="w-4 h-4"/> Add Row
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm w-full md:w-1/2">
              <div className="space-y-3 text-sm font-bold text-slate-800">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="uppercase text-xs tracking-widest text-slate-800 font-black">Total Taxable amount (Before Tax):</span>
                  <span className="text-base font-bold text-slate-800">₹ {totalTaxableAmount.toFixed(2)}</span>
                </div>
                {[["cgstPercent","CGST",cgstAmount],["sgstPercent","SGST",sgstAmount],["igstPercent","IGST",igstAmount]].map(([k,label,val])=>(
                  <div key={k} className="flex justify-between items-center py-1.5">
                    <span className="text-slate-600 flex items-center gap-2">Add: {label} @ <input type="number" min="0" onKeyDown={e=>{if(e.key==='-')e.preventDefault()}} className="w-12 text-center bg-slate-50 border border-slate-200 rounded p-1" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/> %</span>
                    <span>{val.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-3 text-lg text-blue-900 border-t border-slate-100">
                  <span className="font-black uppercase tracking-widest">Total Invoice Value</span>
                  <span className="font-black">₹ {totalInvoiceValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer block */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col mt-6">
            <div className="flex flex-col text-sm border-b border-slate-100 pb-4 mb-4">
              <div className="flex border-b border-slate-200 px-2 py-2">
                <span className="font-black w-48 whitespace-nowrap uppercase tracking-widest text-xs">Total Amount (in word):</span>
                <span className="flex-1 font-bold pl-2 uppercase text-slate-700">{autoAmountInWords}</span>
              </div>
            </div>
            <div className="flex flex-col md:flex-row border-b border-slate-100">
              <div className="flex items-center gap-4 flex-1 border-r border-slate-100 pr-4 py-4">
                <span className="font-black text-slate-800 uppercase tracking-widest text-xs whitespace-nowrap w-24">Company Pan No</span>
                <input type="text" value={form.companyPan} onChange={e=>setForm({...form,companyPan:e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-400 font-bold text-slate-700" placeholder="AAACL5546P"/>
              </div>
              <div className="flex items-center gap-4 flex-1 pl-4 py-4">
                <span className="font-black text-slate-800 uppercase tracking-widest text-xs whitespace-nowrap w-16">Remarks:</span>
                <span className="flex-1 px-4 py-2 font-bold text-slate-700">Being amount debited for Goods Returned</span>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b border-slate-100 py-4">
              <span className="font-black text-slate-800 uppercase tracking-widest text-xs whitespace-nowrap w-24">CIN No</span>
              <input type="text" value={form.cinNo} onChange={e=>setForm({...form,cinNo:e.target.value})} className="flex-1 md:w-1/2 md:flex-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-400 font-bold text-slate-700" placeholder="U51909WB1997PTC084091"/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm font-bold text-slate-700 pt-8 pb-4">
              <div className="flex flex-col justify-end space-y-2">
                <input type="text" value={form.vendorSeal} onChange={e=>setForm({...form,vendorSeal:e.target.value})} className="bg-transparent outline-none border-b border-slate-300 focus:border-blue-400 w-64 px-2 py-1 text-left font-bold" placeholder="Vendor's Name"/>
                <span className="text-xs text-slate-500 uppercase tracking-widest text-left w-64 font-black">Vendor's Seal and Signature</span>
              </div>
              <div className="flex flex-col justify-end items-end space-y-2">
                <span className="font-black text-slate-800 text-right w-64 mb-6">For LOURDES TEXTILES PVT. LTD.</span>
                <input type="text" value={form.authorisedSignatory} onChange={e=>setForm({...form,authorisedSignatory:e.target.value})} className="bg-transparent outline-none border-b border-slate-300 focus:border-blue-400 w-64 text-right px-2 py-1 font-bold" placeholder="Signatory Name"/>
                <span className="text-xs text-slate-500 uppercase tracking-widest text-right w-64 font-black">Authorised Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 p-4 sm:p-6 bg-white/40 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex items-center justify-end gap-4 z-50">
        <button onClick={() => { setView("list"); toast.error("Record cancelled successfully!"); }}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 hover:shadow-md transition-all">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:-translate-y-0.5 text-base disabled:opacity-50">
          {saving ? "Saving…" : editingId ? "Update Record" : "Save Record"}
        </button>
      </div>
    </div>
  );
}