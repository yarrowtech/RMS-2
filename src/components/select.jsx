import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, BarChart3, Boxes, Building2, CheckCircle2,
  Factory, Globe2, Handshake, Layers3, LockKeyhole, Mail, PackageCheck,
  ShieldCheck, ShoppingCart, Store, Truck, UserPlus, Users, Workflow,
} from "lucide-react";

const portals = [
  {
    key: "retailer", eyebrow: "Internal access", title: "Retailer Team",
    description: "Secure access for authorized administrators and assigned department teams.",
    path: "/admin/login", icon: Building2,
    accent: "from-indigo-500 to-violet-600", soft: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
  {
    key: "vendor", eyebrow: "Partner access", title: "Vendor Partner",
    description: "Dedicated workspace for approved vendors, catalogues, orders, and communication.",
    path: "/merchandiser-seller/login", icon: Store,
    accent: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
];

const capabilities = [
  ["Administration & IT", "Users, permissions, stores, product masters and platform controls", ShieldCheck, "indigo"],
  ["Merchandising & Buying", "Vendor discovery, catalogues, purchase orders, planning and comparisons", ShoppingCart, "violet"],
  ["Inventory & Warehouse", "GRN/GRC, stock allocation, transfers, adjustments and item movement", Boxes, "emerald"],
  ["Finance", "Invoices, payments, debit notes, vouchers, revenue and financial reporting", BarChart3, "amber"],
  ["Cashier & Store", "Store-based POS, billing, returns, customer records and daily operations", Store, "cyan"],
  ["HR & Operations", "Employees, tasks, logistics, design workflows and third-party coordination", Users, "rose"],
  ["Planning & Forecasting", "Demand planning, stock gaps, purchase plans and replenishment insights", Workflow, "blue"],
  ["Reports & Visibility", "Role-scoped dashboards, performance indicators and operational reports", Layers3, "slate"],
];

const partners = [
  ["Vendor", "Manage your profile, catalogue, enquiries, orders and retailer communication.", Handshake],
  ["Wholesaler", "Offer bulk assortments and collaborate with retailers through a structured order flow.", PackageCheck],
  ["Exporter / Manufacturer", "Present production capabilities, products and fulfilment information.", Globe2],
  ["Store Owner / Retailer", "Request an RMS retail workspace for stores, staff, inventory and operations.", Building2],
];

const steps = [
  ["01", "Configure the business", "Create the retailer, HQ, stores or branches and core product structure."],
  ["02", "Assign teams securely", "Give each administrator only the departments, store and permissions they manage."],
  ["03", "Run daily operations", "Teams work in connected buying, inventory, finance, cashier and planning workflows."],
  ["04", "Track and improve", "Management reviews live operational data, exceptions and performance from one system."],
];

const tone = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100", violet: "bg-violet-50 text-violet-700 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100", amber: "bg-amber-50 text-amber-700 ring-amber-100",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100", rose: "bg-rose-50 text-rose-700 ring-rose-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100", slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function ProfessionalRoleSelector() {
  const navigate = useNavigate();
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "";
  const contactHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent("RMS onboarding enquiry")}`
    : "/vendor/register";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_31%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />

      <header className="relative z-30 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15"><Store size={21} /></span>
            <span><span className="block text-base font-extrabold tracking-tight text-slate-950">RMS</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Retail Management System</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#about" className="hover:text-indigo-700">What is RMS?</a>
            <a href="#workflow" className="hover:text-indigo-700">How it works</a>
            <a href="#departments" className="hover:text-indigo-700">Capabilities</a>
            <a href="#partners" className="hover:text-indigo-700">For partners</a>
          </nav>
          <button onClick={() => navigate("/admin/login")} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700">Sign in</button>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="mx-auto grid min-h-[680px] w-full max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/85 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm"><BadgeCheck size={15} /> Connected retail operations</div>
            <h1 className="text-4xl font-black leading-[1.07] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">Run retail from one <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">connected system.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">RMS connects retailers, stores, departments and supply partners—from product planning and buying through inventory, billing, finance and reporting.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#about" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">Explore RMS <ArrowRight size={16} /></a>
              <button onClick={() => navigate("/vendor/register")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"><UserPlus size={16} /> Join as a partner</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><LockKeyhole size={15} className="text-indigo-600" /> Role-based access</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600" /> Tenant and store scoped</span></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-label="Access portals">
            {portals.map((portal) => { const Icon = portal.icon; return (
              <button key={portal.key} onClick={() => navigate(portal.path)} className="group relative overflow-hidden rounded-3xl border border-white bg-white/90 p-6 text-left shadow-[0_18px_60px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.14)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${portal.accent}`} />
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ${portal.soft}`}><Icon size={22} /></span>
                <span className="mt-7 block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{portal.eyebrow}</span>
                <span className="mt-2 block text-xl font-extrabold tracking-tight text-slate-950">{portal.title}</span>
                <span className="mt-3 block min-h-[72px] text-sm leading-6 text-slate-600">{portal.description}</span>
                <span className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"><span className="text-sm font-bold text-slate-800">Continue securely</span><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-white transition group-hover:translate-x-1"><ArrowRight size={17} /></span></span>
              </button>
            ); })}
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">What is RMS?</p><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">A digital operating system for modern retail.</h2><p className="mt-5 text-base leading-7 text-slate-600">Instead of running stores, orders, stock and finance in disconnected files, RMS gives every authorized team a dedicated workspace while keeping information connected across the business.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[[Building2,"Multi-store structure","Manage HQ, stores and branches within one retailer account."],[Users,"Department workspaces","Each team sees only its assigned modules and responsibilities."],[Handshake,"Partner collaboration","Retailers and approved vendors coordinate catalogues and orders."],[BarChart3,"Management visibility","Track activity, inventory and performance with scoped reporting."]].map(([Icon,title,text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"><Icon size={19}/></span><h3 className="mt-4 font-extrabold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="workflow" className="py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600">Retailer workflow</p><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">From setup to daily execution.</h2><p className="mt-4 leading-7 text-slate-600">RMS follows the way a retailer actually operates, while keeping access controlled by tenant, store and department.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{steps.map(([number,title,text]) => <div key={number} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="text-3xl font-black text-slate-200">{number}</span><h3 className="mt-5 font-extrabold text-slate-900">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></div>)}</div>
          </div>
        </section>

        <section id="departments" className="border-y border-slate-200 bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div className="max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400">Retail capabilities</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Departments work independently, data works together.</h2><p className="mt-4 leading-7 text-slate-400">These are platform capabilities—not public login options. After authentication, a user sees only the departments assigned by their retailer administrator.</p></div><span className="inline-flex h-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300"><ShieldCheck size={15}/> Access controlled</span></div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{capabilities.map(([title,text,Icon,color]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5"><span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${tone[color]}`}><Icon size={19}/></span><h3 className="mt-4 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div>
          </div>
        </section>

        <section id="partners" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">Join the RMS network</p><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Built for retailers and their supply partners.</h2><p className="mt-4 leading-7 text-slate-600">Apply once, complete verification, and receive access to the workspace appropriate for your business.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{partners.map(([title,text,Icon]) => <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100"><Icon size={20}/></span><h3 className="mt-5 font-extrabold text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></div>)}</div>
            <div className="mt-10 grid gap-4 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 sm:grid-cols-2 lg:grid-cols-4">{[["1","Submit registration"],["2","Business verification"],["3","Account approval"],["4","Connect and operate"]].map(([n,t]) => <div key={n} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white">{n}</span><span className="text-sm font-bold text-emerald-950">{t}</span></div>)}</div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-950 p-8 text-white shadow-2xl shadow-indigo-950/20 sm:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-200">Ready to get started?</p><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Bring your retail operation or partner business into RMS.</h2><p className="mt-4 leading-7 text-indigo-100/75">Register as a vendor partner, contact onboarding, or sign in if your account has already been approved.</p></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><button onClick={() => navigate("/vendor/register")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-indigo-700 transition hover:bg-indigo-50"><UserPlus size={17}/> Join as a Partner</button><a href={contactHref} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/15"><Mail size={17}/> Contact Onboarding</a></div></div>
            {!contactEmail && <p className="mt-5 text-xs text-indigo-200/65">Site owner: configure <code className="rounded bg-black/20 px-1.5 py-1">VITE_CONTACT_EMAIL</code> to enable direct email enquiries.</p>}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span>© {new Date().getFullYear()} RMS. Protected business access.</span><div className="flex gap-5"><a href="#about" className="hover:text-indigo-700">About RMS</a><a href="#partners" className="hover:text-indigo-700">Partner onboarding</a><button onClick={() => navigate("/admin/login")} className="hover:text-indigo-700">Sign in</button></div></div>
      </footer>
    </div>
  );
}