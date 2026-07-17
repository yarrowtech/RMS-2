import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Bell,
  Search,
  Settings,
  Menu,
  TrendingUp,
  Package,
  ShoppingBag,
  IndianRupee,
  Building2,
  Mail,
  Phone,
  MapPin,
  HeadphonesIcon,
  Clock,
  ChevronDown,
} from "lucide-react";

import MsellerSidebar       from "./MsellerSidebar.jsx";
import AddProduct           from "./MsellerAddProduct.jsx";
import VendorPurchaseOrders from "./VendorPurchaseOrders.jsx";
import VendorJobWork from "./VendorJobWork.jsx";
import MSellerDashboard     from "./MsellerDashboard.jsx";
import MSellerCategory      from "./MsellerCategory.jsx";
import MSellerProductList   from "./MsellerProductList.jsx";
import MsellerSettings      from "./MsellerSettings.jsx";
import EditProduct          from "./EditProduct.jsx";
import VendorRetailersTab   from "./Vendorretailerstab.jsx";
import BusinessNetwork      from "./BusinessNetwork.jsx";
import VendorAnalytics      from "./VendorAnalytics.jsx";
import VendorCatalogueTab   from "./Vendorcataloguetab.jsx";
import VendorSubscriptionTab from "./Vendorsubscriptiontab.jsx";
import VendorWhatsAppConnect from "./Vendorwhatsappconnect.jsx";
import PurchaseInvoice from "../PurchaseInvoice.jsx";
import ProcurementNotificationCenter from "../ProcurementNotificationCenter.jsx";

/* ── token helper — always use this, never localStorage directly ── */
const getToken = () =>
  localStorage.getItem("vendor_token") ||
  localStorage.getItem("admin_token")  ||
  localStorage.getItem("token")        ||
  "";

const cn = (...a) => a.filter(Boolean).join(" ");

/* ------------------------------------------------------------------
   Stat card — one icon tint per meaning (teal = inventory, amber =
   needs attention, emerald = money in). Weight kept to font-bold,
   not font-black, so the numbers don't compete with page headings.
------------------------------------------------------------------ */
function StatCard({ icon: Icon, label, value, delta, tone }) {
  const tones = {
    teal:    { bg: "bg-teal-50",    text: "text-teal-700",    icon: "text-teal-600" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-700",   icon: "text-amber-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-600" },
  }[tone];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className={cn("grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg", tones.bg)}>
        <Icon size={19} className={tones.icon} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {delta && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
              <TrendingUp size={11} /> {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <Icon size={15} className="mt-0.5 flex-shrink-0 text-slate-400" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ProfileCard({ profile }) {
  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading profile…
      </div>
    );
  }
  return (
    <div className="max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-20" style={{ background: "linear-gradient(120deg,#0E7C66,#0B5C4C)" }} />
        <div className="px-6 pb-6 -mt-9">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-teal-600 text-xl font-bold text-white shadow-sm">
            {profile.name?.[0]?.toUpperCase() ?? "V"}
          </div>
          <h2 className="mb-4 text-lg font-bold tracking-tight text-slate-900">{profile.name}</h2>
          <div className="space-y-2.5">
            <InfoRow icon={Building2} label="Business Name" value={profile.name} />
            <InfoRow icon={Mail}      label="Email"         value={profile.email} />
            <InfoRow icon={Phone}     label="Mobile"        value={profile.contactMobile || "—"} />
            <InfoRow icon={MapPin}    label="Address"       value={profile.address || "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpCard() {
  const contacts = [
    { icon: Mail,  text: "support@rmshelpdesk.com" },
    { icon: Phone, text: "+91 1800 123 456" },
    { icon: Clock, text: "Mon–Sat, 9 AM – 6 PM" },
  ];
  return (
    <div className="max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6">
          <div className="mb-1 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50">
              <HeadphonesIcon size={18} className="text-teal-600" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Help & Support</h2>
          </div>
          <p className="mb-5 text-sm text-slate-500">Our team is ready to help you anytime.</p>
          <div className="space-y-2.5">
            {contacts.map(({ icon: Icon, text }) => (
              <InfoRow key={text} icon={Icon} label="" value={text} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_TITLES = {
  dashboard:        "Dashboard",
  categories:       "My Categories",
  catalogue:        "My Catalogue",  
  subscription:     "Subscription",
  whatsapp:         "WhatsApp",
  "add-product":    "Add Product",
  "product-list":   "Product List",
  "edit-product":   "Edit Product",
  "purchase-order": "Purchase Orders",
  "job-work":       "Job Work Orders",
  finance:          "Finance & Analytics",
  retailers:        "My Retailers",
  network:          "Business Network",
  profile:          "My Profile",
  "help-support":   "Help & Support",
  settings:         "Settings",
};

export default function MSeller() {
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [vendorProfile,  setVendorProfile]  = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [inquiryNotificationCount, setInquiryNotificationCount] = useState(0);
  const [jobWorkEnabled, setJobWorkEnabled] = useState(false);

  const refreshVendorAccess = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const profileResponse = await fetch(`${APP_API_URL}/api/vendors/me`, { headers });
      const profile = await profileResponse.json().catch(() => ({}));
      if (profileResponse.ok) setVendorProfile(profile);
      const businessTypes = Array.isArray(profile.business_type) ? profile.business_type : [];
      setJobWorkEnabled(profileResponse.ok && businessTypes.includes("job_worker"));
    } catch {
      setJobWorkEnabled(false);
    }
  }, []);

  useEffect(() => {
    refreshVendorAccess();
    window.addEventListener("vendor-access-updated", refreshVendorAccess);
    return () => window.removeEventListener("vendor-access-updated", refreshVendorAccess);
  }, [refreshVendorAccess]);

  useEffect(() => {
    if (activeTab === "job-work" && !jobWorkEnabled) setActiveTab("dashboard");
  }, [activeTab, jobWorkEnabled]);

  useEffect(() => {
    let cancelled=false;
    const API_BASE=APP_API_URL;
    const token=localStorage.getItem("vendor_token");
    if(!token)return undefined;
    const headers={Authorization:`Bearer ${token}`};
    const refresh=async()=>{try{
      if(activeTab==="catalogue"){
        await fetch(`${API_BASE}/api/procurement-notifications/vendor/read`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({category:"inquiries"})});
        if(!cancelled)setInquiryNotificationCount(0);
      }else{
        const response=await fetch(`${API_BASE}/api/procurement-notifications/vendor/unread-count`,{headers,cache:"no-store"});
        const data=await response.json();if(response.ok&&!cancelled)setInquiryNotificationCount(Number(data.count)||0);
      }
    }catch{/* retain count */}};
    refresh();const timer=window.setInterval(refresh,30000);window.addEventListener("focus",refresh);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("focus",refresh)};
  },[activeTab]);

  useEffect(() => {
    if (activeTab !== "profile") return;
    const fetchProfile = async () => {
      const token = getToken();
      if (!token) {
        alert("Please login again.");
        window.location.href = "/merchandiser-seller/login";
        return;
      }
      try {
        const res = await axios.get(`${APP_API_URL}/api/vendors/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVendorProfile(res.data);
      } catch (err) {
        console.error(err);
        alert("Failed to load profile. Please login again.");
      }
    };
    fetchProfile();
  }, [activeTab]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("vendor_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    localStorage.removeItem("vendor_id");
    localStorage.removeItem("vendor_profile");
    window.location.replace("/merchandiser-seller/login");
  }, []);

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
    setActiveTab("edit-product");
  }, []);

  const handleBackToList = useCallback(() => {
    setEditingProduct(null);
    setActiveTab("product-list");
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard icon={Package}      label="Total Products"  value="28"      delta="+4 this month"      tone="teal" />
              <StatCard icon={ShoppingBag}  label="Pending Orders"  value="5"                                   tone="amber" />
              <StatCard icon={IndianRupee}  label="Revenue"         value="₹48,230" delta="+12% vs last month" tone="emerald" />
            </div>
            <MSellerDashboard />
          </div>
        );

      case "categories":  return <MSellerCategory />;
      case "add-product": return <AddProduct onSuccess={() => setActiveTab("product-list")} />;

      case "product-list":
        return <MSellerProductList embedded={true} onEditProduct={handleEditProduct} />;

      case "edit-product":
        return (
          <EditProduct embedded={true} product={editingProduct} onBackToList={handleBackToList} />
        );

      case "purchase-order": return <VendorPurchaseOrders vendorName={vendorProfile?.name} />;
      case "job-work":       return <VendorJobWork />;
      case "purchase-invoice": return <PurchaseInvoice vendorMode />;
      case "finance":        return <VendorAnalytics />;
      case "retailers":      return <VendorRetailersTab />;
      case "network":        return <BusinessNetwork />;
      case "catalogue":      return <VendorCatalogueTab />;
      case "subscription":   return <VendorSubscriptionTab />;
      case "whatsapp":       return <VendorWhatsAppConnect />;
      case "profile":        return <ProfileCard profile={vendorProfile} />;
      case "help-support":   return <HelpCard />;
      case "settings":       return <MsellerSettings />;

      default:
        return <div className="text-sm text-slate-400">Select a section from the sidebar.</div>;
    }
  };

  const sidebarProps = {
    active:    activeTab,
    setActive: setActiveTab,
    onLogout:  handleLogout,
    title:     "RMS",
    subtitle:  "Merchandiser Seller",
    inquiryNotificationCount,
    jobWorkEnabled,
    businessTypes: vendorProfile?.business_type || [],
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F5] font-sans">

      {/* desktop sidebar */}
      <div className={cn("hidden shrink-0 p-3 transition-all duration-300 md:flex", sidebarOpen ? "w-[300px]" : "w-[112px]")}>
        <MsellerSidebar {...sidebarProps} mode="desktop" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-50 h-full w-72 p-3">
            <MsellerSidebar {...sidebarProps} mode="drawer" sidebarOpen={true} setSidebarOpen={setDrawerOpen} />
          </div>
        </div>
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
                Vendor Panel
              </p>
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900">
                {PAGE_TITLES[activeTab] ?? "Overview"}
              </h1>
            </div>
          </div>

          <div className="relative hidden max-w-xs flex-1 sm:block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <ProcurementNotificationCenter mode="vendor" count={inquiryNotificationCount} onCountChange={setInquiryNotificationCount} onNavigate={()=>setActiveTab("catalogue")}/>
            <div className="ml-1 hidden items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-2.5 sm:flex">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                {vendorProfile?.name?.[0]?.toUpperCase() ?? "V"}
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
