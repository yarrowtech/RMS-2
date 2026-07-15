import React, { useState, useEffect } from 'react';
import { logoutOrReturnToDepartmentSelector } from "../utils/authRedirect";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { 
  Home, Package, ShoppingCart, Truck, MapPin, Archive, TrendingUp, 
  MessageCircle, Settings, MessageSquare, Activity, Search, Bell, User,
  Plus, Eye, Edit, Trash2, Filter, Download, Upload, ArrowLeft, Timer, 
  Shield, Gauge, Star, Zap, Target, DollarSign, Users, Building2, AlertTriangle,
  TrendingDown, RefreshCw, Menu, ChevronRight, Globe, CheckCircle, XCircle, 
  AlertCircle, Clock, Layers, Cpu, Wifi, Battery, Calendar, ArrowUpRight, ArrowDownRight, LogOut, X
} from 'lucide-react';

const Logistics = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animatedValues, setAnimatedValues] = useState({});
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    activeShipments: 89,
    systemLoad: 34.2,
    networkLatency: 23,
    efficiency: 94.7
  });

  // NEW: State for metric click functionality
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [metricDetails, setMetricDetails] = useState({
    'Total Orders': { 
      value: 2847, 
      trend: [2400, 2550, 2680, 2750, 2820, 2847], 
      lastUpdated: 'Just now',
      description: 'Total number of orders processed across all channels',
      breakdown: [
        { label: 'Online Orders', value: 1823, percentage: 64 },
        { label: 'In-Store Orders', value: 682, percentage: 24 },
        { label: 'Partner Orders', value: 342, percentage: 12 }
      ]
    },
    'Active Shipments': { 
      value: 89, 
      trend: [75, 78, 82, 85, 87, 89], 
      lastUpdated: '2 min ago',
      description: 'Currently active shipments in the logistics network',
      breakdown: [
        { label: 'In Transit', value: 56, percentage: 63 },
        { label: 'Processing', value: 22, percentage: 25 },
        { label: 'Dispatched', value: 11, percentage: 12 }
      ]
    },
    'Delivery Rate': { 
      value: 94.8, 
      trend: [89, 90, 92, 93, 94, 94.8], 
      lastUpdated: '5 min ago',
      description: 'Percentage of successful on-time deliveries',
      breakdown: [
        { label: 'On-Time', value: 2698, percentage: 94.8 },
        { label: 'Delayed', value: 127, percentage: 4.5 },
        { label: 'Failed', value: 22, percentage: 0.7 }
      ]
    },
    'Inventory Items': { 
      value: 12456, 
      trend: [10200, 10800, 11200, 11800, 12100, 12456], 
      lastUpdated: '1 min ago',
      description: 'Total items currently in inventory across all warehouses',
      breakdown: [
        { label: 'Electronics', value: 4360, percentage: 35 },
        { label: 'Clothing', value: 3114, percentage: 25 },
        { label: 'Books', value: 2491, percentage: 20 }
      ]
    },
    'Revenue': { 
      value: 847000, 
      trend: [720, 750, 780, 810, 830, 847], 
      lastUpdated: 'Just now',
      description: 'Total revenue generated this month',
      breakdown: [
        { label: 'Product Sales', value: 635250, percentage: 75 },
        { label: 'Shipping Fees', value: 127050, percentage: 15 },
        { label: 'Other', value: 84700, percentage: 10 }
      ]
    },
    'Efficiency Score': { 
      value: 94.7, 
      trend: [89, 90, 91, 93, 94, 94.7], 
      lastUpdated: '3 min ago',
      description: 'Overall logistics efficiency score based on multiple factors',
      breakdown: [
        { label: 'Route Optimization', value: 96, percentage: 96 },
        { label: 'Resource Utilization', value: 94, percentage: 94 },
        { label: 'Time Management', value: 94, percentage: 94 }
      ]
    }
  });

  // NEW: Handle metric card click
  const handleMetricClick = (metricLabel) => {
    setSelectedMetric(metricLabel);
    setShowMetricModal(true);
  };

  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'System', message: 'Logistics hub operational - All systems green', time: '10:30 AM' },
    { id: 2, sender: 'Dispatcher', message: 'New shipment TRK-2024-001 dispatched to New York', time: '11:15 AM' },
    { id: 3, sender: 'Warehouse', message: 'Inventory restock completed for Electronics', time: '11:45 AM' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      [0, 1, 2, 3, 4, 5].forEach((index) => {
        setTimeout(() => {
          setAnimatedValues(prev => ({ ...prev, [index]: true }));
        }, index * 150);
      });
    }, 300);

    const metricsTimer = setInterval(() => {
      setRealTimeMetrics(prev => ({
        activeShipments: prev.activeShipments + Math.floor(Math.random() * 6 - 3),
        systemLoad: Math.max(0, Math.min(100, prev.systemLoad + (Math.random() * 4 - 2))),
        networkLatency: Math.max(0, prev.networkLatency + Math.floor(Math.random() * 6 - 3)),
        efficiency: Math.min(100, prev.efficiency + (Math.random() * 0.2 - 0.1))
      }));
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(metricsTimer);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const handleLogout = () => logoutOrReturnToDepartmentSelector();

  const kpiMetrics = [
    { label: 'Total Orders', value: '2,847', target: '2,500', variance: '+13.9%', trend: 'up', icon: Package, color: 'blue' },
    { label: 'Active Shipments', value: realTimeMetrics.activeShipments.toString(), target: '75', variance: '+18.7%', trend: 'up', icon: Truck, color: 'green' },
    { label: 'Delivery Rate', value: '94.8%', target: '90%', variance: '+5.3pp', trend: 'up', icon: Target, color: 'purple' },
    { label: 'Inventory Items', value: '12,456', target: '10,000', variance: '+24.6%', trend: 'up', icon: Archive, color: 'amber' },
    { label: 'Revenue', value: '$847K', target: '$750K', variance: '+12.9%', trend: 'up', icon: DollarSign, color: 'emerald' },
    { label: 'Efficiency Score', value: `${realTimeMetrics.efficiency.toFixed(1)}%`, target: '90%', variance: '+5.2pp', trend: 'up', icon: Gauge, color: 'cyan' }
  ];

  const salesData = [
    { month: 'Jan', revenue: 45000, orders: 120, efficiency: 92 },
    { month: 'Feb', revenue: 52000, orders: 145, efficiency: 94 },
    { month: 'Mar', revenue: 48000, orders: 130, efficiency: 91 },
    { month: 'Apr', revenue: 61000, orders: 160, efficiency: 96 },
    { month: 'May', revenue: 55000, orders: 150, efficiency: 93 },
    { month: 'Jun', revenue: 67000, orders: 180, efficiency: 97 }
  ];

  const inventoryData = [
    { name: 'Electronics', value: 35, color: '#3B82F6' },
    { name: 'Clothing', value: 25, color: '#10B981' },
    { name: 'Books', value: 20, color: '#F59E0B' },
    { name: 'Home & Garden', value: 15, color: '#EF4444' },
    { name: 'Others', value: 5, color: '#8B5CF6' }
  ];

  const trackingData = [
    { id: 'TRK-2024-001', destination: 'New York', status: 'In Transit', progress: 75, eta: '2 hours', priority: 'High' },
    { id: 'TRK-2024-002', destination: 'Los Angeles', status: 'Delivered', progress: 100, eta: 'Delivered', priority: 'Medium' },
    { id: 'TRK-2024-003', destination: 'Chicago', status: 'Processing', progress: 25, eta: '6 hours', priority: 'Low' },
    { id: 'TRK-2024-004', destination: 'Houston', status: 'In Transit', progress: 60, eta: '4 hours', priority: 'High' },
    { id: 'TRK-2024-005', destination: 'Phoenix', status: 'Dispatched', progress: 10, eta: '8 hours', priority: 'Medium' }
  ];

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, gradient: 'from-blue-500 to-purple-600' },
    { id: 'management', label: 'Management', icon: Package, gradient: 'from-green-500 to-blue-600' },
    { id: 'procurement', label: 'Procurement', icon: ShoppingCart, gradient: 'from-purple-500 to-pink-600' },
    { id: 'shipping', label: 'Shipping', icon: Truck, gradient: 'from-orange-500 to-red-600' },
    { id: 'tracking', label: 'Tracking', icon: MapPin, gradient: 'from-cyan-500 to-teal-600' },
    { id: 'inventory', label: 'Inventory', icon: Archive, gradient: 'from-indigo-500 to-purple-600' },
    { id: 'sales', label: 'Sales Turnover', icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600' }
  ];

  const rightMenuItems = [
    { id: 'chat', label: 'Chat', icon: MessageCircle, gradient: 'from-blue-500 to-cyan-500' },
    { id: 'settings', label: 'Settings', icon: Settings, gradient: 'from-gray-500 to-gray-700' },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare, gradient: 'from-pink-500 to-rose-600' },
    { id: 'progress', label: 'Progress', icon: Activity, gradient: 'from-violet-500 to-purple-600' }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-400 to-blue-600',
      green: 'from-green-400 to-green-600',
      purple: 'from-purple-400 to-purple-600',
      amber: 'from-amber-400 to-amber-600',
      emerald: 'from-emerald-400 to-emerald-600',
      cyan: 'from-cyan-400 to-cyan-600'
    };
    return colors[color] || 'from-gray-400 to-gray-600';
  };

  // NEW: Enhanced Metric Card with Click Functionality
  const EnhancedMetricCard = ({ metric, index }) => {
    const IconComponent = metric.icon;
    const isAnimated = animatedValues[index];

    return (
      <div 
        onClick={() => handleMetricClick(metric.label)}
        className={`group relative bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-2xl transition-all duration-700 hover:border-gray-300 hover:-translate-y-2 overflow-hidden cursor-pointer ${
          isAnimated ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' : 'opacity-0'
        }`}
        style={{ animationDelay: `${index * 150}ms` }}
      >
        {/* Hover overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${getColorClasses(metric.color)} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
        
        {/* Click indicator */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white rounded-full p-1 shadow-lg">
            <Eye className="w-3 h-3 text-gray-600" />
          </div>
        </div>
        
        <div className="relative">
          <div className="flex items-start justify-between mb-4 md:mb-6">
            <div className={`p-3 md:p-4 rounded-xl bg-gradient-to-br ${getColorClasses(metric.color)} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <IconComponent className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className={`flex items-center text-xs md:text-sm font-bold px-2 md:px-3 py-1 rounded-full ${
              metric.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 mr-1" /> : <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4 mr-1" />}
              {metric.variance}
            </div>
          </div>

          <div className="space-y-2 md:space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{metric.label}</p>
            <p className="text-2xl md:text-3xl font-black text-gray-900 leading-none group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
              {metric.value}
            </p>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Target: <span className="font-semibold">{metric.target}</span></p>
          </div>

          <div className="mt-4 md:mt-6 relative">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getColorClasses(metric.color)} transition-all duration-1500 ease-out rounded-full relative`}
                style={{ 
                  width: isAnimated ? '88%' : '0%',
                  boxShadow: isAnimated ? `0 0 20px rgba(59, 130, 246, 0.3)` : 'none'
                }}
              >
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
              <span>Performance</span>
              <span>88%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // NEW: Metric Detail Modal
  const MetricDetailModal = () => {
    if (!selectedMetric || !showMetricModal) return null;
    
    const details = metricDetails[selectedMetric];
    if (!details) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4" onClick={() => setShowMetricModal(false)}>
        <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black">{selectedMetric}</h3>
                <p className="text-sm opacity-90 mt-1">{details.description}</p>
              </div>
              <button 
                onClick={() => setShowMetricModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Current Value */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">Current Value</p>
                  <p className="text-4xl font-black text-gray-900 mt-2">
                    {selectedMetric === 'Revenue' 
                      ? `$${(details.value / 1000).toFixed(0)}K`
                      : selectedMetric === 'Delivery Rate' || selectedMetric === 'Efficiency Score'
                      ? `${details.value}%`
                      : details.value.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm font-bold text-gray-700">{details.lastUpdated}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div>
              <h4 className="text-lg font-black text-gray-900 mb-4">Breakdown Analysis</h4>
              <div className="space-y-3">
                {details.breakdown.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-700">{item.label}</span>
                      <span className="text-sm font-black text-gray-900">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-1000"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-gray-50">
            <div className="flex items-center justify-end space-x-3">
              <button 
                onClick={() => setShowMetricModal(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all"
              >
                Close
              </button>
              <button className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-lg">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setChatMessages([...chatMessages, {
        id: Date.now(),
        sender: 'You',
        message: newMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setNewMessage('');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered': return 'bg-green-100 text-green-800 border border-green-200';
      case 'In Transit': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Dispatched': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'Processing': return 'bg-amber-100 text-amber-800 border border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8 bg-gradient-to-br from-slate-50 via-white to-blue-50 min-h-screen">
            {/* Enhanced KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
              {kpiMetrics.map((metric, index) => (
                <EnhancedMetricCard key={index} metric={metric} index={index} />
              ))}
            </div>

            {/* Advanced Analytics Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
              <div className="xl:col-span-2 bg-white rounded-2xl p-4 md:p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-gray-900">Logistics Analytics</h3>
                    <p className="text-xs md:text-sm text-gray-600 mt-1">Real-time performance metrics and trends</p>
                  </div>
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <select className="bg-gray-100 border-0 rounded-lg px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 flex-1 sm:flex-none">
                      <option>Last 24 Hours</option>
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                    </select>
                    <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="h-64 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesData}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #E5E7EB', 
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }} 
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="url(#revenueGradient)" strokeWidth={3} />
                      <Area type="monotone" dataKey="orders" stroke="#10B981" fill="url(#ordersGradient)" strokeWidth={3} />
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
                      { icon: Plus, label: 'New Shipment', color: 'blue' },
                      { icon: Download, label: 'Export Data', color: 'green' },
                      { icon: Settings, label: 'Configure', color: 'purple' },
                      { icon: Bell, label: 'Alerts', color: 'red' }
                    ].map((action, index) => (
                      <button 
                        key={index}
                        className={`p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg transition-all duration-300 group`}
                      >
                        <action.icon className={`w-6 h-6 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform`} />
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
                      { label: 'Network Load', value: realTimeMetrics.systemLoad, max: 100, color: 'blue' },
                      { label: 'Active Routes', value: 78.3, max: 100, color: 'green' },
                      { label: 'Warehouse Capacity', value: 65.8, max: 100, color: 'purple' },
                      { label: 'Fleet Utilization', value: 89.2, max: 100, color: 'cyan' }
                    ].map((metric, index) => (
                      <div key={index}>
                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                          <span>{metric.label}</span>
                          <span>{metric.value.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 rounded-full`}
                            style={{ width: `${metric.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'tracking':
        return (
          <div className="space-y-8 bg-gradient-to-br from-cyan-50 via-white to-teal-50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900">Shipment Tracking Hub</h2>
                <p className="text-sm md:text-base text-gray-600 mt-1">Real-time logistics monitoring and control</p>
              </div>
              <button className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2 text-sm md:text-base w-full sm:w-auto justify-center">
                <Plus className="h-4 w-4 md:h-5 md:w-5" />
                <span>New Shipment</span>
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Active Shipments', value: trackingData.length, icon: Truck, color: 'from-blue-400 to-blue-600' },
                { label: 'In Transit', value: trackingData.filter(t => t.status === 'In Transit').length, icon: MapPin, color: 'from-green-400 to-green-600' },
                { label: 'Delivered Today', value: trackingData.filter(t => t.status === 'Delivered').length, icon: CheckCircle, color: 'from-emerald-400 to-emerald-600' },
                { label: 'Avg Delivery Time', value: '4.2hrs', icon: Timer, color: 'from-purple-400 to-purple-600' }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.label}</p>
                      <p className="text-xl md:text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                      <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b bg-gray-50">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:space-x-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                      <input
                        type="text"
                        placeholder="Search tracking ID, destination..."
                        className="pl-9 md:pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-xl w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white text-sm md:text-base"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="flex-1 sm:flex-none p-2 md:p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                      <Filter className="h-4 w-4 md:h-5 md:w-5 text-gray-600 mx-auto" />
                    </button>
                    <button className="flex-1 sm:flex-none p-2 md:p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                      <Download className="h-4 w-4 md:h-5 md:w-5 text-gray-600 mx-auto" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Tracking ID', 'Destination', 'Status', 'Priority', 'Progress', 'ETA', 'Actions'].map((header) => (
                        <th key={header} className="px-3 md:px-6 py-3 md:py-4 text-left text-xs font-black text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {trackingData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-bold text-gray-900">{item.id}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 text-gray-400 mr-1 md:mr-2" />
                            <span className="text-xs md:text-sm font-medium text-gray-900">{item.destination}</span>
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 md:px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-500">
                          <div className="flex items-center">
                            <div className="w-16 md:w-full bg-gray-200 rounded-full h-2 mr-2 md:mr-3">
                              <div
                                className="bg-gradient-to-r from-cyan-400 to-teal-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${item.progress}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-xs">{item.progress}%</span>
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 md:h-4 md:w-4 text-gray-400 mr-1" />
                            {item.eta}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                          <div className="flex items-center space-x-1 md:space-x-2">
                            <button className="text-cyan-600 hover:text-cyan-900 p-1 md:p-2 rounded-lg hover:bg-cyan-50 transition-all">
                              <Eye className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                            <button className="text-gray-600 hover:text-gray-900 p-1 md:p-2 rounded-lg hover:bg-gray-50 transition-all">
                              <Edit className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-900 p-1 md:p-2 rounded-lg hover:bg-red-50 transition-all">
                              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="bg-gradient-to-br from-blue-50 via-white to-cyan-50 min-h-screen">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mx-6 h-[calc(100vh-12rem)]">
              <div className="flex flex-col h-full">
                <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-2xl">
                  <h3 className="text-lg font-black">Logistics Communication Hub</h3>
                  <p className="text-sm opacity-90">Real-time team collaboration</p>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-3 rounded-2xl shadow-sm ${
                        msg.sender === 'You' 
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                          : 'bg-gray-100 text-gray-900 border border-gray-200'
                      }`}>
                        <p className="text-sm font-bold opacity-90">{msg.sender}</p>
                        <p className="text-sm mt-1">{msg.message}</p>
                        <p className="text-xs opacity-75 mt-2">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900">Smart Inventory Management</h2>
                <p className="text-sm md:text-base text-gray-600 mt-1">AI-powered stock optimization and control</p>
              </div>
              <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Import</span>
                </button>
                <button className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button className="flex-1 sm:flex-none bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Low Stock Alert', value: '12', detail: 'Items below threshold', icon: AlertTriangle, color: 'from-red-400 to-red-600' },
                { label: 'Total Categories', value: '8', detail: 'Product categories', icon: Archive, color: 'from-blue-400 to-blue-600' },
                { label: 'Total Value', value: '$847K', detail: 'Inventory worth', icon: DollarSign, color: 'from-green-400 to-green-600' },
                { label: 'Efficiency Score', value: '94.2%', detail: 'Stock optimization', icon: Gauge, color: 'from-purple-400 to-purple-600' }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                      <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-xs md:text-sm text-gray-500 mt-2">{stat.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg">
              <div className="px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
                <h3 className="text-lg font-black text-gray-900">Inventory Distribution</h3>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 bg-gradient-to-br from-gray-50 via-white to-slate-50 min-h-screen flex items-center justify-center">
            <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-lg">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-2xl font-black text-gray-900 mb-4">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Hub</h2>
              <p className="text-gray-500">Advanced features coming soon to enhance your logistics operations.</p>
            </div>
          </div>
        );
    }
  };

  const Sidebar = ({ isRight = false }) => (
    <div className={`
      ${isRight ? 'hidden xl:block' : 'hidden lg:block'}
      bg-white/95 backdrop-blur-md shadow-xl transition-all duration-300 
      ${sidebarCollapsed ? 'w-20' : 'w-64'} 
      border-gray-200 ${isRight ? 'border-l' : 'border-r'}
    `}>
      {!isRight && (
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-black text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  LOGISTICS HUB
                </h1>
                <p className="text-xs text-gray-600 font-medium">Smart Operations Center</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <nav className="mt-4 px-4 space-y-2">
        {(isRight ? rightMenuItems : menuItems).map((item, index) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;
          return (
            <div 
              key={index} 
              onClick={() => setActiveTab(item.id)}
              className={`group flex items-center px-4 py-4 text-sm cursor-pointer rounded-2xl transition-all duration-300 ${
                isActive 
                  ? `bg-gradient-to-r ${item.gradient} text-white shadow-xl transform scale-105` 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <IconComponent className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              {!sidebarCollapsed && (
                <>
                  <span className="ml-3 font-bold">{item.label}</span>
                  <ChevronRight className={`ml-auto w-4 h-4 transition-all duration-300 ${
                    isActive ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-gray-400'
                  }`} />
                </>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* NEW: Metric Detail Modal */}
      <MetricDetailModal />

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:block text-gray-500 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg md:text-2xl font-black text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Smart Logistics Platform
              </h2>
              <p className="hidden sm:block text-xs md:text-sm text-gray-600 font-medium">Advanced Supply Chain Management</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Real-time Status */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6 bg-gray-50 rounded-xl px-3 lg:px-4 py-2 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.activeShipments} Active</span>
              </div>
              <div className="hidden lg:flex items-center space-x-2">
                <Truck className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-bold text-gray-700">Fleet Online</span>
              </div>
            </div>
            
            <div className="hidden sm:flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-xs md:text-sm font-bold text-gray-700">{currentTime.toLocaleTimeString()}</span>
            </div>
            
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
              <Bell className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            <div className="relative z-[9999] user-dropdown-container">
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all duration-200"
              >
                <User className="h-4 w-4 md:h-5 md:w-5" />
              </button>

              {showUserDropdown && (
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      LOGISTICS HUB
                    </h1>
                    <p className="text-xs text-gray-600 font-medium">Smart Operations Center</p>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-gray-500 hover:text-gray-700">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <nav className="mt-4 px-4 space-y-2 overflow-y-auto" style={{maxHeight: 'calc(100vh - 140px)'}}>
              {menuItems.map((item, index) => {
                const isActive = activeTab === item.id;
                const IconComponent = item.icon;
                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`group flex items-center px-4 py-4 text-sm cursor-pointer rounded-2xl transition-all duration-300 ${
                      isActive 
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-xl transform scale-105` 
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span className="ml-3 font-bold">{item.label}</span>
                    <ChevronRight className={`ml-auto w-4 h-4 transition-all duration-300 ${
                      isActive ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-gray-400'
                    }`} />
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {renderContent()}
        </main>
        <Sidebar isRight />
      </div>
    </div>
  );
};

export default Logistics;