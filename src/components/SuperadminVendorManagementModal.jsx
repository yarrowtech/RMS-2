import React, { useEffect, useState } from "react";
import { Crown, Edit, X } from "lucide-react";

const TYPES = [
  ["general_vendor", "General vendor"], ["wholesaler", "Wholesaler"],
  ["manufacturer", "Manufacturer"], ["distributor", "Distributor"],
  ["exporter", "Exporter"], ["fabric_supplier", "Fabric supplier"],
  ["retailer", "Retailer / store owner"],
];

const toLocalDate = (value) => value ? String(value).slice(0, 16) : "";

const FINANCE_ACCESS = {
  free: ["3-month receipt history", "10 latest transactions", "Outstanding invoices"],
  standard: ["12-month receipt history", "100 transactions & CSV export", "Retailer account breakdown"],
  premium: ["36-month receipt history", "500 transactions & CSV export", "Retailer breakdown & collection forecast"],
};

export default function SuperadminVendorManagementModal({
  data, onClose, onSaveIdentity, onSaveSubscription, onRelationshipAction, saving,
}) {
  const [identity, setIdentity] = useState({});
  const [categories, setCategories] = useState("");
  const [subscription, setSubscription] = useState({});

  useEffect(() => {
    if (!data) return;
    setIdentity({ ...data.identity, business_type: data.identity.business_type || [] });
    setCategories((data.identity.product_categories || []).join(", "));
    setSubscription({
      tier: data.subscription.tier || "free",
      status: data.subscription.status || "active",
      payment_status: data.subscription.payment_status || "not_required",
      expires_at: toLocalDate(data.subscription.expires_at),
      reason: "",
    });
  }, [data]);

  if (!data) return null;
  const changeIdentity = (name, value) => setIdentity(current => ({ ...current, [name]: value }));
  const toggleType = (type) => changeIdentity(
    "business_type",
    identity.business_type.includes(type)
      ? identity.business_type.filter(value => value !== type)
      : [...identity.business_type, type],
  );
  const saveIdentity = () => onSaveIdentity({
    name: identity.name || "", brandName: identity.brandName || "", email: identity.email || "",
    contactMobile: identity.contactMobile || "", website: identity.website || "", address: identity.address || "",
    cityName: identity.cityName || "", state: identity.state || "", pincode: identity.pincode || "",
    gstin: identity.gstin || "", business_type: identity.business_type || [],
    product_categories: categories.split(",").map(value => value.trim()).filter(Boolean),
  });
  const saveSubscription = () => onSaveSubscription({
    ...subscription,
    expires_at: subscription.expires_at ? new Date(subscription.expires_at).toISOString() : null,
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 px-6 py-5 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-200">Platform vendor administration</p>
            <h2 className="mt-1 text-xl font-black">{data.identity.name || "Vendor"}{data.identity.brandName ? ` · ${data.identity.brandName}` : ""}</h2>
            <p className="mt-1 text-xs text-indigo-100">Global profile and plan · retailer relationships remain independently scoped.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-indigo-100 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-5 sm:p-6">
          <p className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
            Only public vendor information is managed here. Retailer-private POs, invoices, payments, RFQs and negotiations are never shown.
          </p>
          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2"><Edit className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-black text-slate-900">Global vendor identity</h3></div>
              <p className="mt-1 text-xs text-slate-500">Changes here apply across all approved retailers.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[["name", "Vendor name"], ["brandName", "Brand name"], ["email", "Login email"], ["contactMobile", "Mobile"], ["website", "Website"], ["cityName", "City"], ["state", "State"], ["gstin", "GSTIN"]].map(([field, label]) => <label key={field} className="text-[11px] font-bold text-slate-600">{label}<input value={identity[field] || ""} onChange={event => changeIdentity(field, event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>)}
              </div>
              <label className="mt-3 block text-[11px] font-bold text-slate-600">Address<input value={identity.address || ""} onChange={event => changeIdentity("address", event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
              <div className="mt-4"><p className="text-[11px] font-bold text-slate-600">Business classifications</p><div className="mt-2 flex flex-wrap gap-2">{TYPES.map(([value, label]) => <button type="button" key={value} onClick={() => toggleType(value)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${identity.business_type?.includes(value) ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"}`}>{label}</button>)}</div></div>
              <label className="mt-4 block text-[11px] font-bold text-slate-600">Product categories <span className="font-normal text-slate-400">(comma separated)</span><input value={categories} onChange={event => setCategories(event.target.value)} placeholder="e.g. Cotton T-shirts, Denim, Packaging" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
              <button onClick={saveIdentity} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Edit className="h-3.5 w-3.5" />Save global profile</button>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5">
              <div className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-600" /><h3 className="text-sm font-black text-slate-900">Subscription & discovery access</h3></div>
              <p className="mt-1 text-xs leading-5 text-slate-500">This plan applies to the vendor globally. Business discovery only shows opted-in public profiles.</p>
              <div className="mt-4 space-y-3">
                <label className="block text-[11px] font-bold text-slate-600">Plan<select value={subscription.tier} onChange={event => setSubscription({ ...subscription, tier: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400"><option value="free">Free</option><option value="standard">Standard</option><option value="premium">Premium</option></select></label>
                <label className="block text-[11px] font-bold text-slate-600">Access status<select value={subscription.status} onChange={event => setSubscription({ ...subscription, status: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400"><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending_payment">Pending payment</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label>
                <label className="block text-[11px] font-bold text-slate-600">Payment status<select value={subscription.payment_status} onChange={event => setSubscription({ ...subscription, payment_status: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400"><option value="not_required">Not required</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option><option value="refunded">Refunded</option></select></label>
                {subscription.tier !== "free" && <label className="block text-[11px] font-bold text-slate-600">Expiry<input type="datetime-local" value={subscription.expires_at || ""} onChange={event => setSubscription({ ...subscription, expires_at: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-amber-400" /></label>}
                <label className="block text-[11px] font-bold text-slate-600">Administrative reason<textarea value={subscription.reason || ""} onChange={event => setSubscription({ ...subscription, reason: event.target.value })} rows="3" placeholder="e.g. Manual plan grant after verified payment" className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" /></label>
              </div>
              <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Vendor finance access with this plan</p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-600">{(FINANCE_ACCESS[subscription.tier] || FINANCE_ACCESS.free).map(item => <li key={item} className="flex gap-2"><span className="font-black text-emerald-600">✓</span>{item}</li>)}</ul>
                <p className="mt-2 border-t border-amber-100 pt-2 text-[10px] leading-4 text-slate-500">Vendor balances and payment receipts remain read-only and are calculated from retailer purchase invoices.</p>
              </div>
              <button onClick={saveSubscription} disabled={saving || !(subscription.reason || "").trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"><Crown className="h-3.5 w-3.5" />Apply plan override</button>
            </section>
          </div>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900">Retailer relationships</h3><p className="mt-1 text-xs text-slate-500">Suspending one relationship does not change other retailer relationships or the plan.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{data.relationships.length} retailer{data.relationships.length === 1 ? "" : "s"}</span></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2.5">Retailer</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5 text-right">Control</th></tr></thead><tbody className="divide-y divide-slate-100">{data.relationships.map(link => <tr key={link.id}><td className="px-3 py-3 font-bold text-slate-800">{link.tenant_name}</td><td className="px-3 py-3 font-mono text-slate-500">{link.vendor_code || "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${link.status === "Approved" ? "bg-emerald-100 text-emerald-700" : link.status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{link.status}</span></td><td className="px-3 py-3 text-slate-500">{link.source || "—"}</td><td className="px-3 py-3 text-right">{link.status === "Approved" && <button disabled={saving} onClick={() => onRelationshipAction(link, "Suspended")} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">Suspend for retailer</button>}{["Suspended", "Deactivated"].includes(link.status) && <button disabled={saving} onClick={() => onRelationshipAction(link, "Approved")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Reactivate</button>}{["Pending", "Rejected"].includes(link.status) && <span className="text-slate-400">Use main approval controls</span>}</td></tr>)}</tbody></table></div>
          </section>
        </main>
      </div>
    </div>
  );
}
