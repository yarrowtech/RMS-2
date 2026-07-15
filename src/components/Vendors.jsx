import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Edit,
  Building,
  Search,
  RefreshCcw,
  Ban,
} from "lucide-react";

const Vendors = () => {
  const API_BASE_URL = `${APP_API_URL}`;
  const [pendingVendors, setPendingVendors] = useState([]);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchPending, setSearchPending] = useState("");
  const [searchApproved, setSearchApproved] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [pendingRes, approvedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vendors/pending`),
        fetch(`${API_BASE_URL}/api/vendors/approved`),
      ]);

      if (!pendingRes.ok) {
        console.error("Failed to fetch pending vendors");
        setPendingVendors([]);
      } else {
        const pendingData = await pendingRes.json();
        setPendingVendors(Array.isArray(pendingData) ? pendingData : []);
      }

      if (!approvedRes.ok) {
        console.error("Failed to fetch approved vendors");
        setApprovedVendors([]);
      } else {
        const approvedData = await approvedRes.json();
        setApprovedVendors(Array.isArray(approvedData) ? approvedData : []);
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
      setPendingVendors([]);
      setApprovedVendors([]);
    } finally {
      setLoading(false);
    }
  }
const currentUser = JSON.parse(localStorage.getItem("user")); 
// or however you store the merchandiser_buyer login info

  async function handleApproval(id) {
  try {
    const token = localStorage.getItem("token"); // your stored JWT
    const currentUser = JSON.parse(localStorage.getItem("user"));

    const res = await fetch(`${API_BASE_URL}/api/vendors/approve/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // ✅ required
      },
      body: JSON.stringify({
        product_type: selectedVendor?.product_type || "Footwear",
      }),
    });

    if (!res.ok) throw new Error("Approval failed");
    const data = await res.json();

    alert(`✅ Vendor Approved! ${data.message}`);
    setSelectedVendor(null);
    fetchAll();
  } catch (err) {
    console.error(err);
    alert("Error approving vendor");
  }
}



  async function handleReject(id) {
    if (!window.confirm("Reject this vendor?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/vendors/reject/${id}`, {
        method: "POST",
      });
      alert("Vendor rejected successfully.");
      setSelectedVendor(null);
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Error rejecting vendor");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/delete/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      alert("Vendor deleted successfully");
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Error deleting vendor");
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm("Deactivate this vendor profile?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/deactivate/${id}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Deactivation failed");
      alert("Vendor deactivated successfully");
      fetchAll();
    } catch (err) {
      console.error(err);
      alert("Error deactivating vendor");
    }
  }

  const filteredPending = Array.isArray(pendingVendors)
    ? pendingVendors.filter((v) =>
        [v.name, v.brandName, v.contactMobile, v.email]
          .join(" ")
          .toLowerCase()
          .includes(searchPending.toLowerCase())
      )
    : [];

  const filteredApproved = Array.isArray(approvedVendors)
    ? approvedVendors.filter((v) =>
        [v.vendorId, v.name, v.brandName, v.contactMobile, v.email]
          .join(" ")
          .toLowerCase()
          .includes(searchApproved.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-8 space-y-16">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building className="h-7 w-7 text-purple-700" />
          <h1 className="text-3xl font-bold text-gray-800">
            Vendor Management
          </h1>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-all"
        >
          <RefreshCcw size={18} />
          Refresh
        </button>
      </div>

      {/* PENDING VENDORS */}
      <SectionHeader
        title="Pending Vendor Approvals"
        color="from-purple-600 to-indigo-600"
      />
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        <SearchBar
          value={searchPending}
          onChange={setSearchPending}
          placeholder="Search pending vendors..."
        />
        <VendorTable
          data={filteredPending}
          loading={loading}
          emptyText="No pending vendors."
          onView={setSelectedVendor}
          onDelete={handleDelete}
        />
      </div>

      {/* APPROVED VENDORS */}
      <SectionHeader
        title="Approved Vendors List"
        color="from-green-600 to-emerald-600"
      />
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        <SearchBar
          value={searchApproved}
          onChange={setSearchApproved}
          placeholder="Search approved vendors..."
        />
        <ApprovedTable
          data={filteredApproved}
          loading={loading}
          emptyText="No approved vendors found."
          onEdit={setEditVendor}
          onDeactivate={handleDeactivate}
        />
      </div>

      {/* MODALS */}
      {selectedVendor && (
        <VendorModal
  vendor={selectedVendor}
  onClose={() => setSelectedVendor(null)}
  onApprove={() => handleApproval(selectedVendor._id)}
  onReject={() => handleReject(selectedVendor._id)}
/>

      )}

      {editVendor && (
        <EditVendorModal
          vendor={editVendor}
          onClose={() => setEditVendor(null)}
          onSave={() => {
            alert("Vendor profile updated successfully!");
            setEditVendor(null);
            fetchAll();
          }}
        />
      )}
    </div>
  );
};

/* ------------------- COMPONENTS ------------------- */

const SectionHeader = ({ title, color }) => (
  <div
    className={`bg-gradient-to-r ${color} text-white text-sm px-4 py-3 font-semibold rounded-t-md shadow`}
  >
    {title}
  </div>
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
    <Search size={18} className="text-gray-500" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-none bg-transparent outline-none text-sm"
    />
  </div>
);

const VendorTable = ({ data, loading, emptyText, onView, onDelete }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-100 border-b">
        <tr>
          <th className="px-4 py-2 text-left">Vendor Name</th>
          <th className="px-4 py-2 text-left">Brand Name</th>
          <th className="px-4 py-2 text-left">Contact Number</th>
          <th className="px-4 py-2 text-left">Email</th>
          <th className="px-4 py-2 text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={5} className="text-center py-6 text-gray-500">
              Loading...
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={5} className="text-center py-6 text-gray-500">
              {emptyText}
            </td>
          </tr>
        ) : (
          data.map((v) => (
            <tr key={v._id} className="border-b hover:bg-gray-50 transition-all">
              <td className="px-4 py-2">{v.name}</td>
              <td className="px-4 py-2">{v.brandName}</td>
              <td className="px-4 py-2">{v.contactMobile}</td>
              <td className="px-4 py-2">{v.email}</td>
              <td className="px-4 py-2 text-center flex justify-center gap-3">
                <button
                  onClick={() => onView(v)}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <Eye size={16} /> Review
                </button>
                <button
                  onClick={() => onDelete(v._id)}
                  className="flex items-center gap-1 text-red-600 hover:text-red-800"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const ApprovedTable = ({ data, loading, emptyText, onEdit, onDeactivate }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-100 border-b">
        <tr>
          <th className="px-4 py-2 text-left">Vendor ID</th>
          <th className="px-4 py-2 text-left">Vendor Name</th>
          <th className="px-4 py-2 text-left">Brand Name</th>
          <th className="px-4 py-2 text-left">Contact Number</th>
          <th className="px-4 py-2 text-left">Email</th>
          <th className="px-4 py-2 text-center">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={6} className="text-center py-6 text-gray-500">
              Loading...
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center py-6 text-gray-500">
              {emptyText}
            </td>
          </tr>
        ) : (
          data.map((v) => (
            <tr key={v._id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 text-purple-700 font-semibold">
  {v._id || "-"}
</td>

              <td className="px-4 py-2">{v.name}</td>
              <td className="px-4 py-2">{v.brandName}</td>
              <td className="px-4 py-2">{v.contactMobile}</td>
              <td className="px-4 py-2">{v.email}</td>
              <td className="px-4 py-2 text-center flex justify-center gap-3">
                <button
                  onClick={() => onEdit(v)}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  <Edit size={16} /> Edit
                </button>
                <button
                  onClick={() => onDeactivate(v._id)}
                  className="flex items-center gap-1 text-red-600 hover:text-red-800"
                >
                  <Ban size={16} /> Deactivate
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const VendorModal = ({ vendor, onClose, onApprove, onReject }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 hover:text-black"
      >
        ✕
      </button>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Review Vendor Details
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {Object.entries(vendor).map(([key, val]) => (
          <Info
            key={key}
            label={key.replace(/([A-Z])/g, " $1").toUpperCase()}
            value={val}
          />
        ))}
      </div>
      <div className="mt-8 flex justify-center gap-6">
        <button
          onClick={onApprove}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium"
        >
          <CheckCircle size={18} /> Approve
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium"
        >
          <XCircle size={18} /> Reject
        </button>
      </div>
    </div>
  </div>
);

const EditVendorModal = ({ vendor, onClose, onSave }) => {
  const [form, setForm] = useState(vendor);

  const handleChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black"
        >
          ✕
        </button>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Edit Vendor Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <LabeledInput
            label="Vendor Name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          <LabeledInput
            label="Brand Name"
            value={form.brandName}
            onChange={(e) => handleChange("brandName", e.target.value)}
          />
          <LabeledInput
            label="Contact Number"
            value={form.contactMobile}
            onChange={(e) => handleChange("contactMobile", e.target.value)}
          />
          <LabeledInput
            label="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>
        <div className="mt-8 flex justify-center gap-6">
          <button
            onClick={onSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
    <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
    <p className="text-gray-800 font-semibold mt-1">{value || "-"}</p>
  </div>
);

const LabeledInput = ({ label, value, onChange }) => (
  <div>
    <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
    <input
      type="text"
      value={value}
      onChange={onChange}
      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-purple-400"
    />
  </div>
);

export default Vendors;
