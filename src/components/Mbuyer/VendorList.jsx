import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle, XCircle, Eye, Trash2, Edit, Building,
  Search, RefreshCcw, Ban, UserPlus, MessageCircle,
  Copy, Bell, ChevronRight, X, Link, ClipboardCheck,
  Clock, Check, Mail, Camera,
} from "lucide-react";

const API_BASE_URL   = APP_API_URL;
const FRONTEND_URL   = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────
function getAdminToken() {
  return (
    localStorage.getItem("admin_token")    ||
    localStorage.getItem("access_token")   ||
    localStorage.getItem("token")          ||
    localStorage.getItem("adminToken")     ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token")        ||
    null
  );
}
function authHeaders(extra = {}) {
  const t = getAdminToken();
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
}
function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const Vendors = ({ showQuestionnaires = true }) => {
  const [pendingVendors,   setPendingVendors]   = useState([]);
  const [approvedVendors,  setApprovedVendors]  = useState([]);
  const [selectedVendor,   setSelectedVendor]   = useState(null);
  const [editVendor,       setEditVendor]        = useState(null);
  const [loading,          setLoading]           = useState(false);
  const [searchPending,    setSearchPending]     = useState("");
  const [searchApproved,   setSearchApproved]    = useState("");

  // Invitations tracker
  const [showInvitations, setShowInvitations] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Add Vendor flow
  const [showAddVendor,  setShowAddVendor]  = useState(false);
  const [addStep,        setAddStep]        = useState("form"); // "form" | "link"
  const [generatedLink,  setGeneratedLink]  = useState("");
  const [inviteData,     setInviteData]     = useState(null);
  const [linkCopied,     setLinkCopied]     = useState(false);

  // Questionnaire notifications
  const [questionnaireNotifs, setQuestionnaireNotifs] = useState([]);
  const [showNotifPanel,      setShowNotifPanel]      = useState(false);
  const [selectedNotifVendor, setSelectedNotifVendor] = useState(null);
  const [notifLinkStep,       setNotifLinkStep]       = useState(null);
  const [notifLink,           setNotifLink]           = useState("");
  const [notifLinkCopied,     setNotifLinkCopied]     = useState(false);

  useEffect(() => {
    fetchAll();
    if (showQuestionnaires) fetchQuestionnaireNotifs();
    else {
      setQuestionnaireNotifs([]);
      setShowNotifPanel(false);
    }
  }, [showQuestionnaires]);

  // ── Fetch vendors ──────────────────────────────────────────────────────────
  async function fetchAll() {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/vendors/pending`,  { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/api/vendors/approved`, { headers: authHeaders() }),
    ]);
      if (!pendingRes.ok)  setPendingVendors([]);
      else { const d = await pendingRes.json();  setPendingVendors(Array.isArray(d) ? d : []); }
      if (!approvedRes.ok) setApprovedVendors([]);
      else { const d = await approvedRes.json(); setApprovedVendors(Array.isArray(d) ? d : []); }
    } catch { setPendingVendors([]); setApprovedVendors([]); }
    finally { setLoading(false); }
  }

  // ── Fetch questionnaire notifications ─────────────────────────────────────
  async function fetchQuestionnaireNotifs() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/questionnaire-submissions`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setQuestionnaireNotifs(Array.isArray(d) ? d : []);
      }
    } catch { /* fail silently */ }
  }

  const unreadCount = questionnaireNotifs.filter(n => !n.read).length;

  // ── Build WhatsApp + email links ───────────────────────────────────────────
  function buildWhatsAppLink(mobile, contactName, companyName, regLink) {
    const msg = `Hi ${contactName}, CitiMart is pleased to invite ${companyName} to join our vendor network.\n\nComplete your registration here:\n${regLink}\n\nThis link expires in 7 days.\n\nRegards,\nCitiMart Team`;
    const clean = mobile.replace(/\D/g, "");
    const num   = clean.startsWith("91") ? clean : `91${clean}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  // ── Add Vendor: generate invite link ──────────────────────────────────────
  async function handleGenerateLink(formValues) {
    try {
      const res  = await fetch(`${API_BASE_URL}/api/vendors/invite`, {
        method:  "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          company_name:   formValues.companyName,
          brand_name:     formValues.brandName,
          contact_person: formValues.contactName,
          mobile:         formValues.mobile,
          email:          formValues.email,
          address:        formValues.address,
          product_type:   formValues.productCategory,
          invited_by:     localStorage.getItem("admin_name") || "M-Buyer",
        }),
      });
      const json = await res.json();

      // Use token from backend response OR fall back to the route that already existed
      const token   = json.token || json.invite_token || json.id || "";
      const regLink = `${FRONTEND_URL}/vendor/register?token=${token}`;

      setInviteData({ ...formValues, token });
      setGeneratedLink(regLink);
      setAddStep("link");
    } catch (err) {
      alert("Failed to generate invite: " + err.message);
    }
  }

  function handleWhatsApp() {
    const url = buildWhatsAppLink(
      inviteData.mobile, inviteData.contactName,
      inviteData.companyName, generatedLink,
    );
    window.open(url, "_blank");
  }



 async function handleEmail() {
    if (!inviteData.email) { alert("No email address provided for this vendor."); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/api/vendors/send-invite-email`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email:        inviteData.email,
          contact_name: inviteData.contactName,
          company_name: inviteData.companyName,
          invite_link:  generatedLink,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to send email");
      alert(`✅ Invite email sent to ${inviteData.email}`);
    } catch (err) { alert("Email send failed: " + err.message); }
  }

  function copyLink(link, setCopied) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Questionnaire → accept → generate invite link ─────────────────────────
  async function handleNotifAccept(notif) {
    try {
      const res  = await fetch(
        `${API_BASE_URL}/api/vendors/questionnaire-submissions/${notif._id}/accept`,
        { method: "POST", headers: authHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed");

      const token   = json.token || "";
      const regLink = `${FRONTEND_URL}/vendor/register?token=${token}`;
      setNotifLink(regLink);
      setNotifLinkStep({ ...notif, token });
      markNotifRead(notif._id);
    } catch (err) { alert(err.message); }
  }

  function markNotifRead(id) {
    setQuestionnaireNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    // Also tell backend
    fetch(`${API_BASE_URL}/api/vendors/questionnaire-submissions/${id}/read`, {
      method: "PATCH", headers: authHeaders(),
    }).catch(() => {});
  }

  function handleNotifWhatsApp() {
    const url = buildWhatsAppLink(
      notifLinkStep.phoneNumber || notifLinkStep.contactMobile || "",
      notifLinkStep.contactPerson || notifLinkStep.vendorName,
      notifLinkStep.vendorName,
      notifLink,
    );
    window.open(url, "_blank");
  }

  

  async function handleNotifEmail() {
    const email = notifLinkStep.email || "";
    if (!email) { alert("No email address found for this vendor."); return; }
    try {
      const res  = await fetch(`${API_BASE_URL}/api/vendors/send-invite-email`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email:        email,
          contact_name: notifLinkStep.contactPerson || notifLinkStep.vendorName,
          company_name: notifLinkStep.vendorName,
          invite_link:  notifLink,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed to send email");
      alert(`✅ Invite email sent to ${email}`);
    } catch (err) { alert("Email send failed: " + err.message); }
  }

  // ── Approval / Rejection / Delete / Deactivate ────────────────────────────
  async function handleApproval(id) {
    const token = getAdminToken();
    if (!token) { alert("Session expired. Please log in again."); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/approve/${id}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ product_type: selectedVendor?.product_type || "General" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Approval failed");
      alert(`✅ ${data.message}`);
      setSelectedVendor(null); fetchAll();
    } catch (err) { alert("Error: " + err.message); }
  }

  async function handleReject(id) {
    if (!window.confirm("Reject this vendor?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/reject/${id}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
      });
      if (!res.ok) throw new Error("Rejection failed");
      alert("Vendor rejected successfully.");
      setSelectedVendor(null); fetchAll();
    } catch { alert("Error rejecting vendor"); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this vendor?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/delete/${id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      alert("Vendor deleted successfully"); fetchAll();
    } catch { alert("Error deleting vendor"); }
  }

  async function handleDeactivate(id) {
    if (!window.confirm("Deactivate this vendor profile?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/deactivate/${id}`, {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Deactivation failed");
      alert("Vendor deactivated successfully"); fetchAll();
    } catch { alert("Error deactivating vendor"); }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredPending = pendingVendors.filter(v =>
    [v.name, v.brandName, v.contactMobile, v.email, v.vendor_name, v.mobile]
      .join(" ").toLowerCase().includes(searchPending.toLowerCase())
  );
  const filteredApproved = approvedVendors.filter(v =>
    [v.vendorId, v.name, v.brandName, v.contactMobile, v.email, v.vendor_name, v.mobile]
      .join(" ").toLowerCase().includes(searchApproved.toLowerCase())
  );

  function closeAddVendor() { setShowAddVendor(false); setAddStep("form"); setGeneratedLink(""); setInviteData(null); setLinkCopied(false); }
  function closeNotifLink()  { setNotifLinkStep(null); setNotifLink(""); setNotifLinkCopied(false); }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full space-y-6 bg-transparent p-4 sm:p-6">

      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 overflow-visible rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_12px_35px_rgba(76,29,149,0.07)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/20"><Building className="h-6 w-6" /></span>
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-600">Partner network</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">Vendor Management</h1><p className="mt-1 text-xs text-slate-500">Review, invite and manage approved supply partners</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 🔔 Questionnaire Bell */}
          {showQuestionnaires && <div className="relative">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
            >
              <Bell size={18} className={unreadCount > 0 ? "text-purple-600" : "text-gray-500"} />
              Questionnaires
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifPanel && (
              <NotifPanel
                notifications={questionnaireNotifs}
                onSelect={(n) => { markNotifRead(n._id); setSelectedNotifVendor(n); setShowNotifPanel(false); }}
                onClose={() => setShowNotifPanel(false)}
              />
            )}
          </div>}

          {/* 📨 Invitations Tracker */}
          <button
            onClick={() => setShowInvitations(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
          >
            <Mail size={18} className="text-gray-500" />
            Invitations
          </button>

          {/* 📥 Import CSV */}
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
          >
            <UserPlus size={18} className="text-gray-500" /> Import CSV
          </button>

          {/* ➕ Add Vendor */}
          <button
            onClick={() => { setShowAddVendor(true); setAddStep("form"); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/15 transition hover:brightness-110"
          >
            <UserPlus size={18} /> Add Vendor
          </button>

          <button onClick={fetchAll}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
            <RefreshCcw size={18} /> Refresh
          </button>
        </div>
      </div>

      {/* PENDING VENDORS */}
      <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <SectionHeader title="Pending Vendor Approvals" color="from-purple-600 to-indigo-600" />
        <div className="overflow-hidden bg-white">
          <SearchBar value={searchPending} onChange={setSearchPending} placeholder="Search pending vendors..." />
          <VendorTable data={filteredPending} loading={loading} emptyText="No pending vendors."
            onView={setSelectedVendor} onDelete={handleDelete} />
        </div>
      </div>

      {/* APPROVED VENDORS */}
      <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <SectionHeader title="Approved Vendors List" color="from-green-600 to-emerald-600" />
        <div className="overflow-hidden bg-white">
          <SearchBar value={searchApproved} onChange={setSearchApproved} placeholder="Search approved vendors..." />
          <ApprovedTable data={filteredApproved} loading={loading} emptyText="No approved vendors found."
            onEdit={setEditVendor} onDeactivate={handleDeactivate} />
        </div>
      </div>

      {/* ── MODALS ── */}
      {showInvitations && <InvitationsModal onClose={() => setShowInvitations(false)} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onDone={fetchAll} />}
      {selectedVendor && (
        <VendorModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)}
          onApprove={() => handleApproval(selectedVendor._id)}
          onReject={() => handleReject(selectedVendor._id)} />
      )}
      {editVendor && (
        <EditVendorModal vendor={editVendor} onClose={() => setEditVendor(null)}
          onSave={() => { alert("Vendor profile updated successfully!"); setEditVendor(null); fetchAll(); }} />
      )}
      {showAddVendor && (
        addStep === "form"
          ? <AddVendorModal onClose={closeAddVendor} onGenerate={handleGenerateLink} />
          : <InviteLinkModal inviteData={inviteData} link={generatedLink} copied={linkCopied}
              onCopy={() => copyLink(generatedLink, setLinkCopied)}
              onWhatsApp={handleWhatsApp} onEmail={handleEmail}
              onClose={closeAddVendor}
              onSendAnother={() => { setAddStep("form"); setGeneratedLink(""); setInviteData(null); }} />
      )}
      {showQuestionnaires && selectedNotifVendor && !notifLinkStep && (
        <QuestionnaireReviewModal vendor={selectedNotifVendor}
          onClose={() => setSelectedNotifVendor(null)}
          onAccept={() => { handleNotifAccept(selectedNotifVendor); setSelectedNotifVendor(null); }}
          onReject={() => setSelectedNotifVendor(null)} />
      )}
      {showQuestionnaires && notifLinkStep && (
        <InviteLinkModal
          inviteData={{
            companyName:     notifLinkStep.vendorName,
            contactName:     notifLinkStep.contactPerson || notifLinkStep.vendorName,
            mobile:          notifLinkStep.phoneNumber   || notifLinkStep.contactMobile || "",
            email:           notifLinkStep.email         || "",
            productCategory: notifLinkStep.productCategory || "",
          }}
          link={notifLink} copied={notifLinkCopied}
          onCopy={() => copyLink(notifLink, setNotifLinkCopied)}
          onWhatsApp={handleNotifWhatsApp} onEmail={handleNotifEmail}
          onClose={closeNotifLink} onSendAnother={closeNotifLink} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD VENDOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const AddVendorModal = ({ onClose, onGenerate }) => {
  const [form,  setForm]  = useState({ companyName:"", brandName:"", contactName:"", mobile:"", email:"", address:"", productCategory:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const set = field => e => setForm({ ...form, [field]: e.target.value });

  function sanitizeMobile(raw) {
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    return digits.slice(-10);
  }

  async function handleScanCard(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = ""; // allow re-selecting the same file(s) later
    if (!files.length) return;
    if (files.length > 2) { setError("Select at most 2 images — front and back of the card."); return; }
    setScanning(true); setScanNotice(""); setError("");
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      const res = await fetch(`${API_BASE_URL}/api/vendors/scan-visiting-card`, {
        method: "POST", headers: authHeaders(), body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not scan the card.");

      const gotAnything = data.company_name || data.contact_name || data.mobile || data.email;
      setForm((prev) => ({
        ...prev,
        companyName:     data.company_name || prev.companyName,
        brandName:       Array.isArray(data.brand_names) && data.brand_names.length ? data.brand_names.join(", ") : prev.brandName,
        contactName:     data.contact_name || prev.contactName,
        mobile:          data.mobile ? sanitizeMobile(data.mobile) : prev.mobile,
        email:           data.email || prev.email,
        address:         data.address || prev.address,
        productCategory: data.product_category || prev.productCategory,
      }));
      setScanNotice(gotAnything ? "Card scanned — please review the fields below before sending." : "Couldn't read details from that image — please fill the fields in manually.");
    } catch (err) {
      setScanNotice("");
      setError(err.message || "Could not scan the card. Please fill the fields in manually.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit() {
    if (!form.companyName || !form.contactName || !form.mobile || !form.productCategory) {
      setError("Please fill all required fields."); return;
    }
    if (!/^\d{10}$/.test(form.mobile)) { setError("Enter a valid 10-digit mobile number."); return; }
    setLoading(true);
    await onGenerate(form);
    setLoading(false);
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5">
        <UserPlus className="text-white h-6 w-6" />
        <div>
          <h2 className="text-lg font-semibold text-white">Add Vendor from Visiting Card</h2>
          <p className="text-indigo-200 text-xs mt-0.5">Enter basic details — we'll generate a registration invite</p>
        </div>
      </div>
      <div className="space-y-5 p-6">
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-sm font-bold transition ${scanning ? "border-violet-300 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700"}`}>
          {scanning ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /> : <Camera size={17} />}
          {scanning ? "Scanning card…" : "📷 Scan Visiting Card (auto-fill fields below)"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={scanning} onChange={handleScanCard} />
        </label>
        <p className="-mt-2.5 text-center text-[11px] text-slate-400">You can select 2 photos at once — front and back of the same card</p>
        {scanNotice && <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">✨ {scanNotice}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-3 py-2">⚠️ {error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label="Company / Vendor Name *" value={form.companyName}  onChange={set("companyName")}     placeholder="e.g. Sunrise Textiles" />
          <LabeledInput label="Brand Name(s) (if on card)" value={form.brandName}    onChange={set("brandName")}       placeholder="e.g. Sunrise, Sunrise Kids (comma-separated if multiple)" />
          <LabeledInput label="Contact Person Name *"   value={form.contactName}  onChange={set("contactName")}     placeholder="e.g. Rajesh Kumar" />
          <LabeledInput label="Mobile Number *"         value={form.mobile}       onChange={set("mobile")}           placeholder="10-digit number" />
          <LabeledInput label="Email (if on card)"      value={form.email}        onChange={set("email")}            placeholder="vendor@example.com" />
          <div className="sm:col-span-2">
            <LabeledInput label="Address (if on card)"  value={form.address}      onChange={set("address")}          placeholder="e.g. 12 MG Road, Mumbai" />
          </div>
          <div className="sm:col-span-2">
            <LabeledInput label="Product Category *"    value={form.productCategory} onChange={set("productCategory")} placeholder="e.g. Apparel, Electronics" />
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-xs text-indigo-800 space-y-1">
          <p className="font-semibold text-indigo-700 mb-1 flex items-center gap-1"><ChevronRight size={13} />What happens next?</p>
          <p>1. A unique invite link (valid 7 days) is generated.</p>
          <p>2. Send it via WhatsApp or Email — both options available.</p>
          <p>3. Vendor clicks the link → fills full profile → auto-approved.</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-60">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Link size={15} />}
            {loading ? "Generating…" : "Generate Invite Link"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// INVITE LINK MODAL — shows link + WhatsApp + Email buttons
// ─────────────────────────────────────────────────────────────────────────────
const InviteLinkModal = ({ inviteData, link, copied, onCopy, onWhatsApp, onEmail, onClose, onSendAnother }) => (
  <Modal onClose={onClose} maxWidth="max-w-lg">
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <CheckCircle size={20} /> Invite Link Ready
      </h2>
      <p className="text-green-100 text-xs mt-0.5">Valid for 7 days · One-time registration</p>
    </div>
    <div className="space-y-5 p-6">
      {/* Vendor summary */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm space-y-1">
        <p><span className="text-gray-500">Company:</span> <span className="font-semibold text-gray-800">{inviteData.companyName}</span></p>
        <p><span className="text-gray-500">Contact:</span> <span className="font-semibold text-gray-800">{inviteData.contactName}</span></p>
        <p><span className="text-gray-500">Mobile:</span>  <span className="font-semibold text-gray-800">{inviteData.mobile}</span></p>
        {inviteData.email && <p><span className="text-gray-500">Email:</span> <span className="font-semibold text-gray-800">{inviteData.email}</span></p>}
        {inviteData.productCategory && <p><span className="text-gray-500">Category:</span> <span className="font-semibold text-gray-800">{inviteData.productCategory}</span></p>}
      </div>

      {/* Link box */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Registration Link</p>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <p className="text-xs text-indigo-700 truncate flex-1 font-mono">{link}</p>
          <button onClick={onCopy}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>

      {/* WhatsApp message preview */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">Message Preview</p>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-gray-700 space-y-1">
          <p>Hi <b>{inviteData.contactName}</b>, CitiMart is pleased to invite <b>{inviteData.companyName}</b> to join our vendor network.</p>
          <p>Complete your registration here:</p>
          <p className="text-green-700 font-mono text-xs break-all">{link}</p>
          <p className="text-gray-500 text-xs">This link expires in 7 days.</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button onClick={onWhatsApp}
          className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-md font-medium text-sm">
          <MessageCircle size={17} /> Send via WhatsApp
        </button>
        <button onClick={onEmail}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium text-sm">
          <Mail size={17} /> Send via Email
        </button>
      </div>
      <button onClick={onSendAnother}
        className="w-full flex items-center justify-center gap-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-2.5 rounded-md text-sm font-medium">
        <UserPlus size={15} /> Add Another Vendor
      </button>
    </div>
  </Modal>
);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PANEL (bell dropdown)
// ─────────────────────────────────────────────────────────────────────────────
const NotifPanel = ({ notifications, onSelect, onClose }) => (
  <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="text-white h-4 w-4" />
        <span className="text-white font-semibold text-sm">Questionnaire Submissions</span>
      </div>
      <button onClick={onClose} className="text-white/70 hover:text-white"><X size={16} /></button>
    </div>
    {notifications.length === 0 ? (
      <div className="p-6 text-center text-gray-400 text-sm">No questionnaire submissions yet.</div>
    ) : (
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {notifications.map(n => (
          <button key={n._id} onClick={() => onSelect(n)}
            className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-all ${!n.read ? "bg-purple-50/50" : ""}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!n.read ? "bg-purple-500" : "bg-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-gray-800 truncate ${!n.read ? "text-purple-800" : ""}`}>
                  {n.vendorName || n.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{n.contactPerson} · {n.productCategory}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> {timeAgo(n.submittedAt)}
                </p>
              </div>
              <ChevronRight size={14} className="text-gray-400 mt-1 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE REVIEW MODAL
// ─────────────────────────────────────────────────────────────────────────────
const QuestionnaireReviewModal = ({ vendor, onClose, onAccept, onReject }) => (
  <Modal onClose={onClose} maxWidth="max-w-2xl">
    <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-4 rounded-t-lg flex items-center gap-3">
      <ClipboardCheck className="text-white h-6 w-6" />
      <div>
        <h2 className="text-lg font-semibold text-white">Questionnaire Submission</h2>
        <p className="text-blue-200 text-xs">{vendor.vendorName || vendor.name} · Submitted {timeAgo(vendor.submittedAt)}</p>
      </div>
    </div>
    <div className="space-y-5 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {[
          ["Vendor / Company",     vendor.vendorName || vendor.name],
          ["Contact Person",       vendor.contactPerson],
          ["Phone Number",         vendor.phoneNumber || vendor.contactMobile],
          ["Email",                vendor.email],
          ["Product Category",     vendor.productCategory || vendor.product_type],
          ["Business Type",        vendor.businessType],
          ["MOQ",                  vendor.moq],
          ["Price Range",          vendor.priceRange],
          ["Lead Time",            vendor.leadTime],
          ["Payment Terms",        vendor.paymentTerms],
          ["Brand Section",        vendor.brandSection],
          ["Online Collaboration", vendor.onlineCollaboration],
          ["Quality Rating",       vendor.vendorQuality ? `${vendor.vendorQuality} / 5` : null],
          ["Images Uploaded",      vendor.images_count ? `${vendor.images_count} file(s)` : null],
        ].filter(([, v]) => v).map(([label, val]) => (
          <Info key={label} label={label} value={val} />
        ))}
      </div>

      {/* Show uploaded images if any */}
      {vendor.images && vendor.images.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded Images</p>
          <div className="grid grid-cols-3 gap-2">
            {vendor.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                className="block rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity">
                <img src={url} alt={`upload-${i}`} className="w-full h-20 object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <b>Accepting</b> this submission will generate a unique registration invite link for <b>{vendor.vendorName || vendor.name}</b>,
        which you can send via <b>WhatsApp or Email</b> to complete their full vendor profile.
      </div>

      <div className="flex justify-center gap-4 pt-2">
        <button onClick={onAccept}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium">
          <CheckCircle size={18} /> Accept &amp; Generate Link
        </button>
        <button onClick={onReject}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md font-medium">
          <XCircle size={18} /> Dismiss
        </button>
      </div>
    </div>
  </Modal>
);

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING MODALS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const VendorModal = ({ vendor, onClose, onApprove, onReject }) => (
  <Modal onClose={onClose} maxWidth="max-w-3xl">
    <div className="bg-white rounded-lg shadow-2xl w-full p-8 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl">✕</button>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">Review Vendor Details</h2>
      {vendor.source === "walkin_po_self_register" && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <b>Walk-in Vendor</b> — Self-registered via PO public link.
          {vendor.source_po && <span className="ml-2">PO: <b>{vendor.source_po}</b></span>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {[
          ["Vendor Name",    vendor.name || vendor.vendor_name],
          ["Brand Name",     vendor.brandName],
          ["Company Type",   vendor.companyType],
          ["Industry Type",  vendor.industryType],
          ["Product Type",   vendor.product_type || vendor.productType],
          ["Owner Name",     vendor.ownerName],
          ["Contact Person", vendor.contact_name || vendor.contactName || vendor.contact_person],
          ["Mobile",         vendor.contactMobile || vendor.mobile],
          ["Email",          vendor.email],
          ["Website",        vendor.website],
          ["Address",        vendor.address],
          ["City",           vendor.cityName],
          ["State",          vendor.state],
          ["Pincode",        vendor.pincode],
          ["PAN",            vendor.pan],
          ["GST Category",   vendor.gstCategory],
          ["GSTIN",          vendor.gstin],
          ["GST State",      vendor.gstState],
          ["Status",         vendor.status],
          ["Registered On",  vendor.created_at
            ? new Date(vendor.created_at).toLocaleDateString("en-IN")
            : vendor.createdAt
            ? new Date(vendor.createdAt).toLocaleDateString("en-IN")
            : undefined],
        ].filter(([, val]) => val).map(([label, val]) => (
          <Info key={label} label={label} value={val} />
        ))}
      </div>
      <div className="mt-8 flex justify-center gap-6">
        <button onClick={onApprove} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium">
          <CheckCircle size={18} /> Approve
        </button>
        <button onClick={onReject} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium">
          <XCircle size={18} /> Reject
        </button>
      </div>
    </div>
  </Modal>
);

const EditVendorModal = ({ vendor, onClose, onSave }) => {
  const [form, setForm] = useState(vendor);
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <div className="bg-white rounded-lg shadow-2xl w-full p-8 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl">✕</button>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Edit Vendor Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <LabeledInput label="Vendor Name"    value={form.name || ""}           onChange={e => handleChange("name",          e.target.value)} />
          <LabeledInput label="Brand Name"     value={form.brandName || ""}      onChange={e => handleChange("brandName",     e.target.value)} />
          <LabeledInput label="Contact Number" value={form.contactMobile || form.mobile || ""} onChange={e => handleChange("contactMobile", e.target.value)} />
          <LabeledInput label="Email"          value={form.email || ""}          onChange={e => handleChange("email",         e.target.value)} />
        </div>
        <div className="mt-8 flex justify-center">
          <button onClick={onSave} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium">
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TABLE COMPONENTS (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const VendorTable = ({ data, loading, emptyText, onView, onDelete }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Vendor Name</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Brand Name</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Contact Number</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Email</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Source</th>
          <th className="px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={6} className="text-center py-6 text-gray-500">Loading...</td></tr>
        ) : data.length === 0 ? (
          <tr><td colSpan={6} className="text-center py-6 text-gray-500">{emptyText}</td></tr>
        ) : data.map(v => (
          <tr key={v._id} className="border-b border-slate-100 hover:bg-violet-50/40 transition-colors">
            <td className="px-4 py-2">
              {v.name || v.vendor_name || "—"}
              {v.source === "walkin_po_self_register" && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Walk-in</span>
              )}
              {v.source === "invite_link" && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">Invited</span>
              )}
            </td>
            <td className="px-4 py-2">{v.brandName || "—"}</td>
            <td className="px-4 py-2">{v.contactMobile || v.mobile || "—"}</td>
            <td className="px-4 py-2">{v.email || "—"}</td>
            <td className="px-4 py-2">
              {v.source === "walkin_po_self_register" ? (
                <span className="text-xs text-amber-700">PO: {v.source_po || "—"}</span>
              ) : v.source === "invite_link" ? (
                <span className="text-xs text-indigo-600">M-Buyer invite</span>
              ) : (
                <span className="text-xs text-gray-400">Registration form</span>
              )}
            </td>
            <td className="px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              <div className="flex justify-center gap-3">
                <button onClick={() => onView(v)} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                  <Eye size={16} /> Review
                </button>
                <button onClick={() => onDelete(v._id)} className="flex items-center gap-1 text-red-600 hover:text-red-800">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ApprovedTable = ({ data, loading, emptyText, onEdit, onDeactivate }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Vendor ID</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Vendor Name</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Brand Name</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Contact Number</th>
          <th className="px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Email</th>
          <th className="px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={6} className="text-center py-6 text-gray-500">Loading...</td></tr>
        ) : data.length === 0 ? (
          <tr><td colSpan={6} className="text-center py-6 text-gray-500">{emptyText}</td></tr>
        ) : data.map(v => (
          <tr key={v._id} className="border-b border-slate-100 hover:bg-emerald-50/40">
            <td className="px-4 py-2 text-purple-700 font-semibold font-mono text-xs">{v.vendor_code || v._id || "—"}</td>
            <td className="px-4 py-2">{v.name || v.vendor_name || "—"}</td>
            <td className="px-4 py-2">{v.brandName || "—"}</td>
            <td className="px-4 py-2">{v.contactMobile || v.mobile || "—"}</td>
            <td className="px-4 py-2">{v.email || "—"}</td>
            <td className="px-5 py-3 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
              <div className="flex justify-center gap-3">
                <button onClick={() => onEdit(v)} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                  <Edit size={16} /> Edit
                </button>
                <button onClick={() => onDeactivate(v._id)} className="flex items-center gap-1 text-red-600 hover:text-red-800">
                  <Ban size={16} /> Deactivate
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const Modal = ({ children, onClose, maxWidth = "max-w-3xl" }) => createPortal(
  <div
    className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
  >
    <div className={`relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] ${maxWidth}`}>
      {children}
    </div>
  </div>,
  document.body
);

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT — CSV of vendors, one POST /invite/bulk instead of doing the
// single-invite flow by hand N times. Each row still gets its own token,
// invite doc and (if it has an email) invite email, same as a single invite.
// ─────────────────────────────────────────────────────────────────────────────
const CSV_COLUMN_ALIASES = {
  company_name:   ["company_name", "company", "vendor_name", "companyname"],
  mobile:         ["mobile", "phone", "contact_number", "mobile_number"],
  email:          ["email", "email_address"],
  contact_person: ["contact_person", "contact_name", "contactname", "contact"],
  product_type:   ["product_type", "product_category", "category", "productcategory"],
  address:        ["address"],
  brand_name:     ["brand_name", "brand", "brandname"],
};

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// Shared by both CSV and Excel paths — `raw` is a plain object keyed by
// lowercased/underscored header name, however it was produced.
function normalizeRawRow(raw) {
  const row = {};
  for (const [key, aliases] of Object.entries(CSV_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (raw[alias]) { row[key] = String(raw[alias]).trim(); break; }
    }
  }
  return row;
}

function parseCsv(text) {
  const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const raw = {};
    headers.forEach((h, i) => { raw[h] = cells[i] || ""; });
    return normalizeRawRow(raw);
  }).filter((row) => row.company_name || row.mobile);
}

async function parseXlsx(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return sheetRows.map((sheetRow) => {
    const raw = {};
    Object.entries(sheetRow).forEach(([header, value]) => {
      raw[String(header).toLowerCase().trim().replace(/\s+/g, "_")] = String(value ?? "").trim();
    });
    return normalizeRawRow(raw);
  }).filter((row) => row.company_name || row.mobile);
}

function BulkImportModal({ onClose, onDone }) {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const handleText = (text) => {
    setRawText(text);
    setParsedRows(parseCsv(text));
    setError("");
  };

  const handleFile = async (file) => {
    setError("");
    const isExcel = /\.xlsx?$/i.test(file.name) || file.type.includes("spreadsheet") || file.type.includes("excel");
    if (isExcel) {
      setRawText(""); // no meaningful raw text to show for a binary file — preview table covers it
      try {
        setParsedRows(await parseXlsx(file));
      } catch {
        setError("Could not read that Excel file. Make sure it's a valid .xlsx/.xls workbook.");
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!parsedRows.length) { setError("No valid rows to import. Each row needs at least a company name and mobile number."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/invite/bulk`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ rows: parsedRows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Bulk import failed.");
      setResults(json);
      onDone?.();
    } catch (err) {
      setError(err.message || "Bulk import failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5">
        <UserPlus className="h-6 w-6 text-white" />
        <div>
          <h2 className="text-lg font-semibold text-white">Import Vendors</h2>
          <p className="mt-0.5 text-xs text-indigo-200">CSV or Excel — bulk-create invites, same links you'd generate one at a time</p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-indigo-100 hover:bg-white/10"><X size={20} /></button>
      </div>

      <div className="space-y-4 p-6">
        {!results ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-bold text-slate-700">Expected columns (header row required):</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">company_name, mobile, email, contact_person, product_type, address, brand_name</p>
              <p className="mt-2">Only <strong>company_name</strong> and <strong>mobile</strong> are required per row.</p>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Upload CSV or Excel file</span>
              <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
                className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-violet-700 hover:file:bg-violet-100" />
            </label>

            <div className="text-center text-xs font-bold text-slate-400">— or paste CSV text —</div>

            <textarea value={rawText} onChange={(e) => handleText(e.target.value)} rows={6}
              placeholder="company_name,mobile,email,contact_person,product_type,address,brand_name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />

            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">⚠️ {error}</div>}

            {parsedRows.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase text-slate-500">
                    <tr>{["Company", "Mobile", "Email", "Contact", "Category"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={!r.company_name || !r.mobile ? "bg-red-50" : ""}>
                        <td className="px-3 py-1.5">{r.company_name || "—"}</td>
                        <td className="px-3 py-1.5">{r.mobile || "—"}</td>
                        <td className="px-3 py-1.5">{r.email || "—"}</td>
                        <td className="px-3 py-1.5">{r.contact_person || "—"}</td>
                        <td className="px-3 py-1.5">{r.product_type || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={submit} disabled={submitting || !parsedRows.length}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/15 transition hover:brightness-110 disabled:opacity-50">
                {submitting ? "Importing…" : `Import ${parsedRows.length} vendor${parsedRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{results.message}</div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left font-bold uppercase text-slate-500">
                  <tr>{["Company", "Status", "Emailed", "Reason"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.company_name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === "created" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-1.5">{r.status === "created" ? (r.emailed ? "Yes" : "No email") : "—"}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-violet-600/15 transition hover:brightness-110">Done</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVITATIONS TRACKER — every invite this buyer has sent, and its status
// ─────────────────────────────────────────────────────────────────────────────
const INVITE_STATUS_STYLE = {
  Pending:    "bg-amber-100 text-amber-700",
  Registered: "bg-emerald-100 text-emerald-700",
  Expired:    "bg-slate-100 text-slate-500",
};

const InvitationsModal = ({ onClose }) => {
  const [invites, setInvites] = useState([]);
  const [counts, setCounts] = useState({ Pending: 0, Registered: 0, Expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [copiedId, setCopiedId] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/invites`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Could not load invitations.");
      setInvites(json.data || []);
      setCounts(json.counts || { Pending: 0, Registered: 0, Expired: 0 });
    } catch (err) { setError(err.message || "Could not load invitations."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = invites.filter((inv) => {
    if (statusFilter !== "All" && inv.status !== statusFilter) return false;
    const haystack = [inv.companyName, ...(inv.brandNames || []), inv.contactName, inv.mobile, inv.email, inv.productCategory].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const copyInviteLink = (inv) => {
    const link = `${FRONTEND_URL}/vendor/register?token=${inv.token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(inv.id); setTimeout(() => setCopiedId(""), 2000);
    });
  };

  const whatsAppInvite = (inv) => {
    const link = `${FRONTEND_URL}/vendor/register?token=${inv.token}`;
    const msg = `Hi ${inv.contactName}, CitiMart is pleased to invite ${inv.companyName} to join our vendor network.\n\nComplete your registration here:\n${link}\n\nThis link expires in 7 days.\n\nRegards,\nCitiMart Team`;
    const clean = (inv.mobile || "").replace(/\D/g, "");
    const num = clean.startsWith("91") ? clean : `91${clean}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const total = counts.Pending + counts.Registered + counts.Expired;

  return (
    <Modal onClose={onClose} maxWidth="max-w-6xl">
      <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5">
        <Mail className="h-6 w-6 text-white" />
        <div>
          <h2 className="text-lg font-semibold text-white">Invitations Sent</h2>
          <p className="mt-0.5 text-xs text-indigo-200">Track every vendor invite — who's onboarded, who's still pending, who's expired</p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-indigo-100 hover:bg-white/10"><X size={20} /></button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        {[["All", total], ["Pending", counts.Pending], ["Registered", counts.Registered], ["Expired", counts.Expired]].map(([key, count]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${statusFilter === key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {key} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
          <RefreshCcw size={13} /> Refresh
        </button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by company, brand, contact, mobile or email..." />

      {error && <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">⚠️ {error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
            <tr>
              {["Company / Brand", "Contact", "Category", "Status", "Invited by", "Sent", "Action"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No invitations found.</td></tr>
            ) : filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{inv.companyName}</p>
                  {!!inv.brandNames?.length && <p className="text-xs text-slate-400">{inv.brandNames.join(", ")}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{inv.contactName}</p>
                  <p className="text-xs text-slate-400">{inv.mobile}{inv.email ? ` · ${inv.email}` : ""}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{inv.productCategory || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${INVITE_STATUS_STYLE[inv.status] || INVITE_STATUS_STYLE.Pending}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{inv.invitedBy || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(inv.createdAt)}</td>
                <td className="px-4 py-3">
                  {inv.status === "Pending" && inv.token ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => copyInviteLink(inv)} title="Copy invite link"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100">
                        {copiedId === inv.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => whatsAppInvite(inv)} title="Resend via WhatsApp"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600">
                        <MessageCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

const SectionHeader = ({ title, color }) => (
  <div className={`bg-gradient-to-r ${color} px-5 py-3.5 text-sm font-extrabold text-white`}>
    {title}
  </div>
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
    <Search size={18} className="text-gray-500" />
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="w-full border-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" />
  </div>
);

const Info = ({ label, value }) => (
  <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
    <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
    <p className="text-gray-800 font-semibold mt-1">{String(value) || "—"}</p>
  </div>
);

const LabeledInput = ({ label, value, onChange, placeholder }) => (
  <div>
    <p className="mb-1.5 text-xs font-bold text-slate-600">{label}</p>
    <input type="text" value={value} onChange={onChange} placeholder={placeholder || ""}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
  </div>
);

export default Vendors;
