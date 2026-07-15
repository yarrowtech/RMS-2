import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import axios from "axios";

const API_BASE = `${APP_API_URL}/thirdparty`;


import React, { useState,useEffect } from 'react';
import { logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { 
  Users, Camera, Palette, UserCheck, Edit3, Search, Filter, Plus,
  Star, Phone, Mail, MapPin, Calendar, DollarSign, Briefcase,
  CheckCircle, Clock, AlertCircle, Eye, Trash2, Download,
  TrendingUp, Package, Award, Image, Video, FileText, LogOut,
  Edit, Save, X
} from 'lucide-react';

const ThirdPartyDept = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showEditVendor, setShowEditVendor] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedVendorForBooking, setSelectedVendorForBooking] = useState(null);
  
  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'makeup',
    specialty: '',
    phone: '',
    email: '',
    location: '',
    hourlyRate: '',
    experience: '',
    skills: ''
  });

  const [newBooking, setNewBooking] = useState({
    project: '',
    date: new Date().toISOString().split('T')[0],
    duration: '',
    notes: ''
  });

const [vendors, setVendors] = useState([]);
const [bookings, setBookings] = useState([]);

useEffect(() => {
  fetchVendors();
  fetchBookings();
}, []);

const fetchVendors = async () => {
  try {
    const res = await axios.get(`${API_BASE}/vendors`);
    setVendors(res.data);
  } catch (err) {
    console.error("Error fetching vendors:", err);
  }
};

const fetchBookings = async () => {
  try {
    const res = await axios.get(`${API_BASE}/bookings`);
    setBookings(res.data);
  } catch (err) {
    console.error("Error fetching bookings:", err);
  }
};

  const categories = [
    { id: 'all', label: 'All Vendors', icon: Users, count: vendors.length },
    { id: 'makeup', label: 'Makeup Artists', icon: Palette, count: vendors.filter(v => v.category === 'makeup').length },
    { id: 'photographer', label: 'Photographers', icon: Camera, count: vendors.filter(v => v.category === 'photographer').length },
    { id: 'model', label: 'Models', icon: UserCheck, count: vendors.filter(v => v.category === 'model').length },
    { id: 'editor', label: 'Editors', icon: Edit3, count: vendors.filter(v => v.category === 'editor').length }
  ];

  // Logout handler
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const getCategoryIcon = (category) => {
    const icons = {
      makeup: Palette,
      photographer: Camera,
      model: UserCheck,
      editor: Edit3
    };
    return icons[category] || Users;
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-800 border-green-200',
      busy: 'bg-orange-100 text-orange-800 border-orange-200',
      offline: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || colors.offline;
  };

  const getBookingStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-purple-100 text-purple-800 border-purple-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors.pending;
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesCategory = activeCategory === 'all' || vendor.category === activeCategory;
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

 
   const handleAddVendor = async () => {
  if (!newVendor.name || !newVendor.specialty || !newVendor.email || !newVendor.hourlyRate) {
    alert('Please fill in all required fields');
    return;
  }

  try {
    const res = await axios.post(`${API_BASE}/vendors`, {
      ...newVendor,
      hourlyRate: parseFloat(newVendor.hourlyRate),
      skills: newVendor.skills.split(',').map(s => s.trim()).filter(Boolean),
      joinDate: new Date().toISOString().split('T')[0],
    });

    setVendors([...vendors, res.data]);
    setShowAddVendor(false);
    setNewVendor({
      name: '',
      category: 'makeup',
      specialty: '',
      phone: '',
      email: '',
      location: '',
      hourlyRate: '',
      experience: '',
      skills: ''
    });
  } catch (err) {
    console.error("Error adding vendor:", err);
    alert("Failed to add vendor");
  }
};
  

const handleUpdateVendor = async () => {
  if (!editingVendor) return;

  try {
    const updatedVendor = {
      ...newVendor,
      hourlyRate: parseFloat(newVendor.hourlyRate),
      skills: newVendor.skills.split(',').map(s => s.trim()).filter(Boolean),
    };

    await axios.put(`${API_BASE}/vendors/${editingVendor._id}`, updatedVendor);
    setVendors(vendors.map(v => v._id === editingVendor._id ? { ...v, ...updatedVendor } : v));
    setShowEditVendor(false);
    setEditingVendor(null);
  } catch (err) {
    console.error("Error updating vendor:", err);
    alert("Failed to update vendor");
  }
};



 const handleDeleteVendor = async (vendorId) => {
  if (!window.confirm("Are you sure you want to delete this vendor?")) return;
  try {
    await axios.delete(`${API_BASE}/vendors/${vendorId}`);
    setVendors(vendors.filter(v => v._id !== vendorId));
    setBookings(bookings.filter(b => b.vendorId !== vendorId));
  } catch (err) {
    console.error("Error deleting vendor:", err);
    alert("Failed to delete vendor");
  }
};


  // Add booking
const handleAddBooking = async () => {
  if (!newBooking.project || !newBooking.date || !newBooking.duration) {
    alert("Please fill in all required fields");
    return;
  }

  const vendor = vendors.find(v => v._id === selectedVendorForBooking);
  if (!vendor) return;

  const durationHours = parseFloat(newBooking.duration);
  if (isNaN(durationHours)) {
    alert("Duration must be a number");
    return;
  }

  const rate = vendor.hourlyRate * durationHours;

  const bookingData = {
    vendorId: String(vendor._id),                                      
    vendorName: vendor.name,
    category: vendor.category,
    project: newBooking.project,
    date: newBooking.date,
    duration: `${durationHours} hours`,     
    rate: parseFloat(rate.toFixed(2)),      
    status: "pending",
    notes: newBooking.notes || "",          
  };

  try {
    const res = await axios.post(`${API_BASE}/bookings`, bookingData, {
      headers: { "Content-Type": "application/json" },
    });
    setBookings([...bookings, res.data]);
    setShowBookingModal(false);
    setSelectedVendorForBooking(null);
    setNewBooking({
      project: "",
      date: new Date().toISOString().split("T")[0],
      duration: "",
      notes: "",
    });
  } catch (err) {
    console.error("Error creating booking:", err.response?.data || err.message);
    alert("Failed to create booking");
  }
};


  // Delete booking
 const handleDeleteBooking = async (bookingId) => {
  if (!window.confirm("Are you sure you want to delete this booking?")) return;
  try {
    await axios.delete(`${API_BASE}/bookings/${bookingId}`);
    setBookings(bookings.filter(b => b._id !== bookingId));
  } catch (err) {
    console.error("Error deleting booking:", err);
    alert("Failed to delete booking");
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header with Banner */}
      <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="bg-cyan-600 px-8 py-4 font-black text-xl relative shadow-md">
                THIRD PARTY
                <div className="absolute right-0 top-0 bottom-0 w-10 bg-cyan-600" 
                     style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}></div>
              </div>
              <div className="flex-1">
                <p className="text-base font-bold uppercase tracking-wide">
                  (VENDOR, MAKEUP ARTIST, PHOTOGRAPHY, MODEL, EDITOR)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-red-500/20 hover:bg-red-500/30 border-2 border-red-300 text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-700">Total Vendors</h4>
            </div>
            <p className="text-3xl font-black text-gray-900">{vendors.length}</p>
            <p className="text-sm text-green-600 mt-1">↑ 12% this month</p>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-700">Active Bookings</h4>
            </div>
            <p className="text-3xl font-black text-gray-900">{bookings.length}</p>
            <p className="text-sm text-gray-600 mt-1">3 this week</p>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-700">Top Rated</h4>
            </div>
            <p className="text-3xl font-black text-gray-900">4.8★</p>
            <p className="text-sm text-gray-600 mt-1">Average rating</p>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-100 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <h4 className="font-semibold text-gray-700">Total Spent</h4>
            </div>
            <p className="text-3xl font-black text-gray-900">₹{bookings.reduce((sum, b) => sum + b.rate, 0).toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-1">This month</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-gray-900">Vendor Directory</h2>
            <button 
              onClick={() => setShowAddVendor(true)}
              className="bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-3"
            >
              <Plus className="h-6 w-6" />
              Add Vendor
            </button>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            {categories.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold text-base transition-all transform hover:scale-105 ${
                    isActive
                      ? 'bg-cyan-500 text-white shadow-xl shadow-cyan-500/30 scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-cyan-300'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span>{cat.label}</span>
                  <span className={`text-sm font-black px-3 py-1 rounded-full ${
                    isActive ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {filteredVendors.map(vendor => {
            const CategoryIcon = getCategoryIcon(vendor.category);
            return (
              <div 
                key={vendor.id} 
                className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-2xl hover:border-cyan-400 transition-all transform hover:-translate-y-1"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <img 
                        src={vendor.avatar} 
                        alt={vendor.name}
                        className="w-20 h-20 rounded-full border-4 border-white shadow-xl"
                      />
                      <div>
                        <h3 className="font-black text-white text-xl">{vendor.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <Star className="h-5 w-5 fill-yellow-300 text-yellow-300" />
                          <span className="text-white font-bold text-base">{vendor.rating}</span>
                          <span className="text-cyan-100 text-sm">({vendor.reviews})</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${getStatusColor(vendor.status)}`}>
                      {vendor.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4 bg-cyan-50 p-3 rounded-xl">
                    <CategoryIcon className="h-6 w-6 text-cyan-600" />
                    <span className="font-bold text-gray-900 text-base">{vendor.specialty}</span>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-3 text-base text-gray-700">
                      <MapPin className="h-5 w-5 text-cyan-600" />
                      <span className="font-medium">{vendor.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-base text-gray-700">
                      <Briefcase className="h-5 w-5 text-cyan-600" />
                      <span className="font-medium">{vendor.experience} experience</span>
                    </div>
                    <div className="flex items-center gap-3 text-base text-gray-700">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-bold text-green-600">₹{vendor.hourlyRate}/hour</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {vendor.skills.map((skill, idx) => (
                      <span key={idx} className="bg-cyan-100 text-cyan-700 text-sm px-3 py-2 rounded-lg font-semibold border border-cyan-200">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 font-medium mb-1">Completed Jobs</p>
                      <p className="text-2xl font-black text-gray-900">{vendor.completedJobs}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 font-medium mb-1">Portfolio Items</p>
                      <p className="text-2xl font-black text-gray-900">{vendor.portfolio}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      className="col-span-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white px-6 py-4 rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVendorForBooking(vendor.id);
                        setShowBookingModal(true);
                      }}
                    >
                      <Calendar className="h-5 w-5" />
                      Book Now
                    </button>
                    <button 
                      className="px-4 py-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 font-semibold text-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditVendor(vendor);
                      }}
                    >
                      <Edit className="h-5 w-5" />
                      <span className="text-sm">Edit</span>
                    </button>
                    <button 
                      className="px-4 py-3 bg-blue-50 border-2 border-blue-300 rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2 font-semibold text-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`mailto:${vendor.email}`);
                      }}
                    >
                      <Mail className="h-5 w-5" />
                      <span className="text-sm">Email</span>
                    </button>
                    <button 
                      className="px-4 py-3 bg-red-50 border-2 border-red-300 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 font-semibold text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVendor(vendor.id);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                      <span className="text-sm">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Bookings Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900">Active Bookings</h2>
            <button className="text-cyan-600 hover:text-cyan-700 font-medium text-sm">View All</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Vendor</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Project</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Rate</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(booking => {
                  const CategoryIcon = getCategoryIcon(booking.category);
                  return (
                    <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
                            <CategoryIcon className="h-4 w-4 text-cyan-600" />
                          </div>
                          <span className="font-medium text-gray-900">{booking.vendorName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 capitalize">{booking.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-900">{booking.project}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{booking.date}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{booking.duration}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">₹{booking.rate}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getBookingStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Confirm Logout</h2>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600">Are you sure you want to logout? Any unsaved changes will be lost.</p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Booking Modal */}
{showBookingModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
      
      {/* Modal Header */}
      <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-white p-6 flex items-center justify-between">
        <h2 className="text-2xl font-black">Create New Booking</h2>
        <button
          onClick={() => {
            setShowBookingModal(false);
            setSelectedVendorForBooking(null);
          }}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Scrollable Modal Body */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="space-y-6">
          {/* Vendor Info */}
          <div className="bg-cyan-50 p-4 rounded-xl">
            <p className="text-sm font-bold text-gray-700 mb-1">Booking for:</p>
            <p className="text-xl font-black text-gray-900">
              {vendors.find(v => v.id === selectedVendorForBooking)?.name}
            </p>
            <p className="text-sm text-gray-600">
              ₹{vendors.find(v => v.id === selectedVendorForBooking)?.hourlyRate}/hour
            </p>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newBooking.project}
              onChange={(e) => setNewBooking({ ...newBooking, project: e.target.value })}
              placeholder="e.g., Spring Fashion Shoot"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
            />
          </div>

          {/* Date and Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newBooking.date}
                onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                Duration (hours) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newBooking.duration}
                onChange={(e) => setNewBooking({ ...newBooking, duration: e.target.value })}
                placeholder="e.g., 4"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
              />
            </div>
          </div>

          {/* Estimated Cost */}
          {newBooking.duration && (
            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
              <p className="text-sm font-bold text-gray-700 mb-1">Estimated Cost:</p>
              <p className="text-2xl font-black text-green-600">
                ₹{(vendors.find(v => v.id === selectedVendorForBooking)?.hourlyRate * parseFloat(newBooking.duration)).toLocaleString()}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Additional Notes
            </label>
            <textarea
              value={newBooking.notes}
              onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
              placeholder="Any special requirements or notes..."
              rows="4"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base resize-none"
            />
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex flex-col sm:flex-row gap-4 p-6 border-t border-gray-200 bg-white sticky bottom-0">
        <button
          onClick={() => {
            setShowBookingModal(false);
            setSelectedVendorForBooking(null);
          }}
          className="w-full sm:flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-base transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleAddBooking}
          className="w-full sm:flex-1 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white px-6 py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Confirm Booking
        </button>
      </div>
    </div>
  </div>
)}


      {/* Add Vendor Modal */}
      {showAddVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-white p-6 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Add New Vendor</h2>
                <button
                  onClick={() => setShowAddVendor(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Vendor Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'makeup', label: 'Makeup Artist', icon: Palette },
                      { id: 'photographer', label: 'Photographer', icon: Camera },
                      { id: 'model', label: 'Model', icon: UserCheck },
                      { id: 'editor', label: 'Editor', icon: Edit3 }
                    ].map(cat => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewVendor({ ...newVendor, category: cat.id })}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            newVendor.category === cat.id
                              ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-300'
                          }`}
                        >
                          <Icon className="h-8 w-8" />
                          <span className="text-sm font-semibold text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVendor.name}
                      onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Specialty <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVendor.specialty}
                      onChange={(e) => setNewVendor({ ...newVendor, specialty: e.target.value })}
                      placeholder="e.g., Bridal Makeup, Fashion Photography"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newVendor.email}
                      onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={newVendor.phone}
                      onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                      placeholder="+1 234-567-8900"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Location and Experience */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newVendor.location}
                      onChange={(e) => setNewVendor({ ...newVendor, location: e.target.value })}
                      placeholder="City, State"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Years of Experience
                    </label>
                    <input
                      type="text"
                      value={newVendor.experience}
                      onChange={(e) => setNewVendor({ ...newVendor, experience: e.target.value })}
                      placeholder="e.g., 5 years"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Hourly Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newVendor.hourlyRate}
                    onChange={(e) => setNewVendor({ ...newVendor, hourlyRate: e.target.value })}
                    placeholder="150"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newVendor.skills}
                    onChange={(e) => setNewVendor({ ...newVendor, skills: e.target.value })}
                    placeholder="e.g., Bridal, Editorial, Special Effects"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                  />
                  <p className="text-sm text-gray-600 mt-2">Separate multiple skills with commas</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowAddVendor(false)}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-base transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVendor}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white px-6 py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  Add Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {showEditVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-white p-6 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Edit Vendor</h2>
                <button
                  onClick={() => {
                    setShowEditVendor(false);
                    setEditingVendor(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Vendor Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'makeup', label: 'Makeup Artist', icon: Palette },
                      { id: 'photographer', label: 'Photographer', icon: Camera },
                      { id: 'model', label: 'Model', icon: UserCheck },
                      { id: 'editor', label: 'Editor', icon: Edit3 }
                    ].map(cat => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewVendor({ ...newVendor, category: cat.id })}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            newVendor.category === cat.id
                              ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-cyan-300'
                          }`}
                        >
                          <Icon className="h-8 w-8" />
                          <span className="text-sm font-semibold text-center">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVendor.name}
                      onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Specialty <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newVendor.specialty}
                      onChange={(e) => setNewVendor({ ...newVendor, specialty: e.target.value })}
                      placeholder="e.g., Bridal Makeup, Fashion Photography"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newVendor.email}
                      onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={newVendor.phone}
                      onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                      placeholder="+1 234-567-8900"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Location and Experience */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={newVendor.location}
                      onChange={(e) => setNewVendor({ ...newVendor, location: e.target.value })}
                      placeholder="City, State"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Years of Experience
                    </label>
                    <input
                      type="text"
                      value={newVendor.experience}
                      onChange={(e) => setNewVendor({ ...newVendor, experience: e.target.value })}
                      placeholder="e.g., 5 years"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                    />
                  </div>
                </div>

                {/* Hourly Rate */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Hourly Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newVendor.hourlyRate}
                    onChange={(e) => setNewVendor({ ...newVendor, hourlyRate: e.target.value })}
                    placeholder="150"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newVendor.skills}
                    onChange={(e) => setNewVendor({ ...newVendor, skills: e.target.value })}
                    placeholder="e.g., Bridal, Editorial, Special Effects"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-base"
                  />
                  <p className="text-sm text-gray-600 mt-2">Separate multiple skills with commas</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditVendor(false);
                    setEditingVendor(null);
                  }}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-bold text-base transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateVendor}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-600 hover:to-cyan-500 text-white px-6 py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Save className="h-5 w-5" />
                  Update Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThirdPartyDept;