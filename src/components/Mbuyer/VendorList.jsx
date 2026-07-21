import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle, XCircle, Eye, Trash2, Edit, Building,
  Search, RefreshCcw, Ban, UserPlus, MessageCircle,
  Copy, Bell, ChevronRight, X, Link, ClipboardCheck,
  Clock, Check, Mail,
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

  function buildMailtoLink(email, contactName, companyName, regLink) {
    if (!email) return null;
    const subject = `CitiMart Vendor Registration Invite — ${companyName}`;
    const body    = `Hi ${contactName},\n\nCitiMart is pleased to invite ${companyName} to join our vendor network.\n\nPlease complete your registration using the link below (valid for 7 days):\n\n${regLink}\n\nIf you have any questions, please reply to this email.\n\nRegards,\nCitiMart Merchandising Team`;
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // ── Add Vendor: generate invite link ──────────────────────────────────────
  async function handleGenerateLink(formValues) {
    try {
      const res  = await fetch(`${API_BASE_URL}/api/vendors/invite`, {
        method:  "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          company_name:   formValues.companyName,
          contact_person: formValues.contactName,
          mobile:         formValues.mobile,
          email:          formValues.email,
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
    } catch (err) { alert("Error rejecting vendor"); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this vendor?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/delete/${id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      alert("Vendor deleted successfully"); fetchAll();
    } catch (err) { alert("Error deleting vendor"); }
  }

  async function handleDeactivate(id) {
    if (!window.confirm("Deactivate this vendor profile?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/deactivate/${id}`, {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Deactivation failed");
      alert("Vendor deactivated successfully"); fetchAll();
    } catch (err) { alert("Error deactivating vendor"); }
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
  const [form,  setForm]  = useState({ companyName:"", contactName:"", mobile:"", email:"", productCategory:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = field => e => setForm({ ...form, [field]: e.target.value });

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
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-3 py-2">⚠️ {error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label="Company / Vendor Name *" value={form.companyName}  onChange={set("companyName")}     placeholder="e.g. Sunrise Textiles" />
          <LabeledInput label="Contact Person Name *"   value={form.contactName}  onChange={set("contactName")}     placeholder="e.g. Rajesh Kumar" />
          <LabeledInput label="Mobile Number *"         value={form.mobile}       onChange={set("mobile")}           placeholder="10-digit number" />
          <LabeledInput label="Email (if on card)"      value={form.email}        onChange={set("email")}            placeholder="vendor@example.com" />
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
