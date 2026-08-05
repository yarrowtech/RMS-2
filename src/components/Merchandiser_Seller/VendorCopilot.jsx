import React, { useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, ChevronDown, Send, Sparkles, X } from "lucide-react";
import { API_BASE_URL } from "../../config/api.js";

const GUIDES = {
  dashboard: { title: "Dashboard", summary: "Start here for a quick view of products, orders, retailer activity and your current plan.", steps: ["Review urgent orders and inquiries.", "Check catalogue limits or expiry warnings.", "Use the cards to open the relevant workspace."], next: "catalogue", cta: "Improve catalogue" },
  categories: { title: "Categories", summary: "Select clear business categories so the right retailers can discover you.", steps: ["Choose only categories you supply.", "Use specific business types.", "Save before adding catalogue items."], next: "catalogue", cta: "Add catalogue item" },
  catalogue: { title: "My Catalogue", summary: "This is your retailer-facing product showcase.", steps: ["Add photo, name, price, MOQ and description.", "Use variants for sellable colour, size or pack options.", "Review readiness before sharing."], next: "subscription", cta: "Review plan limits" },
  subscription: { title: "Subscription", summary: "Review plan limits, renewal date and upgrade benefits.", steps: ["Check active catalogue limits.", "Compare plan features.", "Renew before visibility expires."], next: "catalogue", cta: "Return to catalogue" },
  whatsapp: { title: "WhatsApp", summary: "Connect a business number for retailer communication.", steps: ["Use a business-controlled number.", "Complete verification.", "Keep conversations professional."], next: "catalogue", cta: "Open catalogue" },
  "product-list": { title: "Product List", summary: "Keep operational SKU, variant and stock data accurate.", steps: ["Add SKU and stock accurately.", "Use variants for colour, size or pack inventory.", "Keep catalogue details aligned."], next: "inventory", cta: "Open My Inventory" },
  inventory: { title: "My Inventory", summary: "This is your own available-to-sell stock, separate from retailer stock and B2B Stock Ledger.", steps: ["Add produced or received stock with a clear note.", "Buyer approval automatically reserves matching SKU/barcode stock; you can reserve early after submitting a PO.", "Mark the retailer PO dispatched only when it leaves your business; that deducts reserved stock."], next: "purchase-order", cta: "Open Purchase Orders" },
  "purchase-order": { title: "Purchase Orders", summary: "Review, confirm and update retailer orders promptly.", steps: ["Open new orders promptly.", "Confirm quantities, rates and delivery terms.", "Update status as work progresses."], next: "finance", cta: "Review finance" },
  finance: { title: "Finance & Analytics", summary: "Follow invoices, receipts and performance trends.", steps: ["Review outstanding amounts.", "Check payment history.", "Prioritise high-performing products."], next: "catalogue", cta: "Improve listings" },
  retailers: { title: "My Retailers", summary: "Manage the retailer relationships that use your catalogue.", steps: ["Review relationship status.", "Keep profile and catalogue current.", "Respond to inquiries promptly."], next: "network", cta: "Explore network" },
  network: { title: "Business Network", summary: "Discover and manage eligible business connections.", steps: ["Review profile details.", "Send relevant professional requests.", "Follow up through RMS."], next: "retailers", cta: "View retailers" },
  "b2b-trade": { title: "Vendor B2B Trade", summary: "Trade directly with an accepted Business Network partner; it never changes retailer GRC, GRN or stock.", steps: ["RFQ, quote and award create a B2B purchase order.", "Supplier confirms, records dispatch details, then downloads the B2B order sheet or delivery challan.", "Buyer records receipt, then records B2B invoice payments; returns follow request, approval, return dispatch, supplier receipt and credit note."], next: "b2b-stock", cta: "Open B2B Stock Ledger" },
  "b2b-stock": { title: "B2B Stock Ledger", summary: "Tracks only goods received from another vendor through B2B Trade.", steps: ["Buyer receipt adds B2B stock automatically.", "Use adjustments only for a genuine correction, consumption or damage and always enter a reason.", "When a supplier receives an approved B2B return, the buyer stock is reversed and the related invoice receives a credit note."], next: "b2b-trade", cta: "Open B2B Trade" },
  "help-support": { title: "Help & Support", summary: "Create a private support ticket whenever RMS work is blocked.", steps: ["Choose the closest issue type.", "Include page, expected result and error details.", "Add a safe screenshot if helpful."], next: "dashboard", cta: "Back to dashboard" },
};

function guideFor(tab) {
  return GUIDES[tab] || { title: "RMS workspace", summary: "I can guide you through this vendor workspace.", steps: ["Review the available actions.", "Keep business information accurate.", "Use Help & Support if something is blocked."], next: "help-support", cta: "Open support" };
}

function vendorToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("vendor_token") || localStorage.getItem("token") || "";
}

export default function VendorCopilot({ activeTab, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const guide = useMemo(() => guideFor(activeTab), [activeTab]);

  const localAsk = () => {
    const query = question.trim().toLowerCase();
    if (!query) return;
    if (query.includes("support") || query.includes("error") || query.includes("help")) setReply("For a problem that blocks work, open Help & Support. Include the page name, expected result and a screenshot if possible.");
    else if (query.includes("plan") || query.includes("upgrade") || query.includes("limit")) setReply("Your Subscription tab shows plan limits, renewal details and upgrade options. Catalogue photo and item limits apply to active listings.");
    else if (query.includes("stock") || query.includes("inventory") || query.includes("reserve")) setReply("Use My Inventory for your own sellable stock. Buyer approval automatically reserves matching SKU/barcode stock; stock is deducted only when you mark the retailer PO dispatched. B2B Stock Ledger is separate and updates only from B2B buyer receipts.");
    else if (query.includes("b2b") || query.includes("challan") || query.includes("return") || query.includes("credit")) setReply("B2B Trade flow: RFQ → quote → B2B PO → supplier confirmation → dispatch/challan → buyer receipt → invoice/payment. For a return: buyer requests it, supplier approves, buyer dispatches it, supplier receives it, then B2B stock reverses and a credit note reduces the invoice balance.");
    else if (query.includes("dispatch") || query.includes("delivery")) setReply("Dispatch stays optional until goods actually leave. Enter expected delivery, transporter and tracking when shipping; then download the delivery challan. Do not mark dispatched before shipment.");
    else setReply(`For ${guide.title}, start with: ${guide.steps[0]}`);
    setQuestion("");
  };

  const askAi = async () => {
    const value = question.trim();
    if (!value || !aiEnabled) return;
    setAsking(true); setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/catalogue/vendor-copilot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(vendorToken() ? { Authorization: `Bearer ${vendorToken()}` } : {}) },
        body: JSON.stringify({ question: value, page: guide.title, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "AI could not answer right now.");
      setReply(data.reply); setQuestion("");
    } catch (requestError) { setError(requestError.message || "AI could not answer right now."); }
    finally { setAsking(false); }
  };

  return <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
    {open && <section className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_24px_70px_rgba(76,29,149,0.24)]">
      <header className="bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600 p-4 text-white"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Bot className="h-5 w-5" /></span><div><p className="text-sm font-black">RMS Co-pilot</p><p className="mt-0.5 text-[11px] text-white/75">Your vendor workflow guide</p></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Close RMS Co-pilot"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm font-bold">You’re in {guide.title}</p><p className="mt-1 text-xs leading-5 text-white/80">{guide.summary}</p></header>
      <div className="p-4"><button type="button" onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between rounded-xl bg-violet-50 px-3 py-2.5 text-left text-xs font-bold text-violet-950"><span>Show me the workflow</span><ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} /></button>{expanded && <ol className="mt-3 space-y-2">{guide.steps.map((step, index) => <li key={step} className="flex gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{index + 1}. {step}</span></li>)}</ol>}
      <button type="button" onClick={() => { onNavigate(guide.next); setOpen(false); }} className="mt-4 flex w-full items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100">{guide.cta}<ArrowRight className="h-4 w-4" /></button>
      <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[11px] font-bold text-slate-600">Ask RMS Guide</p><div className="mt-2 flex gap-2"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && (aiEnabled ? askAi() : localAsk())} placeholder="How do I add variants?" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><button type="button" disabled={asking} onClick={aiEnabled ? askAi : localAsk} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button></div>
      <label className="mt-3 flex cursor-pointer gap-2 rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-[10px] leading-4 text-amber-900"><input type="checkbox" checked={aiEnabled} onChange={event => setAiEnabled(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-violet-600" /><span><b>Use optional AI answers</b><br />Your question and current page name will be sent to Anthropic. Do not enter customer details, prices, orders, phone numbers or documents.</span></label>
      {reply && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{reply}</p>}{error && <p className="mt-3 text-xs text-rose-600">{error}</p>}<p className="mt-2 text-[10px] leading-4 text-slate-400">The guide never changes, saves, submits or publishes your data.</p></div></div>
    </section>}
    <button type="button" onClick={() => setOpen(value => !value)} className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_16px_40px_rgba(79,70,229,0.35)] transition hover:-translate-y-0.5" aria-expanded={open}><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Bot className="h-5 w-5 transition group-hover:scale-110" /></span><span>{open ? "Close guide" : "Ask RMS"}</span><Sparkles className="h-4 w-4 text-amber-200" /></button>
  </div>;
}