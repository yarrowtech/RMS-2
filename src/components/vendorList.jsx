import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building } from "lucide-react";


// MAIN COMPONENT: VendorList

export default function VendorList() {
  const navigate = useNavigate();
  const API_BASE_URL = `${APP_API_URL}`;

  const [showAddVendor, setShowAddVendor] = useState(false);
  const [activeTab, setActiveTab] = useState("General");

  const [vendorRows, setVendorRows] = useState([]);
  const [vendorForm, setVendorForm] = useState({
    vendorId: "",
    name: "",
    alias: "",
    cityName: "",
    contactName: "",
    contactMobile: "",
    purchaseTradeGroup: "",
    purchaseItem: "",
    className: "",
    ledgerName: "",
    companyType: "",
    industryType: "",
    productType: "",
    brandName: "",
    directorName: "",
    address: "",
    state: "",
    pincode: "",
    email: "",
    website: "",
    pan: "",
    gstin: "",
    bankName: "",
    accountNo: "",
  });

  
  // HELPERS
  
  const handleChange = (field) => (e) =>
    setVendorForm({ ...vendorForm, [field]: e.target.value });

  const tabs = ["General", "Procurement", "Sales", "Finance", "Production"];

  function goToNextTab() {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    } else {
      handleFinalSave();
    }
  }

  function openAddVendor() {
    setVendorForm({
      vendorId: "",
      name: "",
      alias: "",
      cityName: "",
      contactName: "",
      contactMobile: "",
      purchaseTradeGroup: "",
      purchaseItem: "",
      className: "",
      ledgerName: "",
      companyType: "",
      industryType: "",
      productType: "",
      brandName: "",
      directorName: "",
      address: "",
      state: "",
      pincode: "",
      email: "",
      website: "",
      pan: "",
      gstin: "",
      bankName: "",
      accountNo: "",
    });
    setShowAddVendor(true);
  }

  
  // FETCH VENDORS
  
  useEffect(() => {
    async function fetchVendors() {
      try {
        const res = await fetch(`${API_BASE_URL}/vendors/`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setVendorRows(data);
      } catch (err) {
        console.error("Error fetching vendors:", err);
      }
    }
    fetchVendors();
  }, []);

  
  // SAVE / DELETE
  
  async function handleFinalSave() {
    if (!vendorForm.name) {
      alert("Vendor  Name are required!");
      return;
    }

    const isExisting = vendorRows.some((v) => v.vendorId === vendorForm.vendorId);
    const method = isExisting ? "PUT" : "POST";
    const url = isExisting
      ? `${API_BASE_URL}/vendors/${vendorForm.vendorId}`
      : `${API_BASE_URL}/vendors/`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorForm),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Failed to save vendor");
        return;
      }

      alert("Vendor saved successfully");
      const refreshed = await fetch(`${API_BASE_URL}/vendors/`);
      const data = await refreshed.json();
      setVendorRows(data);
      setShowAddVendor(false);
    } catch (error) {
      console.error("Save error:", error);
      alert("Server error while saving vendor");
    }
  }

  async function handleDeleteVendor(vendorId) {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete vendor");

      alert("Vendor deleted successfully");
      setVendorRows((prev) => prev.filter((v) => v.vendorId !== vendorId));
    } catch (error) {
      console.error("Delete vendor error:", error);
      alert("Error deleting vendor");
    }
  }

  
  // TABLE FILTER
  
  const [q, setQ] = useState("");
  const filteredVendors = vendorRows.filter((r) =>
    Object.values(r).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const labelClass = "text-[13px] font-medium text-gray-600";
  const inputClass =
    "w-full border border-gray-300 rounded-sm px-2 py-1 text-[13px] bg-[#fafafa] focus:outline-none focus:ring-1 focus:ring-gray-500";

  const vendorColumns = [
    { key: "vendorId", label: "Vendor Id" },
    { key: "name", label: "Name" },
    { key: "alias", label: "Alias" },
    { key: "cityName", label: "City" },
    { key: "contactName", label: "Contact Person" },
    { key: "contactMobile", label: "Mobile" },
    { key: "email", label: "Email" },
    { key: "salesTradeGroup", label: "Trade Group" },
    { key: "className", label: "Class" },
    { key: "ledgerName", label: "Ledger" },
  ];

  
  // RENDER
  
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="h-6 w-6 text-blue-600" />
            Vendor List
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage supplier relationships
          </p>
        </div>
        <button
          onClick={openAddVendor}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="h-5 w-5" /> Add Vendor
        </button>
      </div>

      {/* TABLE */}
      <div className="border border-[#dcdcdc] rounded-md bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-[#e5e5e5]">
          <div className="text-[13px] text-gray-700 font-medium">Vendors</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="w-[260px] border border-gray-300 rounded-sm px-2 py-1 text-[13px]"
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-[13px]">
            <thead className="bg-[#f6f7f9] border-b border-[#e5e5e5]">
              <tr>
                {vendorColumns.map((c) => (
                  <th
                    key={c.key}
                    className="text-left font-semibold text-gray-700 px-3 py-2"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="text-left font-semibold text-gray-700 px-3 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={vendorColumns.length + 1}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No vendors found.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[#f0f0f0] hover:bg-[#fafafa]"
                  >
                    {vendorColumns.map((c) => (
                      <td
                        key={c.key}
                        className="px-3 py-2 text-gray-700 whitespace-nowrap"
                      >
                        {row[c.key] ?? "-"}
                      </td>
                    ))}
                    <td className="px-3 py-2 flex gap-3">
                      <button
                        onClick={() => {
                          setVendorForm(row);
                          setShowAddVendor(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVendor(row.vendorId)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showAddVendor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-6xl rounded-md shadow-2xl border border-[#dcdcdc] max-h-[92vh] overflow-y-auto">
            {/* HEADER */}
            <div className="px-6 py-3 border-b bg-[#fafafa]">
              <h2 className="text-lg font-semibold text-gray-800">
                Vendor Form
              </h2>
            </div>

            {/* BASIC INFO */}
            <div className="px-6 py-4 grid grid-cols-3 gap-6 border-b">
              <div>
  <label className={labelClass}>Vendor ID (Auto)</label>
  <input
    className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed`}
    value={vendorForm.vendorId || "Auto Generated"}
    readOnly
  />
</div>

              <div>
                <label className={labelClass}>Name*</label>
                <input
                  className={inputClass}
                  value={vendorForm.name}
                  onChange={handleChange("name")}
                />
              </div>
              <div>
                <label className={labelClass}>Alias*</label>
                <input
                  className={inputClass}
                  value={vendorForm.alias}
                  onChange={handleChange("alias")}
                />
              </div>
            </div>

            {/* TABS */}
            <div className="flex border-b">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 text-[14px] font-medium ${
                    activeTab === tab
                      ? "text-white bg-[#3877fd]"
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="p-6 min-h-[62vh]">
              {activeTab === "General" && (
                <GeneralTab
                  labelClass={labelClass}
                  inputClass={inputClass}
                  vendorForm={vendorForm}
                  handleChange={handleChange}
                />
              )}
             {activeTab === "Procurement" && (
  <ProcurementTab
    labelClass={labelClass}
    inputClass={inputClass}
    vendorForm={vendorForm}
    handleChange={handleChange}
  />
)}

             {activeTab === "Sales" && (
  <SalesTab
    labelClass={labelClass}
    inputClass={inputClass}
    vendorForm={vendorForm}
    handleChange={handleChange}
  />
)}

{activeTab === "Finance" && (
  <FinanceTab
    labelClass={labelClass}
    inputClass={inputClass}
    vendorForm={vendorForm}
    handleChange={handleChange}
  />
)}

{activeTab === "Production" && (
  <ProductionTab
    labelClass={labelClass}
    inputClass={inputClass}
    vendorForm={vendorForm}
    handleChange={handleChange}
  />
)}

            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t flex justify-end bg-white gap-4">
              <button
                onClick={() => {
                  setShowAddVendor(false);
                  setActiveTab("General");
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeTab !== "Production") goToNextTab();
                  else handleFinalSave();
                }}
                className="px-6 py-2 bg-[#0e53e9] text-white rounded hover:bg-[#003b94]"
              >
                {activeTab === "Production"
                  ? "Finish & Save Vendor"
                  : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// TABS (Moved outside main component to prevent re-render issues)

const GeneralTab = ({ labelClass, inputClass, vendorForm, handleChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* LEFT */}
      <div>
        {/* Information */}
        <h3 className="font-semibold text-gray-800 mb-2 text-[15px]">Information</h3>
        <div className="border border-[#dcdcdc] bg-[#fafafa] rounded-md p-4 space-y-4 shadow-sm">
          <div>
            <label className={labelClass}>Company Type</label>
            <input
              className={inputClass}
              value={vendorForm.companyType}
              onChange={handleChange("companyType")}
              placeholder="Pvt. Ltd / LLP / Proprietorship"
            />
          </div>

          <div>
            <label className={labelClass}>Industry Type</label>
            <input
              className={inputClass}
              value={vendorForm.industryType}
              onChange={handleChange("industryType")}
              placeholder="Retail / Manufacturing / Services"
            />
          </div>

          <div>
            <label className={labelClass}>Product Type</label>
            <input
              className={inputClass}
              value={vendorForm.productType}
              onChange={handleChange("productType")}
              placeholder="Electronics / Apparel / FMCG etc."
            />
          </div>

          <div>
            <label className={labelClass}>Brand Name</label>
            <input
              className={inputClass}
              value={vendorForm.brandName}
              onChange={handleChange("brandName")}
              placeholder="Brand Name"
            />
          </div>

          <div>
            <label className={labelClass}>Director / Owner Name</label>
            <input
              className={inputClass}
              value={vendorForm.directorName}
              onChange={handleChange("directorName")}
              placeholder="Director / Owner"
            />
          </div>
        </div>

        {/* General Section */}
        <h3 className="font-semibold text-gray-800 mt-6 mb-2 text-[15px]">General</h3>
        <div className="border border-[#dcdcdc] bg-[#fafafa] rounded-md p-4 space-y-4 shadow-sm">
          <div>
            <label className={labelClass}>Class Name</label>
            <input
              className={inputClass}
              value={vendorForm.className}
              onChange={handleChange("className")}
              placeholder="Supplier"
            />
          </div>

          <div>
            <label className={labelClass}>Class Type</label>
            <input
              className={inputClass}
              value={vendorForm.classType || ""}
              onChange={handleChange("classType")}
              placeholder="Supplier Type"
            />
          </div>

          <div>
            <label className={labelClass}>AR Ledger</label>
            <input
              className={inputClass}
              value={vendorForm.ledgerName}
              onChange={handleChange("ledgerName")}
              placeholder="Sundry Creditors for Goods"
            />
          </div>

          <div>
            <label className={labelClass}>Transporter Name</label>
            <input
              className={inputClass}
              value={vendorForm.transporterName || ""}
              onChange={handleChange("transporterName")}
              placeholder="Transporter"
            />
          </div>

          <div>
            <label className={labelClass}>Remarks</label>
            <textarea
              className={`${inputClass} h-16`}
              value={vendorForm.remarks || ""}
              onChange={handleChange("remarks")}
              placeholder="Any general remarks"
            />
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div>
        {/* Billing Details */}
        <h3 className="font-semibold text-gray-800 mb-2 text-[15px]">Billing Details</h3>
        <div className="border border-[#dcdcdc] bg-[#fafafa] rounded-md p-4 space-y-4 shadow-sm">
          <div>
            <label className={labelClass}>Contact Person</label>
            <input
              className={inputClass}
              value={vendorForm.contactName}
              onChange={handleChange("contactName")}
              placeholder="Contact Person"
            />
          </div>

          <div>
            <label className={labelClass}>Address</label>
            <textarea
              className={`${inputClass} h-20`}
              value={vendorForm.address}
              onChange={handleChange("address")}
              placeholder="Full Address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>City</label>
              <input
                className={inputClass}
                value={vendorForm.cityName}
                onChange={handleChange("cityName")}
                placeholder="City"
              />
            </div>
            <div>
              <label className={labelClass}>District</label>
              <input
                className={inputClass}
                value={vendorForm.district || ""}
                onChange={handleChange("district")}
                placeholder="District"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>State</label>
              <input
                className={inputClass}
                value={vendorForm.state}
                onChange={handleChange("state")}
                placeholder="State"
              />
            </div>
            <div>
              <label className={labelClass}>Pin Code</label>
              <input
                className={inputClass}
                value={vendorForm.pincode}
                onChange={handleChange("pincode")}
                placeholder="700001"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              className={inputClass}
              value={vendorForm.contactMobile}
              onChange={handleChange("contactMobile")}
              placeholder="03326860120"
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              className={inputClass}
              value={vendorForm.email}
              onChange={handleChange("email")}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className={labelClass}>Website</label>
            <input
              className={inputClass}
              value={vendorForm.website}
              onChange={handleChange("website")}
              placeholder="https://example.com"
            />
          </div>

          
        </div>
      </div>
    </div>
  );
};

// Placeholder tabs (you can expand later)
const ProcurementTab = ({ labelClass, inputClass, vendorForm, handleChange }) => {
  const row =
    "grid grid-cols-12 items-center gap-3 py-2 border-b border-[#ececec] last:border-b-0";
  const leftLabel = "col-span-4";
  const rightField = "col-span-8";

  const card = "bg-[#fcfcfc] border border-[#e7e7e7] rounded-lg p-4 shadow-sm";
  const cardTitle =
    "text-[14px] font-semibold text-gray-800 mb-3 pb-2 border-b border-[#ededed]";

  return (
    <div className="text-[13px] space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT PANEL */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {/* ITEM SETTINGS */}
          <div className={card}>
            <h3 className={cardTitle}>Item Settings</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Create Item with RSP as</label>
              <div className={`${rightField} grid grid-cols-4 gap-2`}>
                <input
                  className={inputClass}
                  value={vendorForm.rspValue || ""}
                  onChange={handleChange("rspValue")}
                  placeholder="50"
                />
                <select
                  className={inputClass}
                  value={vendorForm.rspMarkupType || ""}
                  onChange={handleChange("rspMarkupType")}
                >
                  <option>% Markup on Std. Rate</option>
                  <option>Fixed Markup</option>
                </select>
                <select
                  className={inputClass}
                  value={vendorForm.rspRoundOff || ""}
                  onChange={handleChange("rspRoundOff")}
                >
                  <option>Upper Round Off</option>
                  <option>Lower Round Off</option>
                </select>
                <input
                  className={inputClass}
                  value={vendorForm.rspRoundValue || ""}
                  onChange={handleChange("rspRoundValue")}
                  placeholder="0"
                />
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Create Item with WSP as</label>
              <div className={`${rightField} grid grid-cols-4 gap-2`}>
                <input
                  className={inputClass}
                  value={vendorForm.wspValue || ""}
                  onChange={handleChange("wspValue")}
                  placeholder="0"
                />
                <select
                  className={inputClass}
                  value={vendorForm.wspMarkupType || ""}
                  onChange={handleChange("wspMarkupType")}
                >
                  <option>% Markup on Std. Rate</option>
                  <option>Fixed Markup</option>
                </select>
                <select
                  className={inputClass}
                  value={vendorForm.wspRoundOff || ""}
                  onChange={handleChange("wspRoundOff")}
                >
                  <option>Upper Round Off</option>
                  <option>Lower Round Off</option>
                </select>
                <input
                  className={inputClass}
                  value={vendorForm.wspRoundValue || ""}
                  onChange={handleChange("wspRoundValue")}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* PRICE SETTINGS */}
          <div className={card}>
            <h3 className={cardTitle}>Price Settings</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Populate Item Basic Price</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.basicPriceMode || ""}
                  onChange={handleChange("basicPriceMode")}
                >
                  <option>As per below definition</option>
                  <option>Manual Entry</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Apply Markdown on Item</label>
              <div className={`${rightField} grid grid-cols-2 gap-2`}>
                <select
                  className={inputClass}
                  value={vendorForm.markdownType || ""}
                  onChange={handleChange("markdownType")}
                >
                  <option>%</option>
                  <option>Fixed</option>
                </select>
                <select
                  className={inputClass}
                  value={vendorForm.markdownBasis || ""}
                  onChange={handleChange("markdownBasis")}
                >
                  <option>Standard Rate (User Defined)</option>
                  <option>MRP</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Round Off</label>
              <div className={`${rightField} grid grid-cols-2 gap-2`}>
                <select
                  className={inputClass}
                  value={vendorForm.roundOffType || ""}
                  onChange={handleChange("roundOffType")}
                >
                  <option>Upper Value</option>
                  <option>Lower Value</option>
                </select>
                <input
                  className={inputClass}
                  value={vendorForm.roundOffValue || ""}
                  onChange={handleChange("roundOffValue")}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* ORDER SETTINGS */}
          <div className={card}>
            <h3 className={cardTitle}>Order Settings</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>
                Purchase Order Booking Currency
              </label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.orderCurrency || ""}
                  onChange={handleChange("orderCurrency")}
                >
                  <option>INR</option>
                  <option>USD</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Deliver Order Within (Days)</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  value={vendorForm.deliveryDays || ""}
                  onChange={handleChange("deliveryDays")}
                  placeholder="30"
                />
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Buffer Time Allowed (Days)</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  value={vendorForm.bufferDays || ""}
                  onChange={handleChange("bufferDays")}
                  placeholder="0"
                />
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Purchase Order Limit</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  value={vendorForm.orderLimit || ""}
                  onChange={handleChange("orderLimit")}
                  placeholder="Amount"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* DOCUMENT SETTINGS */}
          <div className={card}>
            <h3 className={cardTitle}>Document Settings</h3>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Tax Region</label>
                <select
                  className={inputClass}
                  value={vendorForm.taxRegion || ""}
                  onChange={handleChange("taxRegion")}
                >
                  <option>West Bengal</option>
                  <option>Maharashtra</option>
                  <option>Delhi</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Trade Group</label>
                <select
                  className={inputClass}
                  value={vendorForm.purchaseTradeGroup}
                  onChange={handleChange("purchaseTradeGroup")}
                >
                  <option>LOCAL</option>
                  <option>INTERSTATE</option>
                  <option>IMPORT</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Purchase Term</label>
                <select
                  className={inputClass}
                  value={vendorForm.purchaseTerm || ""}
                  onChange={handleChange("purchaseTerm")}
                >
                  <option>GST: CGST + SGST</option>
                  <option>IGST</option>
                  <option>NON GST</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Purchase Form</label>
                <select
                  className={inputClass}
                  value={vendorForm.purchaseForm || ""}
                  onChange={handleChange("purchaseForm")}
                >
                  <option>None</option>
                  <option>Form C</option>
                  <option>Form H</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Due Date Basis</label>
                <select
                  className={inputClass}
                  value={vendorForm.dueDateBasis || ""}
                  onChange={handleChange("dueDateBasis")}
                >
                  <option>Entry Date</option>
                  <option>Invoice Date</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-gray-700 pt-1">
                <input
                  type="checkbox"
                  checked={vendorForm.allowConsignmentPurchase || false}
                  onChange={(e) =>
                    handleChange("allowConsignmentPurchase")({
                      target: { value: e.target.checked },
                    })
                  }
                />
                Allow Consignment Purchase
              </label>
            </div>
          </div>

          {/* INCOMING LOGISTICS */}
          <div className={card}>
            <h3 className={cardTitle}>Incoming Logistics</h3>

            <div className="flex flex-col gap-2 text-[13px] text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={vendorForm.logisticsApplicable || false}
                  onChange={(e) =>
                    handleChange("logisticsApplicable")({
                      target: { value: e.target.checked },
                    })
                  }
                />
                Logistics Applicable
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={vendorForm.gateEntryApplicable || false}
                  onChange={(e) =>
                    handleChange("gateEntryApplicable")({
                      target: { value: e.target.checked },
                    })
                  }
                />
                Gate Entry Applicable
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesTab = ({ labelClass, inputClass, vendorForm, handleChange }) => {
  const card = "bg-[#fcfcfc] border border-[#e7e7e7] rounded-lg p-4 shadow-sm";
  const cardTitle =
    "text-[14px] font-semibold text-gray-800 mb-3 pb-2 border-b border-[#ededed]";
  const row =
    "grid grid-cols-12 items-center gap-3 py-2 border-b border-[#ececec] last:border-b-0";
  const leftLabel = "col-span-4";
  const rightField = "col-span-8";

  return (
    <div className="text-[13px] space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT SIDE */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className={card}>
            <h3 className={cardTitle}>Document Settings</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Trade Group</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.salesTradeGroup || ""}
                  onChange={handleChange("salesTradeGroup")}
                >
                  <option value="">Select</option>
                  <option>LOCAL</option>
                  <option>INTERSTATE</option>
                  <option>EXPORT</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Sales Term</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.salesTerm || ""}
                  onChange={handleChange("salesTerm")}
                >
                  <option value="">Select</option>
                  <option>GST: CGST + SGST</option>
                  <option>IGST</option>
                  <option>NON GST</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Sales Form</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.salesForm || ""}
                  onChange={handleChange("salesForm")}
                >
                  <option value="">Select</option>
                  <option>None</option>
                  <option>Form C</option>
                  <option>Form H</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Price List Name</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.priceListName || ""}
                  onChange={handleChange("priceListName")}
                >
                  <option value="">Select</option>
                  <option>Default</option>
                  <option>Wholesale</option>
                  <option>Retail</option>
                </select>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Agent Details</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Agent Name</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.agentName || ""}
                  onChange={handleChange("agentName")}
                >
                  <option value="">Select Agent</option>
                  <option>NA</option>
                  <option>Agent A</option>
                  <option>Agent B</option>
                </select>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Commission</label>
              <div className={`${rightField} grid grid-cols-12 gap-2`}>
                <div className="col-span-8">
                  <input
                    className={inputClass}
                    value={vendorForm.commissionValue || ""}
                    onChange={handleChange("commissionValue")}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-4">
                  <select
                    className={inputClass}
                    value={vendorForm.commissionType || ""}
                    onChange={handleChange("commissionType")}
                  >
                    <option>%</option>
                    <option>Fixed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className={card}>
            <h3 className={cardTitle}>Credit Settings</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Credit Rating</label>
                <select
                  className={inputClass}
                  value={vendorForm.creditRating || ""}
                  onChange={handleChange("creditRating")}
                >
                  <option value="">Select</option>
                  <option>A</option>
                  <option>B</option>
                  <option>C</option>
                </select>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8">
                  <label className={labelClass}>
                    Invoice Due Date to be considered from
                  </label>
                  <input
                    className={inputClass}
                    value={vendorForm.invoiceDueDays || ""}
                    onChange={handleChange("invoiceDueDays")}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-4">
                  <label className={`${labelClass} opacity-0`}>.</label>
                  <div className="w-full border rounded-sm px-2 py-1 text-[13px] bg-[#fafafa] text-gray-600">
                    days
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8">
                  <label className={labelClass}>
                    Interest Charged for delayed payment
                  </label>
                  <input
                    className={inputClass}
                    value={vendorForm.interestRate || ""}
                    onChange={handleChange("interestRate")}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-4">
                  <label className={`${labelClass} opacity-0`}>.</label>
                  <div className="w-full border rounded-sm px-2 py-1 text-[13px] bg-[#fafafa] text-gray-600">
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Credit Verification</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Credit Rule violation depends on</label>
                <select
                  className={inputClass}
                  value={vendorForm.creditRule || ""}
                  onChange={handleChange("creditRule")}
                >
                  <option>None</option>
                  <option>Overdue Days</option>
                  <option>Overdue Amount</option>
                </select>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-7">
                  <label className={labelClass}>Invoice Credit Limit set to Rs.</label>
                  <input
                    className={inputClass}
                    value={vendorForm.creditLimit || ""}
                    onChange={handleChange("creditLimit")}
                    placeholder="0"
                  />
                </div>

                <div className="col-span-5">
                  <label className={labelClass}>with Tolerance of</label>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-8">
                      <input
                        className={inputClass}
                        value={vendorForm.tolerance || ""}
                        onChange={handleChange("tolerance")}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <div className="w-full border rounded-sm px-2 py-1 text-[13px] bg-[#fafafa] text-gray-600 text-center">
                        %
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <label className={labelClass}>No. of days for Overdue Date</label>
                  <input
                    className={inputClass}
                    value={vendorForm.overdueDays || ""}
                    onChange={handleChange("overdueDays")}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-6">
                  <label className={labelClass}>Overdue Amount</label>
                  <input
                    className={inputClass}
                    value={vendorForm.overdueAmount || ""}
                    onChange={handleChange("overdueAmount")}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Outgoing Logistics</h3>
            <label className="flex items-center gap-2 text-[13px] text-gray-700">
              <input
                type="checkbox"
                checked={vendorForm.outgoingLogisticsApplicable || false}
                onChange={(e) =>
                  handleChange("outgoingLogisticsApplicable")({
                    target: { value: e.target.checked },
                  })
                }
              />
              Logistics Applicable
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinanceTab = ({ labelClass, inputClass, vendorForm, handleChange }) => {
  const card = "bg-[#fcfcfc] border border-[#e7e7e7] rounded-lg p-4 shadow-sm";
  const cardTitle =
    "text-[14px] font-semibold text-gray-800 mb-3 pb-2 border-b border-[#ededed]";
  const row =
    "grid grid-cols-12 items-center gap-3 py-2 border-b border-[#ececec] last:border-b-0";
  const leftLabel = "col-span-4";
  const rightField = "col-span-8";
  const regGrid = "grid grid-cols-12 gap-2";
  const regNo = "col-span-7";
  const dated = "col-span-5";

  return (
    <div className="text-[13px] space-y-6">
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT PANEL - Registration Details */}
        <div className="col-span-12 lg:col-span-7">
          <div className={card}>
            <h3 className={cardTitle}>Registration Numbers</h3>

            {/* PAN */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>PAN No.*</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Enter PAN"
                  value={vendorForm.pan || ""}
                  onChange={handleChange("pan")}
                />
              </div>
            </div>

            {/* CIN */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>CIN No</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Enter CIN"
                  value={vendorForm.cin || ""}
                  onChange={handleChange("cin")}
                />
              </div>
            </div>

            {/* GST Category */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>GST Category*</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.gstCategory || ""}
                  onChange={handleChange("gstCategory")}
                >
                  <option value="">Select</option>
                  <option>Normal Registered</option>
                  <option>Composition</option>
                  <option>Unregistered</option>
                </select>
              </div>
            </div>

            {/* GSTIN */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>GST Identification No.</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Enter GSTIN"
                  value={vendorForm.gstin || ""}
                  onChange={handleChange("gstin")}
                />
              </div>
            </div>

            {/* GST State */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>GST State</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.gstState || ""}
                  onChange={handleChange("gstState")}
                >
                  <option value="">Select</option>
                  <option>19 - West Bengal (WB)</option>
                  <option>27 - Maharashtra (MH)</option>
                  <option>07 - Delhi (DL)</option>
                </select>
              </div>
            </div>

            {/* Transporter ID */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Transporter ID</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Enter Transporter ID"
                  value={vendorForm.transporterId || ""}
                  onChange={handleChange("transporterId")}
                />
              </div>
            </div>

            {/* VAT No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>VAT No.</label>
              <div className={rightField}>
                <div className={regGrid}>
                  <div className={regNo}>
                    <input
                      className={inputClass}
                      placeholder="Registration No."
                      value={vendorForm.vatNo || ""}
                      onChange={handleChange("vatNo")}
                    />
                  </div>
                  <div className={dated}>
                    <input
                      className={inputClass}
                      type="date"
                      value={vendorForm.vatDate || ""}
                      onChange={handleChange("vatDate")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CST No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>CST No.</label>
              <div className={rightField}>
                <div className={regGrid}>
                  <div className={regNo}>
                    <input
                      className={inputClass}
                      placeholder="Registration No."
                      value={vendorForm.cstNo || ""}
                      onChange={handleChange("cstNo")}
                    />
                  </div>
                  <div className={dated}>
                    <input
                      className={inputClass}
                      type="date"
                      value={vendorForm.cstDate || ""}
                      onChange={handleChange("cstDate")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Excise No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Excise No.</label>
              <div className={rightField}>
                <div className={regGrid}>
                  <div className={regNo}>
                    <input
                      className={inputClass}
                      placeholder="Registration No."
                      value={vendorForm.exciseNo || ""}
                      onChange={handleChange("exciseNo")}
                    />
                  </div>
                  <div className={dated}>
                    <input
                      className={inputClass}
                      type="date"
                      value={vendorForm.exciseDate || ""}
                      onChange={handleChange("exciseDate")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Service Tax No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Service Tax No.</label>
              <div className={rightField}>
                <div className={regGrid}>
                  <div className={regNo}>
                    <input
                      className={inputClass}
                      placeholder="Registration No."
                      value={vendorForm.serviceTaxNo || ""}
                      onChange={handleChange("serviceTaxNo")}
                    />
                  </div>
                  <div className={dated}>
                    <input
                      className={inputClass}
                      type="date"
                      value={vendorForm.serviceTaxDate || ""}
                      onChange={handleChange("serviceTaxDate")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Service Tax Category */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Service Tax Category</label>
              <div className={rightField}>
                <select
                  className={inputClass}
                  value={vendorForm.serviceTaxCategory || ""}
                  onChange={handleChange("serviceTaxCategory")}
                >
                  <option value="">Select</option>
                  <option>Goods</option>
                  <option>Services</option>
                  <option>Both</option>
                </select>
              </div>
            </div>

            {/* SSI No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>SSI No.</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Registration No."
                  value={vendorForm.ssiNo || ""}
                  onChange={handleChange("ssiNo")}
                />
              </div>
            </div>

            {/* MSME No. */}
            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Micro & Small Estd. No.</label>
              <div className={rightField}>
                <input
                  className={inputClass}
                  placeholder="Registration No."
                  value={vendorForm.msmeNo || ""}
                  onChange={handleChange("msmeNo")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Bank Details */}
        <div className="col-span-12 lg:col-span-5">
          <div className={card}>
            <h3 className={cardTitle}>Bank Details</h3>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Bank Name</label>
                <input
                  className={inputClass}
                  placeholder="Enter Bank Name"
                  value={vendorForm.bankName || ""}
                  onChange={handleChange("bankName")}
                />
              </div>

              <div>
                <label className={labelClass}>Account No.</label>
                <input
                  className={inputClass}
                  placeholder="Enter Account Number"
                  value={vendorForm.accountNo || ""}
                  onChange={handleChange("accountNo")}
                />
              </div>

              <div>
                <label className={labelClass}>MICR Code</label>
                <input
                  className={inputClass}
                  placeholder="Enter MICR Code"
                  value={vendorForm.micr || ""}
                  onChange={handleChange("micr")}
                />
              </div>

              <div>
                <label className={labelClass}>IFSC Code</label>
                <input
                  className={inputClass}
                  placeholder="Enter IFSC Code"
                  value={vendorForm.ifsc || ""}
                  onChange={handleChange("ifsc")}
                />
              </div>

              <div>
                <label className={labelClass}>RTGS Code</label>
                <input
                  className={inputClass}
                  placeholder="Enter RTGS Code"
                  value={vendorForm.rtgs || ""}
                  onChange={handleChange("rtgs")}
                />
              </div>

              <div>
                <label className={labelClass}>Cheque Label</label>
                <input
                  className={inputClass}
                  placeholder="Enter Cheque Label"
                  value={vendorForm.chequeLabel || ""}
                  onChange={handleChange("chequeLabel")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const ProductionTab = ({ labelClass, inputClass, vendorForm, handleChange }) => {
  const card = "bg-[#fcfcfc] border border-[#e7e7e7] rounded-lg p-4 shadow-sm";
  const cardTitle =
    "text-[14px] font-semibold text-gray-800 mb-3 pb-2 border-b border-[#ededed]";
  const row =
    "grid grid-cols-12 items-center gap-3 py-2 border-b border-[#ececec] last:border-b-0";
  const leftLabel = "col-span-4";
  const rightField = "col-span-8";

  return (
    <div className="text-[13px] space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className={card}>
            <h3 className={cardTitle}>Manufacturing Settings</h3>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}></label>
              <div className={rightField}>
                <label className="flex items-center gap-2 text-gray-700">
                  <input
                    type="checkbox"
                    checked={vendorForm.allowManufacturingSelection || false}
                    onChange={(e) =>
                      handleChange("allowManufacturingSelection")({
                        target: { value: e.target.checked },
                      })
                    }
                  />
                  Allow Manufacturing Unit/Stock Point Selection
                </label>
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Maximum Overdue Days</label>
              <div className={`${rightField} max-w-[220px]`}>
                <input
                  className={inputClass}
                  type="number"
                  value={vendorForm.maxOverdueDays || ""}
                  onChange={handleChange("maxOverdueDays")}
                  placeholder="0"
                />
              </div>
            </div>

            <div className={row}>
              <label className={`${labelClass} ${leftLabel}`}>Overdue Action</label>
              <div className={`${rightField} max-w-[260px]`}>
                <select
                  className={inputClass}
                  value={vendorForm.overdueAction || ""}
                  onChange={handleChange("overdueAction")}
                >
                  <option>No Restriction</option>
                  <option>Block Transactions</option>
                  <option>Warning Only</option>
                  <option>Approval Required</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5" />
      </div>
    </div>
  );
};

