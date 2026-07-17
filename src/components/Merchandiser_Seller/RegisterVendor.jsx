import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

// import React, { useState, useEffect } from "react";
// import { useSearchParams } from "react-router-dom";
// import { Building, CheckCircle2, RotateCcw, Eye, EyeOff } from "lucide-react";

// const RegisterVendor = () => {
//   const API_BASE_URL = `${APP_API_URL}`;

//   const [params]    = useSearchParams();
//   const token       = params.get("token") || "";

//   const [loading,      setLoading]      = useState(false);
//   const [success,      setSuccess]      = useState(false);
//   const [error,        setError]        = useState("");
//   const [tokenLoading, setTokenLoading] = useState(!!token);
//   const [tokenError,   setTokenError]   = useState("");
//   const [inviteInfo,   setInviteInfo]   = useState(null);
//   const [showPw,       setShowPw]       = useState(false);
//   const [showCpw,      setShowCpw]      = useState(false);

//   const initialState = {
//     name: "", brandName: "", companyType: "", industryType: "",
//     productType: "", ownerName: "", contactName: "", contactMobile: "",
//     email: "", website: "", address: "", cityName: "", state: "",
//     pincode: "", pan: "", gstCategory: "", gstin: "", gstState: "",
//     password: "", confirmPw: "",
//   };

//   const [vendorForm, setVendorForm] = useState(initialState);
//   const handleChange = (field) => (e) =>
//     setVendorForm({ ...vendorForm, [field]: e.target.value });

//   /* ── If token present, validate and pre-fill ── */
//   useEffect(() => {
//     if (!token) return;
//     (async () => {
//       try {
//         const res  = await fetch(`${API_BASE_URL}/api/vendors/register-by-token?token=${token}`);
//         const json = await res.json();
//         if (!res.ok) {
//           setTokenError(json.detail || "Invalid or expired invite link.");
//         } else {
//           const info = {
//             company_name:   json.companyName    || json.company_name   || "",
//             contact_person: json.contactName    || json.contact_person || "",
//             mobile:         json.mobile         || "",
//             email:          json.email          || "",
//             product_type:   json.productCategory || json.product_type  || "",
//             website:        json.website        || "",
//           };
//           setInviteInfo(info);
//           // Pre-fill matching fields
//           setVendorForm(p => ({
//             ...p,
//             name:          info.company_name,
//             contactName:   info.contact_person,
//             contactMobile: info.mobile,
//             email:         info.email,
//             productType:   info.product_type,
//             website:       info.website,
//           }));
//         }
//       } catch {
//         setTokenError("Could not connect to server. Please try again.");
//       } finally {
//         setTokenLoading(false);
//       }
//     })();
//   }, [token]);

//   const handleReset = () => {
//     setVendorForm({
//       ...initialState,
//       // keep pre-filled fields if invite
//       name:          inviteInfo?.company_name   || "",
//       contactName:   inviteInfo?.contact_person || "",
//       contactMobile: inviteInfo?.mobile         || "",
//       email:         inviteInfo?.email          || "",
//       productType:   inviteInfo?.product_type   || "",
//       website:       inviteInfo?.website        || "",
//     });
//     setError("");
//   };

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError("");

//     if (!vendorForm.name || !vendorForm.email || !vendorForm.contactMobile ||
//         !vendorForm.productType || !vendorForm.pan) {
//       setError("Please fill all required fields marked with *"); return;
//     }
//     if (!/\S+@\S+\.\S+/.test(vendorForm.email)) {
//       setError("Please enter a valid email address"); return;
//     }
//     if (!/^\d{10}$/.test(vendorForm.contactMobile)) {
//       setError("Please enter a valid 10-digit contact number"); return;
//     }
//     // Password required only for invite-link flow
//     if (token) {
//       if (vendorForm.password.length < 8) {
//         setError("Password must be at least 8 characters"); return;
//       }
//       if (vendorForm.password !== vendorForm.confirmPw) {
//         setError("Passwords do not match"); return;
//       }
//     }

//     try {
//       setLoading(true);
//       const res = await fetch(`${API_BASE_URL}/api/vendors/register`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           name:          vendorForm.name,
//           brandName:     vendorForm.brandName,
//           contactMobile: vendorForm.contactMobile,
//           email:         vendorForm.email,
//           product_type:  vendorForm.productType,
//           ...vendorForm,
//           token, 
//           source: token ? "invite_link" : "self_registration",
//           ...(token && vendorForm.password ? { password: vendorForm.password } : {}),
//         }),
//       });

//       if (!res.ok) {
//         const errData = await res.json();
//         throw new Error(errData.detail || "Registration failed");
//       }

//       const json = await res.json();

//       // If invite token → mark it as used
//       if (token) {
//         await fetch(`${API_BASE_URL}/api/vendors/register-by-token`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ token, vendor_id: json.vendor_id || "" }),
//         });
//       }

//       setSuccess(true);
//       setVendorForm(initialState);
//     } catch (err) {
//       setError(err.message || "Server error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   /* ── Token loading spinner ── */
//   if (tokenLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
//         <div className="text-center">
//           <div className="w-10 h-10 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
//           <p className="text-gray-500 text-sm">Validating your invite link…</p>
//         </div>
//       </div>
//     );
//   }

//   /* ── Token error ── */
//   if (token && tokenError) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
//         <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center">
//           <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
//             <Building className="text-red-500" size={28} />
//           </div>
//           <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
//           <p className="text-gray-500 text-sm">{tokenError}</p>
//           <p className="text-gray-400 text-xs mt-4">
//             Please contact CitiMart for a new invitation link.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   /* ── Success Screen ── */
//   if (success) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e293b] text-white text-center p-6">
//         <CheckCircle2 className="h-16 w-16 text-green-400 mb-4" />
//         <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
//         <p className="text-gray-300 mb-6 max-w-sm text-sm">
//           {token
//             ? "Your details have been submitted. CitiMart will review and approve your profile shortly."
//             : "Your vendor details have been submitted for review. You'll receive an approval email once verified by the admin."}
//         </p>
//         <a href="/merchandiser-seller/login"
//           className="bg-purple-600 hover:bg-purple-700 px-5 py-2 rounded-md font-medium transition-all">
//           Go to Login
//         </a>
//       </div>
//     );
//   }

//   /* ── Registration Form UI — exactly your original ── */
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex justify-center py-12 px-6">
//       <form onSubmit={handleSubmit}
//         className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">

//         {/* HEADER */}
//         <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-5 flex items-center gap-3">
//           <Building className="h-7 w-7" />
//           <div>
//             <h2 className="text-2xl font-semibold">Vendor Registration Form</h2>
//             {inviteInfo?.company_name && (
//               <p className="text-indigo-200 text-xs mt-0.5">
//                 CitiMart has invited <strong>{inviteInfo.company_name}</strong> — some fields are pre-filled
//               </p>
//             )}
//           </div>
//         </div>

//         {/* ERROR MESSAGE */}
//         {error && (
//           <div className="bg-red-100 text-red-600 text-center py-2 font-medium text-sm">
//             ⚠️ {error}
//           </div>
//         )}

//         {/* BODY */}
//         <div className="p-8 space-y-10">

//           {/* Company Information */}
//           <Section title="Company Information" color="bg-purple-500" />
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <InputField label="Vendor Name*" value={vendorForm.name}
//               onChange={handleChange("name")} placeholder="Vendor Name"
//               prefilled={!!inviteInfo?.company_name} />
//             <InputField label="Brand Name" value={vendorForm.brandName}
//               onChange={handleChange("brandName")} placeholder="Brand Name" />
//             <InputField label="Company Type" value={vendorForm.companyType}
//               onChange={handleChange("companyType")} placeholder="Pvt. Ltd / LLP / Proprietorship" />
//             <InputField label="Industry Type" value={vendorForm.industryType}
//               onChange={handleChange("industryType")} placeholder="Retail / Manufacturing / Services" />
//             <InputField label="Product Type*" value={vendorForm.productType}
//               onChange={handleChange("productType")} placeholder="Apparel / Electronics / FMCG etc."
//               prefilled={!!inviteInfo?.product_type} />
//             <InputField label="Owner Name" value={vendorForm.ownerName}
//               onChange={handleChange("ownerName")} placeholder="Owner / Director Name" />
//           </div>

//           {/* Tax & Registration */}
//           <Section title="Tax & Registration Details" color="bg-indigo-500" />
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <InputField label="PAN*" value={vendorForm.pan}
//               onChange={e => setVendorForm(p => ({ ...p, pan: e.target.value.toUpperCase() }))}
//               placeholder="ABCDE1234F" />
//             <SelectField label="GST Category" value={vendorForm.gstCategory}
//               onChange={handleChange("gstCategory")}
//               options={["Normal Registered", "Composition", "Unregistered"]} />
//             <InputField label="GST Identification No." value={vendorForm.gstin}
//               onChange={e => setVendorForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
//               placeholder="22AAAAA0000A1Z5" />
//             <SelectField label="GST State" value={vendorForm.gstState}
//               onChange={handleChange("gstState")}
//               options={["19 - West Bengal (WB)", "27 - Maharashtra (MH)", "07 - Delhi (DL)",
//                         "33 - Tamil Nadu (TN)", "09 - Uttar Pradesh (UP)"]} />
//           </div>

//           {/* Contact */}
//           <Section title="Contact & Communication" color="bg-pink-500" />
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <InputField label="Contact Person*" value={vendorForm.contactName}
//               onChange={handleChange("contactName")} placeholder="Contact Person Name"
//               prefilled={!!inviteInfo?.contact_person} />
//             <InputField label="Contact Number*" value={vendorForm.contactMobile}
//               onChange={handleChange("contactMobile")} placeholder="10-digit mobile number"
//               prefilled={!!inviteInfo?.mobile} />
//             <InputField label="Email*" type="email" value={vendorForm.email}
//               onChange={handleChange("email")} placeholder="vendor@example.com"
//               prefilled={!!inviteInfo?.email} />
//             <InputField label="Website (Optional)" value={vendorForm.website}
//               onChange={handleChange("website")} placeholder="https://example.com"
//               prefilled={!!inviteInfo?.website} />
//           </div>

//           {/* Address */}
//           <Section title="Business Address" color="bg-teal-500" />
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             <div className="md:col-span-2">
//               <InputTextArea label="Address*" value={vendorForm.address}
//                 onChange={handleChange("address")} placeholder="Full business address" />
//             </div>
//             <InputField label="City*" value={vendorForm.cityName}
//               onChange={handleChange("cityName")} placeholder="City Name" />
//             <InputField label="State*" value={vendorForm.state}
//               onChange={handleChange("state")} placeholder="State Name" />
//             <InputField label="Pincode*" value={vendorForm.pincode}
//               onChange={e => setVendorForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g,"").slice(0,6) }))}
//               placeholder="700001" />
//           </div>

//           {/* Password — only shown for invite-link flow */}
//           {token && (
//             <>
//               <Section title="Set Your Password" color="bg-gray-600" />
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div className="flex flex-col gap-1">
//                   <label className="text-sm font-medium text-gray-700">Password *</label>
//                   <div className="relative">
//                     <input type={showPw ? "text" : "password"} value={vendorForm.password}
//                       onChange={handleChange("password")} placeholder="Minimum 8 characters"
//                       className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10" />
//                     <button type="button" onClick={() => setShowPw(v => !v)}
//                       className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                       {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
//                     </button>
//                   </div>
//                 </div>
//                 <div className="flex flex-col gap-1">
//                   <label className="text-sm font-medium text-gray-700">Confirm Password *</label>
//                   <div className="relative">
//                     <input type={showCpw ? "text" : "password"} value={vendorForm.confirmPw}
//                       onChange={handleChange("confirmPw")} placeholder="Repeat password"
//                       className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10" />
//                     <button type="button" onClick={() => setShowCpw(v => !v)}
//                       className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                       {showCpw ? <EyeOff size={15} /> : <Eye size={15} />}
//                     </button>
//                   </div>
//                   {vendorForm.confirmPw && (
//                     <p className={`text-xs mt-1 font-medium ${vendorForm.password === vendorForm.confirmPw ? "text-green-600" : "text-red-500"}`}>
//                       {vendorForm.password === vendorForm.confirmPw ? "✓ Passwords match" : "✗ Passwords do not match"}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             </>
//           )}

//         </div>

//         {/* FOOTER — exactly your original */}
//         <div className="px-8 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
//           <button type="button" onClick={handleReset}
//             className="flex items-center gap-2 bg-white/10 border border-white/30 text-white px-6 py-2 rounded-md font-medium hover:bg-white/20 transition-all">
//             <RotateCcw size={16} /> Reset Form
//           </button>
//           <button type="submit" disabled={loading}
//             className="flex items-center gap-2 bg-white text-purple-700 font-semibold px-8 py-2 rounded-md hover:bg-purple-100 transition-all disabled:opacity-60">
//             {loading ? "Submitting..." : "Submit Registration"}
//           </button>
//         </div>

//       </form>
//     </div>
//   );
// };

// /* ── Helper Components — exactly your original ── */
// const InputField = ({ label, value, onChange, placeholder, type = "text", prefilled }) => (
//   <div className="flex flex-col gap-1">
//     <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
//       {label}
//       {prefilled && (
//         <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">
//           pre-filled
//         </span>
//       )}
//     </label>
//     <input type={type} value={value} onChange={onChange} placeholder={placeholder}
//       className={`w-full border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400
//         ${prefilled ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-300 bg-white"}`} />
//   </div>
// );

// const SelectField = ({ label, value, onChange, options = [] }) => (
//   <div className="flex flex-col gap-1">
//     <label className="text-sm font-medium text-gray-700">{label}</label>
//     <select value={value} onChange={onChange}
//       className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400">
//       <option value="">Select</option>
//       {options.map((opt, i) => <option key={i}>{opt}</option>)}
//     </select>
//   </div>
// );

// const InputTextArea = ({ label, value, onChange, placeholder }) => (
//   <div className="flex flex-col gap-1">
//     <label className="text-sm font-medium text-gray-700">{label}</label>
//     <textarea value={value} onChange={onChange} placeholder={placeholder}
//       className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 h-24 resize-none" />
//   </div>
// );

// const Section = ({ title, color }) => (
//   <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
//     <span className={`h-2 w-2 ${color} rounded-full`} />
//     {title}
//   </h3>
// );

// export default RegisterVendor;




import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Building, CheckCircle2, RotateCcw, Eye, EyeOff } from "lucide-react";

const BUSINESS_TYPES = [
  ["general_vendor", "General vendor"],
  ["wholesaler", "Wholesaler"],
  ["manufacturer", "Manufacturer"],
  ["distributor", "Distributor"],
  ["exporter", "Exporter"],
  ["fabric_supplier", "Fabric supplier"],
  ["job_worker", "Job-work partner"],
  ["retailer", "Retailer / store owner"],
];

const RegisterVendor = () => {
  const API_BASE_URL = `${APP_API_URL}`;

  const [params]    = useSearchParams();
  const token       = params.get("token") || "";

  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState("");
  const [tokenLoading, setTokenLoading] = useState(!!token);
  const [tokenError,   setTokenError]   = useState("");
  const [inviteInfo,   setInviteInfo]   = useState(null);
  const [showPw,       setShowPw]       = useState(false);
  const [showCpw,      setShowCpw]      = useState(false);

  // ── Self-registration only: retailer picker ──────────────────────────────
  // A vendor arriving with an invite token already has a known tenant (from
  // the invite itself). A vendor arriving with NO token has no way to
  // declare which retailer they're registering to supply — so they pick
  // one explicitly from the public retailer list. Loaded only when there's
  // no token, since the invite-link path never needs it.
  const [tenants,          setTenants]          = useState([]);
  const [tenantsLoading,   setTenantsLoading]   = useState(!token);
  const [selectedTenantIds, setSelectedTenantIds] = useState([]);
  const [retailerSearch, setRetailerSearch] = useState("");

  const toggleTenant = (tenantId) => {
    setSelectedTenantIds(current => current.includes(tenantId)
      ? current.filter(id => id !== tenantId)
      : [...current, tenantId]);
  };

  const visibleTenants = tenants.filter(tenant => {
    const query = retailerSearch.trim().toLowerCase();
    return !query || tenant.company_name.toLowerCase().includes(query) || tenant.tenant_id.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (token) return; // invite path — tenant already known, skip
    (async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/tenants/public`);
        const json = await res.json();
        if (res.ok) setTenants(json.data || []);
      } catch {
        // Non-fatal — the dropdown will just show "no retailers available"
        // and the submit validation below will block submission until
        // fixed, rather than silently registering with no tenant.
      } finally {
        setTenantsLoading(false);
      }
    })();
  }, [token]);


  const initialState = {
    name: "", brandName: "", companyType: "", industryType: "",
    businessType: "",
    productType: "", ownerName: "", contactName: "", contactMobile: "",
    email: "", website: "", address: "", cityName: "", state: "",
    pincode: "", pan: "", gstCategory: "", gstin: "", gstState: "",
    password: "", confirmPw: "",
  };

  const [vendorForm, setVendorForm] = useState(initialState);
  const handleChange = (field) => (e) =>
    setVendorForm({ ...vendorForm, [field]: e.target.value });

  /* ── If token present, validate and pre-fill ── */
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/vendors/register-by-token?token=${token}`);
        const json = await res.json();
        if (!res.ok) {
          setTokenError(json.detail || "Invalid or expired invite link.");
        } else {
          const info = {
            company_name:   json.companyName    || json.company_name   || "",
            contact_person: json.contactName    || json.contact_person || "",
            mobile:         json.mobile         || "",
            email:          json.email          || "",
            product_type:   json.productCategory || json.product_type  || "",
            website:        json.website        || "",
          };
          setInviteInfo(info);
          // Pre-fill matching fields
          setVendorForm(p => ({
            ...p,
            name:          info.company_name,
            contactName:   info.contact_person,
            contactMobile: info.mobile,
            email:         info.email,
            productType:   info.product_type,
            website:       info.website,
          }));
        }
      } catch {
        setTokenError("Could not connect to server. Please try again.");
      } finally {
        setTokenLoading(false);
      }
    })();
  }, [token]);

  const handleReset = () => {
    setVendorForm({
      ...initialState,
      // keep pre-filled fields if invite
      name:          inviteInfo?.company_name   || "",
      contactName:   inviteInfo?.contact_person || "",
      contactMobile: inviteInfo?.mobile         || "",
      email:         inviteInfo?.email          || "",
      productType:   inviteInfo?.product_type   || "",
      website:       inviteInfo?.website        || "",
    });
    setError("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!vendorForm.name || !vendorForm.email || !vendorForm.contactMobile || !vendorForm.businessType ||
        !vendorForm.productType || !vendorForm.pan) {
      setError("Please fill all required fields marked with *"); return;
    }
    if (!/\S+@\S+\.\S+/.test(vendorForm.email)) {
      setError("Please enter a valid email address"); return;
    }
    if (!/^\d{10}$/.test(vendorForm.contactMobile)) {
      setError("Please enter a valid 10-digit contact number"); return;
    }
    // Self-registration (no invite): a retailer must be explicitly chosen —
    // there is no other way for the backend to know which tenant this
    // vendor belongs to.
    if (!token && selectedTenantIds.length === 0) {
      setError("Please select at least one retailer you're registering with."); return;
    }
    // Password required only for invite-link flow
    if (token) {
      if (vendorForm.password.length < 8) {
        setError("Password must be at least 8 characters"); return;
      }
      if (vendorForm.password !== vendorForm.confirmPw) {
        setError("Passwords do not match"); return;
      }
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/vendors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          vendorForm.name,
          brandName:     vendorForm.brandName,
          contactMobile: vendorForm.contactMobile,
          email:         vendorForm.email,
          product_type:  vendorForm.productType,
          business_type: [vendorForm.businessType],
          ...vendorForm,
          token,
          tenant_id: token ? undefined : selectedTenantIds[0],
          tenant_ids: token ? undefined : selectedTenantIds,
          source: token ? "invite_link" : "self_registration",
          ...(token && vendorForm.password ? { password: vendorForm.password } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Registration failed");
      }

      const json = await res.json();

      // If invite token → mark it as used
      if (token) {
        await fetch(`${API_BASE_URL}/api/vendors/register-by-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, vendor_id: json.vendor_id || "" }),
        });
      }

      setSuccess(true);
      setVendorForm(initialState);
    } catch (err) {
      setError(err.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  /* ── Token loading spinner ── */
  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Validating your invite link…</p>
        </div>
      </div>
    );
  }

  /* ── Token error ── */
  if (token && tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Building className="text-red-500" size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">{tokenError}</p>
          <p className="text-gray-400 text-xs mt-4">
            Please contact CitiMart for a new invitation link.
          </p>
        </div>
      </div>
    );
  }

  /* ── Success Screen ── */
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#1e293b] text-white text-center p-6">
        <CheckCircle2 className="h-16 w-16 text-green-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
        <p className="text-gray-300 mb-6 max-w-sm text-sm">
          {token
            ? "Your details have been submitted. CitiMart will review and approve your profile shortly."
            : "Your vendor details have been submitted for review. You'll receive an approval email once verified by the admin."}
        </p>
        <a href="/merchandiser-seller/login"
          className="bg-purple-600 hover:bg-purple-700 px-5 py-2 rounded-md font-medium transition-all">
          Go to Login
        </a>
      </div>
    );
  }

  /* ── Registration Form UI ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex justify-center py-12 px-6">
      <form onSubmit={handleSubmit}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-5 flex items-center gap-3">
          <Building className="h-7 w-7" />
          <div>
            <h2 className="text-2xl font-semibold">Vendor Registration Form</h2>
            {inviteInfo?.company_name && (
              <p className="text-indigo-200 text-xs mt-0.5">
                CitiMart has invited <strong>{inviteInfo.company_name}</strong> — some fields are pre-filled
              </p>
            )}
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-100 text-red-600 text-center py-2 font-medium text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* RETAILER PICKER — self-registration only (no invite token) */}
        {!token && (
          <div className="px-8 pt-8">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <label className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5 mb-2">
                Which retailers would you like to supply? *
              </label>
              {tenantsLoading ? (
                <p className="text-xs text-indigo-500">Loading retailers…</p>
              ) : tenants.length === 0 ? (
                <p className="text-xs text-red-500">
                  No retailers are currently available for self-registration. Please contact the retailer
                  directly for an invite link instead.
                </p>
              ) : (
                <div>
                  {tenants.length > 4 && (
                    <div className="mb-3 flex items-center gap-2">
                      <input value={retailerSearch} onChange={event => setRetailerSearch(event.target.value)}
                        placeholder="Search retailer name…"
                        className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                      <span className="shrink-0 rounded-lg bg-indigo-100 px-2.5 py-2 text-xs font-bold text-indigo-700">{selectedTenantIds.length} selected</span>
                    </div>
                  )}
                  <div className={`grid gap-2 pr-1 sm:grid-cols-2 ${tenants.length > 4 ? "max-h-80 overflow-y-auto" : ""}`}>
                  {visibleTenants.map(t => {
                    const selected = selectedTenantIds.includes(t.tenant_id);
                    return (
                      <button key={t.tenant_id} type="button" onClick={() => toggleTenant(t.tenant_id)}
                        className={`rounded-xl border p-3 text-left transition ${selected ? "border-indigo-500 bg-white ring-2 ring-indigo-100" : "border-indigo-200 bg-white/70 hover:border-indigo-400"}`}>
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                          <span className="truncate">{t.company_name}</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                        </span>
                        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{t.account_type === "single_store" ? "Single store" : "Department retailer"}</span>
                      </button>
                    );
                  })}
                  {visibleTenants.length === 0 && (
                    <p className="col-span-full rounded-lg border border-dashed border-indigo-200 bg-white/60 px-4 py-6 text-center text-xs text-slate-500">No retailers match your search.</p>
                  )}
                  </div>
                </div>
              )}
              <p className="text-xs text-indigo-500 mt-2">
                Each selected retailer receives an independent pending request and can approve or reject it separately. Selected: {selectedTenantIds.length}.
              </p>
            </div>
          </div>
        )}

        {/* BODY */}
        <div className="p-8 space-y-10">

          {/* Company Information */}
          <Section title="Company Information" color="bg-purple-500" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Primary Business Type *</label>
              <select value={vendorForm.businessType} onChange={handleChange("businessType")}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">Select how your business supplies retailers</option>
                {BUSINESS_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">You can add more business tags later from My Categories, depending on your subscription.</p>
            </div>
            <InputField label="Vendor Name*" value={vendorForm.name}
              onChange={handleChange("name")} placeholder="Vendor Name"
              prefilled={!!inviteInfo?.company_name} />
            <InputField label="Brand Name" value={vendorForm.brandName}
              onChange={handleChange("brandName")} placeholder="Brand Name" />
            <InputField label="Company Type" value={vendorForm.companyType}
              onChange={handleChange("companyType")} placeholder="Pvt. Ltd / LLP / Proprietorship" />
            <InputField label="Industry Type" value={vendorForm.industryType}
              onChange={handleChange("industryType")} placeholder="Retail / Manufacturing / Services" />
            <InputField label="Product Type*" value={vendorForm.productType}
              onChange={handleChange("productType")} placeholder="Apparel / Electronics / FMCG etc."
              prefilled={!!inviteInfo?.product_type} />
            <InputField label="Owner Name" value={vendorForm.ownerName}
              onChange={handleChange("ownerName")} placeholder="Owner / Director Name" />
          </div>

          {/* Tax & Registration */}
          <Section title="Tax & Registration Details" color="bg-indigo-500" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="PAN*" value={vendorForm.pan}
              onChange={e => setVendorForm(p => ({ ...p, pan: e.target.value.toUpperCase() }))}
              placeholder="ABCDE1234F" />
            <SelectField label="GST Category" value={vendorForm.gstCategory}
              onChange={handleChange("gstCategory")}
              options={["Normal Registered", "Composition", "Unregistered"]} />
            <InputField label="GST Identification No." value={vendorForm.gstin}
              onChange={e => setVendorForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
              placeholder="22AAAAA0000A1Z5" />
            <SelectField label="GST State" value={vendorForm.gstState}
              onChange={handleChange("gstState")}
              options={["19 - West Bengal (WB)", "27 - Maharashtra (MH)", "07 - Delhi (DL)",
                        "33 - Tamil Nadu (TN)", "09 - Uttar Pradesh (UP)"]} />
          </div>

          {/* Contact */}
          <Section title="Contact & Communication" color="bg-pink-500" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Contact Person*" value={vendorForm.contactName}
              onChange={handleChange("contactName")} placeholder="Contact Person Name"
              prefilled={!!inviteInfo?.contact_person} />
            <InputField label="Contact Number*" value={vendorForm.contactMobile}
              onChange={handleChange("contactMobile")} placeholder="10-digit mobile number"
              prefilled={!!inviteInfo?.mobile} />
            <InputField label="Email*" type="email" value={vendorForm.email}
              onChange={handleChange("email")} placeholder="vendor@example.com"
              prefilled={!!inviteInfo?.email} />
            <InputField label="Website (Optional)" value={vendorForm.website}
              onChange={handleChange("website")} placeholder="https://example.com"
              prefilled={!!inviteInfo?.website} />
          </div>

          {/* Address */}
          <Section title="Business Address" color="bg-teal-500" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <InputTextArea label="Address*" value={vendorForm.address}
                onChange={handleChange("address")} placeholder="Full business address" />
            </div>
            <InputField label="City*" value={vendorForm.cityName}
              onChange={handleChange("cityName")} placeholder="City Name" />
            <InputField label="State*" value={vendorForm.state}
              onChange={handleChange("state")} placeholder="State Name" />
            <InputField label="Pincode*" value={vendorForm.pincode}
              onChange={e => setVendorForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g,"").slice(0,6) }))}
              placeholder="700001" />
          </div>

          {/* Password — only shown for invite-link flow */}
          {token && (
            <>
              <Section title="Set Your Password" color="bg-gray-600" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Password *</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={vendorForm.password}
                      onChange={handleChange("password")} placeholder="Minimum 8 characters"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Confirm Password *</label>
                  <div className="relative">
                    <input type={showCpw ? "text" : "password"} value={vendorForm.confirmPw}
                      onChange={handleChange("confirmPw")} placeholder="Repeat password"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 pr-10" />
                    <button type="button" onClick={() => setShowCpw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCpw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {vendorForm.confirmPw && (
                    <p className={`text-xs mt-1 font-medium ${vendorForm.password === vendorForm.confirmPw ? "text-green-600" : "text-red-500"}`}>
                      {vendorForm.password === vendorForm.confirmPw ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-8 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
          <button type="button" onClick={handleReset}
            className="flex items-center gap-2 bg-white/10 border border-white/30 text-white px-6 py-2 rounded-md font-medium hover:bg-white/20 transition-all">
            <RotateCcw size={16} /> Reset Form
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-white text-purple-700 font-semibold px-8 py-2 rounded-md hover:bg-purple-100 transition-all disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Registration"}
          </button>
        </div>

      </form>
    </div>
  );
};

/* ── Helper Components ── */
const InputField = ({ label, value, onChange, placeholder, type = "text", prefilled }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
      {label}
      {prefilled && (
        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold">
          pre-filled
        </span>
      )}
    </label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400
        ${prefilled ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-300 bg-white"}`} />
  </div>
);

const SelectField = ({ label, value, onChange, options = [] }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <select value={value} onChange={onChange}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400">
      <option value="">Select</option>
      {options.map((opt, i) => <option key={i}>{opt}</option>)}
    </select>
  </div>
);

const InputTextArea = ({ label, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <textarea value={value} onChange={onChange} placeholder={placeholder}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 h-24 resize-none" />
  </div>
);

const Section = ({ title, color }) => (
  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
    <span className={`h-2 w-2 ${color} rounded-full`} />
    {title}
  </h3>
);

export default RegisterVendor;
