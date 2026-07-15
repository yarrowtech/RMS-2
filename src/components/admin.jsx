import React, { useState, useEffect } from 'react';
import { logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Bell, Users, TrendingUp, Package, AlertTriangle, DollarSign, Activity,
  ShoppingCart, Star, ArrowUp, ArrowDown, User, LogOut, Settings, ChevronDown,
  Building2, Timer, Clock, RefreshCw, Menu, Download, Plus, ArrowUpRight,
  ArrowDownRight, Cpu, UserPlus, X, Check, Eye, EyeOff
} from 'lucide-react';

export const AdminRMS = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animatedValues, setAnimatedValues] = useState({});
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    activeUsers: 147,
    systemLoad: 28.4,
    networkLatency: 19,
    uptime: 99.94
  });

  // Sub-Admin Management State
  const [showSubAdminModal, setShowSubAdminModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [subAdmins, setSubAdmins] = useState([
    { id: 1, name: 'Sarah Johnson', email: 'sarah.j@company.com', role: 'Store Manager', permissions: ['sales', 'inventory'], status: 'Active', createdAt: '2024-01-15' },
    { id: 2, name: 'Mike Chen', email: 'mike.c@company.com', role: 'Operations Manager', permissions: ['footfall', 'vendors'], status: 'Active', createdAt: '2024-02-20' },
  ]);
  const [subAdminForm, setSubAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Store Manager',
    permissions: [],
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const availablePermissions = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'sales', name: 'Sales Efficiency', icon: TrendingUp },
    { id: 'footfall', name: 'Footfall Analysis', icon: Users },
    { id: 'performance', name: 'Employee Performance', icon: Star },
    { id: 'alerts', name: 'Alert System', icon: Bell },
    { id: 'vendors', name: 'Vendor Management', icon: Package },
    { id: 'inventory', name: 'Inventory Analysis', icon: ShoppingCart },
    { id: 'predictions', name: 'Predictions', icon: DollarSign },
  ];

  const roleOptions = [
    'Store Manager',
    'Operations Manager',
    'Sales Manager',
    'Inventory Manager',
    'Analytics Manager'
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      [0, 1, 2, 3].forEach((index) => {
        setTimeout(() => {
          setAnimatedValues(prev => ({ ...prev, [index]: true }));
        }, index * 150);
      });
    }, 300);

    const metricsTimer = setInterval(() => {
      setRealTimeMetrics(prev => ({
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 10 - 5),
        systemLoad: Math.max(0, Math.min(100, prev.systemLoad + (Math.random() * 3 - 1.5))),
        networkLatency: Math.max(0, prev.networkLatency + Math.floor(Math.random() * 4 - 2)),
        uptime: Math.min(100, prev.uptime + (Math.random() * 0.01))
      }));
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(metricsTimer);
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.user-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  // Handle logout
  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  // Sub-Admin Form Handlers
  const handleFormChange = (field, value) => {
    setSubAdminForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const togglePermission = (permissionId) => {
    setSubAdminForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    if (!subAdminForm.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!subAdminForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subAdminForm.email)) {
      errors.email = 'Invalid email format';
    } else if (subAdmins.some(admin => admin.email === subAdminForm.email)) {
      errors.email = 'Email already exists';
    }
    
    if (!subAdminForm.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(subAdminForm.phone.replace(/[^0-9]/g, ''))) {
      errors.phone = 'Phone number must be 10 digits';
    }
    
    if (subAdminForm.permissions.length === 0) {
      errors.permissions = 'Select at least one permission';
    }
    
    if (!subAdminForm.password) {
      errors.password = 'Password is required';
    } else if (subAdminForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    if (subAdminForm.password !== subAdminForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitSubAdmin = () => {
    if (!validateForm()) {
      return;
    }

    const newSubAdmin = {
      id: subAdmins.length + 1,
      name: subAdminForm.name,
      email: subAdminForm.email,
      phone: subAdminForm.phone,
      role: subAdminForm.role,
      permissions: subAdminForm.permissions,
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setSubAdmins(prev => [...prev, newSubAdmin]);
    setShowSubAdminModal(false);
    resetForm();
    
    // Show success message (you can replace this with a toast notification)
    alert(`Sub-admin "${newSubAdmin.name}" has been successfully added!`);
  };

  const resetForm = () => {
    setSubAdminForm({
      name: '',
      email: '',
      phone: '',
      role: 'Store Manager',
      permissions: [],
      password: '',
      confirmPassword: ''
    });
    setFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCloseModal = () => {
    setShowSubAdminModal(false);
    resetForm();
  };

  // ---------------- Mock data ----------------
  const salesData = [
    { division: 'Electronics', section: 'Mobile', department: 'Smartphones', employee: 'John Doe', sales: 45000, target: 40000 },
    { division: 'Electronics', section: 'Mobile', department: 'Accessories', employee: 'Jane Smith', sales: 32000, target: 35000 },
    { division: 'Clothing', section: 'Mens', department: 'Formal', employee: 'Mike Johnson', sales: 28000, target: 30000 },
    { division: 'Clothing', section: 'Womens', department: 'Casual', employee: 'Sarah Wilson', sales: 38000, target: 35000 },
    { division: 'Home', section: 'Kitchen', department: 'Appliances', employee: 'David Brown', sales: 42000, target: 45000 },
    { division: 'Home', section: 'Furniture', department: 'Living Room', employee: 'Lisa Davis', sales: 51000, target: 48000 },
  ];

  const footfallData = [
    { hour: '9AM', customers: 45 }, { hour: '10AM', customers: 78 }, { hour: '11AM', customers: 125 },
    { hour: '12PM', customers: 180 }, { hour: '1PM', customers: 220 }, { hour: '2PM', customers: 195 },
    { hour: '3PM', customers: 240 }, { hour: '4PM', customers: 280 }, { hour: '5PM', customers: 320 },
    { hour: '6PM', customers: 290 }, { hour: '7PM', customers: 250 }, { hour: '8PM', customers: 180 },
  ];

  const employeePerformance = [
    { name: 'John Doe', daily: 1800, monthly: 45000, allTime: 580000, efficiency: 112.5 },
    { name: 'Lisa Davis', daily: 2040, monthly: 51000, allTime: 620000, efficiency: 106.25 },
    { name: 'Sarah Wilson', daily: 1520, monthly: 38000, allTime: 490000, efficiency: 108.57 },
    { name: 'David Brown', daily: 1680, monthly: 42000, allTime: 510000, efficiency: 93.33 },
    { name: 'Mike Johnson', daily: 1120, monthly: 28000, allTime: 380000, efficiency: 93.33 },
    { name: 'Jane Smith', daily: 1280, monthly: 32000, allTime: 420000, efficiency: 91.43 },
  ];

  const vendorData = [
    { name: 'TechSupply Co', reports: 0, rating: 4.8, status: 'Good' },
    { name: 'Fashion World', reports: 2, rating: 3.2, status: 'Warning' },
    { name: 'Home Essentials', reports: 0, rating: 4.5, status: 'Good' },
    { name: 'Quick Electronics', reports: 5, rating: 2.1, status: 'Bad' },
    { name: 'Style Avenue', reports: 1, rating: 3.8, status: 'Warning' },
    { name: 'Mega Appliances', reports: 3, rating: 2.8, status: 'Bad' },
  ];

  const inventoryData = [
    { product: 'iPhone 15 Cases', stock: 850, sales: 45, stockToSalesRatio: 18.9 },
    { product: 'Winter Jackets', stock: 320, sales: 12, stockToSalesRatio: 26.7 },
    { product: 'Smart TVs 55"', stock: 75, sales: 8, stockToSalesRatio: 9.4 },
    { product: 'Gaming Chairs', stock: 180, sales: 15, stockToSalesRatio: 12.0 },
    { product: 'Bluetooth Speakers', stock: 450, sales: 65, stockToSalesRatio: 6.9 },
    { product: 'Fitness Trackers', stock: 220, sales: 38, stockToSalesRatio: 5.8 },
  ];

  const profitPrediction = [
    { month: 'Jan', actual: 125000, predicted: 130000 },
    { month: 'Feb', actual: 138000, predicted: 135000 },
    { month: 'Mar', actual: 142000, predicted: 145000 },
    { month: 'Apr', actual: null, predicted: 148000 },
    { month: 'May', actual: null, predicted: 152000 },
    { month: 'Jun', actual: null, predicted: 155000 },
  ];

  const returnPrediction = [
    { category: 'Electronics', returnRate: 8.5, predictedReturns: 340 },
    { category: 'Clothing', returnRate: 15.2, predictedReturns: 456 },
    { category: 'Home', returnRate: 6.8, predictedReturns: 204 },
    { category: 'Sports', returnRate: 12.1, predictedReturns: 290 },
  ];
  // -------------- End mock data --------------
// ---- Footfall Filters ----
const [footFilter, setFootFilter] = useState({
  period: 'Today',  // Today | Yesterday | Last Week (mock label only)
  search: '',       // filter by hour label (e.g., "PM", "10AM")
  min: '',          // min customers
  max: ''           // max customers
});

// If you later fetch different datasets per period, switch here.
// For now we use the same mock for all periods.
const currentFootfall = footfallData;

const filteredFootfall = currentFootfall.filter(r => {
  if (footFilter.search.trim() &&
      !r.hour.toLowerCase().includes(footFilter.search.toLowerCase())) return false;

  const min = footFilter.min === '' ? null : Number(footFilter.min);
  const max = footFilter.max === '' ? null : Number(footFilter.max);

  if (min !== null && r.customers < min) return false;
  if (max !== null && r.customers > max) return false;

  return true;
});

// Stats based on filtered data
const totalCustomers = filteredFootfall.reduce((s, r) => s + r.customers, 0);
const avgCustomers   = filteredFootfall.length ? totalCustomers / filteredFootfall.length : 0;
const peakRow        = filteredFootfall.reduce((a, b) => (a && a.customers >= b.customers ? a : b), null);
const lowRow         = filteredFootfall.reduce((a, b) => (a && a.customers <= b.customers ? a : b), null);

// ---- Inventory Filters ----
const [invFilter, setInvFilter] = useState({
  search: '',
  risk: 'All',         // All | High | Medium | Low
  minStock: '',
  maxStock: '',
  minSales: '',
  maxSales: '',
  minRatio: ''         // Stock/Sales ratio
});

// helper: derive risk label from ratio (keeps logic in one place)
const getRiskLabel = (ratio) => {
  if (ratio > 20) return 'High';
  if (ratio > 10) return 'Medium';
  return 'Low';
};

const filteredInventory = inventoryData.filter(item => {
  // Risk filter
  if (invFilter.risk !== 'All' && getRiskLabel(item.stockToSalesRatio) !== invFilter.risk) {
    return false;
  }

  // Search by product
  if (invFilter.search.trim()) {
    const q = invFilter.search.toLowerCase();
    if (!item.product.toLowerCase().includes(q)) return false;
  }

  // Numeric filters
  const n = (v) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v));

  const minStock  = n(invFilter.minStock);
  const maxStock  = n(invFilter.maxStock);
  const minSales  = n(invFilter.minSales);
  const maxSales  = n(invFilter.maxSales);
  const minRatio  = n(invFilter.minRatio);

  if (minStock !== null && item.stock < minStock) return false;
  if (maxStock !== null && item.stock > maxStock) return false;

  if (minSales !== null && item.sales < minSales) return false;
  if (maxSales !== null && item.sales > maxSales) return false;

  if (minRatio !== null && item.stockToSalesRatio < minRatio) return false;

  return true;
});

// ---- Vendor Management Filters ----
const [vendorFilter, setVendorFilter] = useState({
  search: '',
  status: 'All',          // All | Good | Warning | Bad
  minRating: '',          // e.g., 3.5
  maxReports: ''          // e.g., 2
});

const filteredVendors = vendorData.filter(v => {
  if (vendorFilter.status !== 'All' && v.status !== vendorFilter.status) return false;

  if (vendorFilter.search.trim()) {
    const q = vendorFilter.search.toLowerCase();
    if (!v.name.toLowerCase().includes(q)) return false;
  }

  if (vendorFilter.minRating !== '' && !Number.isNaN(Number(vendorFilter.minRating))) {
    if (v.rating < Number(vendorFilter.minRating)) return false;
  }

  if (vendorFilter.maxReports !== '' && !Number.isNaN(Number(vendorFilter.maxReports))) {
    if (v.reports > Number(vendorFilter.maxReports)) return false;
  }

  return true;
});

// ---- Employee Performance Filters ----
const [empFilter, setEmpFilter] = useState({
  search: '',
  minEfficiency: ''
});

// compute filtered employees
const filteredEmployees = employeePerformance.filter(emp => {
  if (empFilter.search.trim()) {
    const q = empFilter.search.toLowerCase();
    if (!emp.name.toLowerCase().includes(q)) return false;
  }

  if (empFilter.minEfficiency !== '' && !Number.isNaN(Number(empFilter.minEfficiency))) {
    if (emp.efficiency < Number(empFilter.minEfficiency)) return false;
  }

  return true;
});

  // ---- Sales Efficiency Filters (now AFTER salesData) ----
  const [salesFilter, setSalesFilter] = useState({
    division: 'All',
    section: 'All',
    department: 'All',
    employee: 'All',
    search: '',
    minPerf: ''
  });

  // Cascading options based on current selections
  const allDivisions = ['All', ...new Set(salesData.map(d => d.division))];

  const sectionsForDivision = (division) => {
    const rows = division === 'All' ? salesData : salesData.filter(d => d.division === division);
    return ['All', ...new Set(rows.map(d => d.section))];
  };

  const departmentsFor = (division, section) => {
    let rows = salesData;
    if (division !== 'All') rows = rows.filter(d => d.division === division);
    if (section !== 'All') rows = rows.filter(d => d.section === section);
    return ['All', ...new Set(rows.map(d => d.department))];
  };

  const employeesFor = (division, section, department) => {
    let rows = salesData;
    if (division !== 'All') rows = rows.filter(d => d.division === division);
    if (section !== 'All') rows = rows.filter(d => d.section === section);
    if (department !== 'All') rows = rows.filter(d => d.department === department);
    return ['All', ...new Set(rows.map(d => d.employee))];
  };

  // Filtered rows + chart aggregates
  const filteredSales = salesData.filter(r => {
    if (salesFilter.division !== 'All' && r.division !== salesFilter.division) return false;
    if (salesFilter.section !== 'All' && r.section !== salesFilter.section) return false;
    if (salesFilter.department !== 'All' && r.department !== salesFilter.department) return false;
    if (salesFilter.employee !== 'All' && r.employee !== salesFilter.employee) return false;

    if (salesFilter.search.trim()) {
      const q = salesFilter.search.trim().toLowerCase();
      const hay = `${r.division} ${r.section} ${r.department} ${r.employee}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (salesFilter.minPerf !== '' && !Number.isNaN(Number(salesFilter.minPerf))) {
      const perf = (r.sales / r.target) * 100;
      if (perf < Number(salesFilter.minPerf)) return false;
    }

    return true;
  });

  const salesByDepartment = filteredSales.reduce((acc, curr) => {
    const found = acc.find(x => x.department === curr.department);
    if (found) found.sales += curr.sales;
    else acc.push({ department: curr.department, sales: curr.sales });
    return acc;
  }, []);

  const targetVsAchievement = filteredSales;

  useEffect(() => {
    // Alerts
    const newAlerts = employeePerformance
      .filter(emp => emp.efficiency < 95)
      .map(emp => ({
        id: Math.random(),
        type: 'employee',
        message: `${emp.name} is underperforming (${emp.efficiency.toFixed(1)}% efficiency)`,
        severity: emp.efficiency < 90 ? 'high' : 'medium'
      }));

    const vendorAlerts = vendorData
      .filter(vendor => vendor.status === 'Bad')
      .map(vendor => ({
        id: Math.random(),
        type: 'vendor',
        message: `Vendor "${vendor.name}" has ${vendor.reports} reports against them`,
        severity: 'high'
      }));

    const inventoryAlerts = inventoryData
      .filter(item => item.stockToSalesRatio > 15)
      .map(item => ({
        id: Math.random(),
        type: 'inventory',
        message: `High stock, low sales: ${item.product} (Ratio: ${item.stockToSalesRatio})`,
        severity: 'medium'
      }));

    setAlerts([...newAlerts, ...vendorAlerts, ...inventoryAlerts]);
  }, []);


  const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity, gradient: 'from-blue-500 to-purple-600' },
    { id: 'sales', name: 'Sales Efficiency', icon: TrendingUp, gradient: 'from-green-500 to-emerald-600' },
    { id: 'footfall', name: 'Footfall Analysis', icon: Users, gradient: 'from-cyan-500 to-teal-600' },
    { id: 'performance', name: 'Employee Performance', icon: Star, gradient: 'from-amber-500 to-orange-600' },
    { id: 'alerts', name: 'Alert System', icon: Bell, gradient: 'from-red-500 to-pink-600' },
    { id: 'vendors', name: 'Vendor Management', icon: Package, gradient: 'from-indigo-500 to-purple-600' },
    { id: 'inventory', name: 'Inventory Analysis', icon: ShoppingCart, gradient: 'from-violet-500 to-purple-600' },
    { id: 'predictions', name: 'Predictions', icon: DollarSign, gradient: 'from-emerald-500 to-teal-600' },
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-400 to-blue-600',
      green: 'from-green-400 to-green-600',
      purple: 'from-purple-400 to-purple-600',
      amber: 'from-amber-400 to-amber-600',
      emerald: 'from-emerald-400 to-emerald-600',
      cyan: 'from-cyan-400 to-cyan-600',
      red: 'from-red-400 to-red-600'
    };
    return colors[color] || 'from-gray-400 to-gray-600';
  };

  const EnhancedMetricCard = ({ title, value, subtitle, icon: IconComponent, trend, index, color = 'blue' }) => {
    const isAnimated = animatedValues[index];
    return (
      <div
        className={`group relative bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-700 hover:border-gray-300 hover:-translate-y-1 overflow-hidden ${
          isAnimated ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' : 'opacity-0'
        }`}
        style={{ animationDelay: `${index * 150}ms` }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${getColorClasses(color)} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className={`p-4 rounded-xl bg-gradient-to-br ${getColorClasses(color)} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            {trend && (
              <div className={`flex items-center text-sm font-bold px-3 py-1 rounded-full ${
                trend.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {trend.startsWith('+') ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {trend}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
            <p className="text-sm text-gray-600 font-medium">{subtitle}</p>
          </div>

          <div className="mt-6 relative">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getColorClasses(color)} transition-all duration-1500 ease-out rounded-full relative`}
                style={{ width: isAnimated ? '85%' : '0%', boxShadow: isAnimated ? `0 0 20px rgba(59, 130, 246, 0.3)` : 'none' }}
              >
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
              <span>Performance</span>
              <span>85%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sub-Admin Modal Component
  const SubAdminModal = () => (
    <>
      {showSubAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-6 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Add New Sub-Admin</h2>
                  <p className="text-sm text-blue-100 mt-1">Create a new sub-administrator account</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8">
              {/* Personal Information Section */}
              <div className="mb-8">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subAdminForm.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="Enter full name"
                      className={`w-full px-4 py-3 bg-gray-50 border-2 ${
                        formErrors.name ? 'border-red-500' : 'border-gray-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                    />
                    {formErrors.name && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={subAdminForm.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="admin@company.com"
                      className={`w-full px-4 py-3 bg-gray-50 border-2 ${
                        formErrors.email ? 'border-red-500' : 'border-gray-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                    />
                    {formErrors.email && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={subAdminForm.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      placeholder="1234567890"
                      className={`w-full px-4 py-3 bg-gray-50 border-2 ${
                        formErrors.phone ? 'border-red-500' : 'border-gray-200'
                      } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                    />
                    {formErrors.phone && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.phone}</p>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={subAdminForm.role}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      {roleOptions.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="mb-8">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-600" />
                  Module Permissions <span className="text-red-500 ml-1">*</span>
                </h3>
                {formErrors.permissions && (
                  <p className="text-red-500 text-sm mb-3 font-medium">{formErrors.permissions}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {availablePermissions.map(permission => {
                    const Icon = permission.icon;
                    const isSelected = subAdminForm.permissions.includes(permission.id);
                    return (
                      <button
                        key={permission.id}
                        onClick={() => togglePermission(permission.id)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white shadow-lg scale-105'
                            : 'bg-white border-gray-200 hover:border-blue-300 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="w-5 h-5" />
                          {isSelected && <Check className="w-5 h-5" />}
                        </div>
                        <p className="text-sm font-bold text-left">{permission.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security Section */}
              <div className="mb-8">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-600" />
                  Security Credentials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Password */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={subAdminForm.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        placeholder="Minimum 8 characters"
                        className={`w-full px-4 py-3 pr-12 bg-gray-50 border-2 ${
                          formErrors.password ? 'border-red-500' : 'border-gray-200'
                        } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formErrors.password && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={subAdminForm.confirmPassword}
                        onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                        placeholder="Re-enter password"
                        className={`w-full px-4 py-3 pr-12 bg-gray-50 border-2 ${
                          formErrors.confirmPassword ? 'border-red-500' : 'border-gray-200'
                        } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSubAdmin}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Create Sub-Admin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );



  const renderDashboard = () => (
    <div className="space-y-8 bg-gradient-to-br from-slate-50 via-white to-blue-50 min-h-screen">
      {/* Enhanced KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <EnhancedMetricCard title="Total Sales" value="$236K" subtitle="+12% from last month" icon={DollarSign} trend="+12%" index={0} color="emerald" />
        <EnhancedMetricCard title="Active Alerts" value={alerts.length.toString()} subtitle={`${alerts.filter(a => a.severity === 'high').length} high priority`} icon={Bell} trend={alerts.length > 5 ? `-${alerts.length - 5}` : `+${5 - alerts.length}`} index={1} color="red" />
        <EnhancedMetricCard title="Daily Footfall" value="2,187" subtitle="+8% from yesterday" icon={Users} trend="+8%" index={2} color="cyan" />
        <EnhancedMetricCard title="Top Performer" value="Lisa Davis" subtitle="106% efficiency" icon={Star} trend="+6%" index={3} color="amber" />
      </div>

      {/* Advanced Analytics Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-gray-900">Sales by Division</h3>
              <p className="text-sm text-gray-600 mt-1">Performance across all business units</p>
            </div>
            <div className="flex items-center space-x-3">
              <select className="bg-gray-100 border-0 rounded-lg px-4 py-2 text-sm font-medium text-gray-700">
                <option>Last 30 Days</option>
                <option>Last 7 Days</option>
                <option>Last 24 Hours</option>
              </select>
              <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={salesData.reduce((acc, curr) => {
                  const existing = acc.find(item => item.division === curr.division);
                  if (existing) existing.sales += curr.sales;
                  else acc.push({ division: curr.division, sales: curr.sales });
                  return acc;
                }, [])}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="division" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" fill="url(#salesGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-black text-gray-900 mb-6">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Plus, label: 'Add Employee', color: 'blue' },
                { icon: Download, label: 'Export Data', color: 'green' },
                { icon: Settings, label: 'System Config', color: 'purple' },
                { icon: Bell, label: 'View Alerts', color: 'red' }
              ].map((action, index) => (
                <button
                  key={index}
                  className="p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-all duration-300 group"
                >
                  <action.icon className="w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-gray-700">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
            <h3 className="text-lg font-black text-gray-900 mb-6">System Health</h3>
            <div className="space-y-4">
              {[
                { label: 'Server Load', value: realTimeMetrics.systemLoad },
                { label: 'Active Sessions', value: 78.3 },
                { label: 'Memory Usage', value: 65.8 },
                { label: 'Network Speed', value: 92.1 }
              ].map((metric, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                    <span>{metric.label}</span>
                    <span>{metric.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 rounded-full" style={{ width: `${metric.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Footfall Chart */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Today's Footfall</h3>
            <p className="text-sm text-gray-600 mt-1">Real-time customer traffic analysis</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={footfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="customers" stroke="#3B82F6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderSalesEfficiency = () => {
    const sectionOptions = sectionsForDivision(salesFilter.division);
    const departmentOptions = departmentsFor(salesFilter.division, salesFilter.section);
    const employeeOptions = employeesFor(salesFilter.division, salesFilter.section, salesFilter.department);

    const resetFilters = () => setSalesFilter({
      division: 'All', section: 'All', department: 'All', employee: 'All', search: '', minPerf: ''
    });

    return (
      <div className="space-y-8 bg-gradient-to-br from-green-50 via-white to-emerald-50 min-h-screen">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-gray-900">Sales Performance Overview</h3>
              <p className="text-sm text-gray-600 mt-1">Comprehensive sales tracking across all divisions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
              >
                Reset
              </button>
              <button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Division */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Division</label>
              <select
                value={salesFilter.division}
                onChange={(e) =>
                  setSalesFilter(f => ({
                    division: e.target.value,
                    section: 'All',
                    department: 'All',
                    employee: 'All',
                    search: f.search,
                    minPerf: f.minPerf
                  }))
                }
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {allDivisions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            {/* Section */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Section</label>
              <select
                value={salesFilter.section}
                onChange={(e) =>
                  setSalesFilter(f => ({
                    ...f,
                    section: e.target.value,
                    department: 'All',
                    employee: 'All'
                  }))
                }
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {sectionOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            {/* Department */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Department</label>
              <select
                value={salesFilter.department}
                onChange={(e) =>
                  setSalesFilter(f => ({
                    ...f,
                    department: e.target.value,
                    employee: 'All'
                  }))
                }
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {departmentOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            {/* Employee */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Employee</label>
              <select
                value={salesFilter.employee}
                onChange={(e) => setSalesFilter(f => ({ ...f, employee: e.target.value }))}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {employeeOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            {/* Search */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Search</label>
              <input
                type="text"
                placeholder="Division / Section / Dept / Employee"
                value={salesFilter.search}
                onChange={(e) => setSalesFilter(f => ({ ...f, search: e.target.value }))}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            {/* Min Performance */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-600 mb-1">Min Performance %</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 95"
                value={salesFilter.minPerf}
                onChange={(e) => setSalesFilter(f => ({ ...f, minPerf: e.target.value }))}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          {/* Result meta */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredSales.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{salesData.length}</span> rows
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Division</th>
                  <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Section</th>
                  <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Sales</th>
                  <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((item, index) => {
                  const performance = ((item.sales / item.target) * 100).toFixed(1);
                  return (
                    <tr key={`${item.employee}-${index}`} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 text-gray-800 font-medium">{item.division}</td>
                      <td className="px-6 py-4 text-gray-800">{item.section}</td>
                      <td className="px-6 py-4 text-gray-800">{item.department}</td>
                      <td className="px-6 py-4 text-gray-900 font-bold">{item.employee}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">${item.sales.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-gray-600 font-medium">${item.target.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-2 rounded-full text-xs font-bold ${
                          performance >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg' :
                          performance >= 90 ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white shadow-lg' :
                          'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg'
                        }`}>
                          {performance}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                      No results. Try relaxing the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
            <h3 className="text-lg font-black text-gray-900 mb-6">Sales by Department (Filtered)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByDepartment}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="sales"
                    label={({ department, percent }) => `${department} ${(percent * 100).toFixed(0)}%`}
                  >
                    {salesByDepartment.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
            <h3 className="text-lg font-black text-gray-900 mb-6">Target vs Achievement (Filtered)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={targetVsAchievement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="employee" angle={-45} textAnchor="end" height={100} stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Bar dataKey="target" fill="#E5E7EB" name="Target" />
                  <Bar dataKey="sales" fill="#3B82F6" name="Achievement" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

const renderFootfallAnalysis = () => {
  const resetFootFilters = () => setFootFilter({
    period: 'Today',
    search: '',
    min: '',
    max: ''
  });

  return (
    <div className="space-y-8 bg-gradient-to-br from-cyan-50 via-white to-teal-50 min-h-screen">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Hourly Footfall Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">
              Customer traffic patterns — <span className="font-semibold">{footFilter.period}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetFootFilters}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Period (mock switch) */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Period</label>
            <select
              value={footFilter.period}
              onChange={(e) => setFootFilter(f => ({ ...f, period: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              {['Today', 'Yesterday', 'Last Week'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Search hour label */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Search Hour</label>
            <input
              type="text"
              placeholder='e.g., "PM", "10AM", "5"'
              value={footFilter.search}
              onChange={(e) => setFootFilter(f => ({ ...f, search: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* Min customers */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Customers</label>
            <input
              type="number"
              min="0"
              value={footFilter.min}
              onChange={(e) => setFootFilter(f => ({ ...f, min: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* Max customers */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Max Customers</label>
            <input
              type="number"
              min="0"
              value={footFilter.max}
              onChange={(e) => setFootFilter(f => ({ ...f, max: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>

          {/* Summary */}
          <div className="flex items-end lg:col-span-2">
            <div className="w-full text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Showing <span className="font-semibold text-gray-900">{filteredFootfall.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{currentFootfall.length}</span> hours •
              Avg <span className="font-semibold text-gray-900">{Math.round(avgCustomers)}</span> customers/hr
            </div>
          </div>
        </div>

        {/* Chart (filtered) */}
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredFootfall}>
              <defs>
                <linearGradient id="footfallGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9da2abff" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(12, 12, 12, 0.1)'
                }} 
              />
              <Area type="monotone" dataKey="customers" stroke="#06B6D4" fill="url(#footfallGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stat cards (filtered) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Peak Hour",  value: peakRow ? peakRow.hour : '—',   subtitle: peakRow ? `${peakRow.customers} customers` : 'No data', color: "cyan" },
          { title: "Average Hr", value: Math.round(avgCustomers).toString(), subtitle: "customers/hour", color: "blue" },
          { title: "Low Traffic", value: lowRow ? lowRow.hour : '—',    subtitle: lowRow ? `${lowRow.customers} customers` : 'No data', color: "purple" }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClasses(stat.color)} shadow-lg`}>
                <Timer className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const renderEmployeePerformance = () => {
  const resetEmpFilters = () => setEmpFilter({ search: '', minEfficiency: '' });

  return (
    <div className="space-y-8 bg-gradient-to-br from-amber-50 via-white to-orange-50 min-h-screen">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Employee Performance Rankings</h3>
            <p className="text-sm text-gray-600 mt-1">Comprehensive performance analysis and rankings</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetEmpFilters}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              Reset
            </button>
            <button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export Rankings</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Search Employee</label>
            <input
              type="text"
              placeholder="Enter employee name"
              value={empFilter.search}
              onChange={(e) => setEmpFilter(f => ({ ...f, search: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Efficiency %</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 95"
              value={empFilter.minEfficiency}
              onChange={(e) => setEmpFilter(f => ({ ...f, minEfficiency: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
        </div>

        {/* Result Meta */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{employeePerformance.length}</span> employees
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Daily Sales</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Monthly Sales</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">All-Time Sales</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Efficiency</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees
                .sort((a, b) => b.efficiency - a.efficiency)
                .map((emp, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white mr-4 shadow-lg ${
                          index === 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 
                          index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 
                          index === 2 ? 'bg-gradient-to-r from-amber-600 to-yellow-600' : 
                          'bg-gradient-to-r from-gray-500 to-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-bold text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">${emp.daily.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">${emp.monthly.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">${emp.allTime.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        {emp.efficiency >= 100 ? (
                          <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-red-600 mr-1" />
                        )}
                        <span className="font-black text-gray-900">{emp.efficiency.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg ${
                        emp.efficiency >= 105 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                        emp.efficiency >= 95 ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white' :
                        'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                      }`}>
                        {emp.efficiency >= 105 ? 'Excellent' :
                        emp.efficiency >= 95 ? 'Good' : 'Needs Improvement'}
                      </span>
                    </td>
                  </tr>
                ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                    No results. Try relaxing the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        <h3 className="text-lg font-black text-gray-900 mb-6">Performance Trends (Filtered)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredEmployees}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }} 
              />
              <Bar dataKey="efficiency" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};


  const renderAlerts = () => (
    <div className="space-y-8 bg-gradient-to-br from-red-50 via-white to-pink-50 min-h-screen">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Active Alerts ({alerts.length})</h3>
            <p className="text-sm text-gray-600 mt-1">System-generated alerts requiring attention</p>
          </div>
          <button className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Configure Alerts</span>
          </button>
        </div>

        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-6 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all duration-200 ${
              alert.severity === 'high' ? 'bg-red-50 border-red-500 hover:bg-red-100' :
              alert.severity === 'medium' ? 'bg-amber-50 border-amber-500 hover:bg-amber-100' :
              'bg-blue-50 border-blue-500 hover:bg-blue-100'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-4 ${
                    alert.severity === 'high' ? 'bg-red-100' :
                    alert.severity === 'medium' ? 'bg-amber-100' :
                    'bg-blue-100'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 ${
                      alert.severity === 'high' ? 'text-red-600' :
                      alert.severity === 'medium' ? 'text-amber-600' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 mb-1">{alert.message}</p>
                    <p className="text-sm text-gray-600 capitalize">{alert.type} Alert - {alert.severity} Priority</p>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg ${
                  alert.severity === 'high' ? 'bg-gradient-to-r from-red-400 to-red-500 text-white' :
                  alert.severity === 'medium' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white' :
                  'bg-gradient-to-r from-blue-400 to-blue-500 text-white'
                }`}>
                  {alert.severity.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "High Priority", value: alerts.filter(a => a.severity === 'high').length, subtitle: "Immediate attention required", color: "red" },
          { title: "Medium Priority", value: alerts.filter(a => a.severity === 'medium').length, subtitle: "Review within 24 hours", color: "amber" },
          { title: "Total Alerts", value: alerts.length, subtitle: "All active alerts", color: "blue" }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClasses(stat.color)} shadow-lg`}>
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-3">{stat.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

const renderVendorManagement = () => {
  const resetVendorFilters = () => setVendorFilter({
    search: '',
    status: 'All',
    minRating: '',
    maxReports: ''
  });

  const goodCount    = filteredVendors.filter(v => v.status === 'Good').length;
  const warningCount = filteredVendors.filter(v => v.status === 'Warning').length;
  const badCount     = filteredVendors.filter(v => v.status === 'Bad').length;

  return (
    <div className="space-y-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">Vendor Status Overview</h3>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive vendor performance monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetVendorFilters}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              Reset
            </button>
            <button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Add Vendor</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Search Vendor</label>
            <input
              type="text"
              placeholder="Type vendor name"
              value={vendorFilter.search}
              onChange={(e) => setVendorFilter(f => ({ ...f, search: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={vendorFilter.status}
              onChange={(e) => setVendorFilter(f => ({ ...f, status: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            >
              {['All', 'Good', 'Warning', 'Bad'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Min Rating */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Rating</label>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="e.g. 3.5"
              value={vendorFilter.minRating}
              onChange={(e) => setVendorFilter(f => ({ ...f, minRating: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Max Reports */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Max Reports</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 2"
              value={vendorFilter.maxReports}
              onChange={(e) => setVendorFilter(f => ({ ...f, maxReports: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Summary */}
          <div className="flex items-end">
            <div className="w-full text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Showing <span className="font-semibold text-gray-900">{filteredVendors.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{vendorData.length}</span> vendors
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left  font-black text-gray-900 text-sm uppercase tracking-wider">Vendor Name</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Reports</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((vendor, index) => (
                <tr key={`${vendor.name}-${index}`} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 font-bold text-gray-900">{vendor.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                      vendor.reports === 0 ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                      vendor.reports <= 2 ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' :
                      'bg-gradient-to-r from-red-400 to-red-500 text-white'
                    }`}>
                      {vendor.reports}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <Star className="w-4 h-4 text-amber-500 mr-1" />
                      <span className="font-bold text-gray-800">{vendor.rating}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg ${
                      vendor.status === 'Good' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                      vendor.status === 'Warning' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' :
                      'bg-gradient-to-r from-red-400 to-red-500 text-white'
                    }`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {vendor.status === 'Bad' && (
                      <button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-lg hover:shadow-xl">
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No results. Try relaxing the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stat cards honor filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Good Vendors", value: goodCount,    subtitle: "No issues reported",   color: "green" },
          { title: "Warning Status", value: warningCount, subtitle: "Minor issues reported", color: "amber" },
          { title: "Bad Vendors", value: badCount,     subtitle: "Multiple reports against", color: "red" }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClasses(stat.color)} shadow-lg`}>
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderInventoryAnalysis = () => {
  const resetInvFilters = () => setInvFilter({
    search: '',
    risk: 'All',
    minStock: '',
    maxStock: '',
    minSales: '',
    maxSales: '',
    minRatio: ''
  });

  // counts by risk for quick cards (based on filtered list)
  const highCount   = filteredInventory.filter(i => getRiskLabel(i.stockToSalesRatio) === 'High').length;
  const mediumCount = filteredInventory.filter(i => getRiskLabel(i.stockToSalesRatio) === 'Medium').length;
  const lowCount    = filteredInventory.filter(i => getRiskLabel(i.stockToSalesRatio) === 'Low').length;

  return (
    <div className="space-y-8 bg-gradient-to-br from-violet-50 via-white to-purple-50 min-h-screen">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900">High Stock, Low Sales Products</h3>
            <p className="text-sm text-gray-600 mt-1">Inventory optimization analysis and recommendations</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetInvFilters}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
            >
              Reset
            </button>
            <button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Optimize Stock</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {/* Search */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Search Product</label>
            <input
              type="text"
              placeholder="Type product name"
              value={invFilter.search}
              onChange={(e) => setInvFilter(f => ({ ...f, search: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Risk */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Risk Level</label>
            <select
              value={invFilter.risk}
              onChange={(e) => setInvFilter(f => ({ ...f, risk: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            >
              {['All', 'High', 'Medium', 'Low'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Min Stock */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Stock</label>
            <input
              type="number"
              min="0"
              value={invFilter.minStock}
              onChange={(e) => setInvFilter(f => ({ ...f, minStock: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Max Stock */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Max Stock</label>
            <input
              type="number"
              min="0"
              value={invFilter.maxStock}
              onChange={(e) => setInvFilter(f => ({ ...f, maxStock: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Min Sales */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Monthly Sales</label>
            <input
              type="number"
              min="0"
              value={invFilter.minSales}
              onChange={(e) => setInvFilter(f => ({ ...f, minSales: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Max Sales */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Max Monthly Sales</label>
            <input
              type="number"
              min="0"
              value={invFilter.maxSales}
              onChange={(e) => setInvFilter(f => ({ ...f, maxSales: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Min Ratio */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">Min Stock/Sales Ratio</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={invFilter.minRatio}
              onChange={(e) => setInvFilter(f => ({ ...f, minRatio: e.target.value }))}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </div>

        {/* Result meta */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredInventory.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{inventoryData.length}</span> products
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left font-black text-gray-900 text-sm uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Monthly Sales</th>
                <th className="px-6 py-4 text-right font-black text-gray-900 text-sm uppercase tracking-wider">Stock/Sales Ratio</th>
                <th className="px-6 py-4 text-center font-black text-gray-900 text-sm uppercase tracking-wider">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory
                .sort((a, b) => b.stockToSalesRatio - a.stockToSalesRatio)
                .map((item, index) => {
                  const risk = getRiskLabel(item.stockToSalesRatio);
                  return (
                    <tr key={`${item.product}-${index}`} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 font-bold text-gray-900">{item.product}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-800">{item.stock}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-800">{item.sales}</td>
                      <td className="px-6 py-4 text-right font-black text-gray-900">{item.stockToSalesRatio.toFixed(1)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg ${
                          risk === 'High'
                            ? 'bg-gradient-to-r from-red-400 to-red-500 text-white'
                            : risk === 'Medium'
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-green-400 to-emerald-500 text-white'
                        }`}>
                          {risk} Risk
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    No results. Try relaxing the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart reflects filters */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
        <h3 className="text-lg font-black text-gray-900 mb-6">Stock-to-Sales Ratio Analysis (Filtered)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredInventory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="product" angle={-45} textAnchor="end" height={100} stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }} 
              />
              <Bar dataKey="stockToSalesRatio" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk summary cards use filtered data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "High Risk",   value: highCount,   subtitle: "Ratio > 20",      color: "red" },
          { title: "Medium Risk", value: mediumCount, subtitle: "10 < Ratio ≤ 20", color: "amber" },
          { title: "Low Risk",    value: lowCount,    subtitle: "Ratio ≤ 10",      color: "green" }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${getColorClasses(stat.color)} shadow-lg`}>
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


  const renderPredictions = () => (
    <div className="space-y-8 bg-gradient-to-br from-emerald-50 via-white to-teal-50 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900">Profit Prediction</h3>
              <p className="text-sm text-gray-600 mt-1">AI-powered revenue forecasting</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitPrediction}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={3} name="Actual" />
                <Line type="monotone" dataKey="predicted" stroke="#6B7280" strokeWidth={3} strokeDasharray="8 8" name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900">Return Prediction by Category</h3>
              <p className="text-sm text-gray-600 mt-1">Predictive analytics for returns</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnPrediction}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="category" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="returnRate" fill="#14B8A6" name="Return Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          <h4 className="text-lg font-black text-gray-900 mb-6">Profit Forecast (Next 3 Months)</h4>
          <div className="space-y-4">
            {profitPrediction.slice(3).map((month, index) => (
              <div key={index} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-bold text-gray-800">{month.month}</span>
                <span className="text-gray-900 font-black text-lg">${month.predicted.toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl border-2 border-emerald-300">
                <span className="font-black text-gray-900">Total Predicted</span>
                <span className="text-emerald-800 font-black text-xl">
                  ${profitPrediction.slice(3).reduce((sum, month) => sum + month.predicted, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
          <h4 className="text-lg font-black text-gray-900 mb-6">Expected Returns This Month</h4>
          <div className="space-y-4">
            {returnPrediction.map((category, index) => (
              <div key={index} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-bold text-gray-800">{category.category}</span>
                <div className="text-right">
                  <span className="text-gray-900 font-black text-lg">{category.predictedReturns}</span>
                  <span className="text-sm text-gray-600 ml-2 font-medium">({category.returnRate}%)</span>
                </div>
              </div>
            ))}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl border-2 border-teal-300">
                <span className="font-black text-gray-900">Total Expected Returns</span>
                <span className="text-teal-800 font-black text-xl">
                  {returnPrediction.reduce((sum, cat) => sum + cat.predictedReturns, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return renderDashboard();
      case 'sales': return renderSalesEfficiency();
      case 'footfall': return renderFootfallAnalysis();
      case 'performance': return renderEmployeePerformance();
      case 'alerts': return renderAlerts();
      case 'vendors': return renderVendorManagement();
      case 'inventory': return renderInventoryAnalysis();
      case 'predictions': return renderPredictions();
      default: return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Sub-Admin Modal */}
      <SubAdminModal />

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-lg sticky top-0 z-[9999]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Admin RMS Dashboard
                </h1>
                <p className="text-sm text-gray-600 font-medium">Advanced Retail Management System</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Add Sub-Admin Button */}
            <button
              onClick={() => setShowSubAdminModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Sub-Admin</span>
            </button>

            {/* Real-time Status */}
            <div className="flex items-center space-x-6 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.activeUsers} Users</span>
              </div>
              <div className="flex items-center space-x-2">
                <Cpu className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.systemLoad.toFixed(1)}% Load</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-bold text-gray-700">{currentTime.toLocaleTimeString()}</span>
            </div>

            <div className="relative">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 relative">
                <Bell className="h-5 w-5" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-400 to-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg">
                    {alerts.length}
                  </span>
                )}
              </button>
            </div>

            <div className="relative z-[9999] user-dropdown-container">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 relative transition-all duration-200"
              >
                <User className="h-5 w-5" />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-[9999]">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-800 hover:bg-gray-100 font-bold transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-2 overflow-x-auto py-4 scrollbar-hide">
            {modules.map(module => {
              const Icon = module.icon;
              const isActive = activeModule === module.id;
              return (
                <button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={`flex items-center px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 whitespace-nowrap shadow-sm ${
                    isActive
                      ? `bg-gradient-to-r ${module.gradient} text-white shadow-lg transform scale-105`
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {module.name}
                  {module.id === 'alerts' && alerts.length > 0 && (
                    <span className={`ml-2 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg ${
                      isActive ? 'bg-white/30 text-white' : 'bg-gradient-to-r from-red-400 to-red-500 text-white'
                    }`}>
                      {alerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {renderModule()}
      </div>
    </div>
  );
};

export default AdminRMS;