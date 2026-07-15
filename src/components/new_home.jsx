import React, { useState, useEffect } from 'react';
import POS from './Pos';
import { 
  Building2, DollarSign, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Bell, BarChart3, 
  FileText, Settings, User, RefreshCw, Menu, ChevronDown, Truck, ShoppingCart, Database, Activity, 
  Globe, MoreHorizontal, CheckCircle, XCircle, AlertCircle, Info, ArrowUpRight, ArrowDownRight, 
  Eye, Star, ChevronRight, ArrowLeft, Timer, Shield, Gauge, Warehouse, Filter, Download, Plus,
  Search, Minus, Edit, Trash2, X, Calendar, Clock, Zap, Target, Layers, Cpu, Wifi, Battery
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';

// Dashboard Component - Enhanced Version
const DashboardComponent = ({ currentTime, sidebarCollapsed, setSidebarCollapsed }) => {
  const [animatedValues, setAnimatedValues] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    activeUsers: 1247,
    systemLoad: 34.2,
    networkLatency: 23,
    uptime: 99.97
  });

  
  const kpiMetrics = [
    { label: 'Revenue (Real-time)', value: '$2.847M', target: '$2.5M', variance: '+13.9%', trend: 'up', icon: DollarSign, color: 'emerald' },
    { label: 'Active Sessions', value: '1,247', target: '1,000', variance: '+24.7%', trend: 'up', icon: Users, color: 'blue' },
    { label: 'System Performance', value: '98.4%', target: '95%', variance: '+3.4pp', trend: 'up', icon: Gauge, color: 'purple' },
    { label: 'Customer Satisfaction', value: '4.8/5', target: '4.5/5', variance: '+6.7%', trend: 'up', icon: Star, color: 'amber' },
    { label: 'Processing Speed', value: '847ms', target: '1000ms', variance: '-15.3%', trend: 'up', icon: Zap, color: 'cyan' },
    { label: 'Security Score', value: '94.7%', target: '90%', variance: '+5.2pp', trend: 'up', icon: Shield, color: 'red' }
  ];

  const performanceData = [
    { time: '00:00', revenue: 2400, users: 145, performance: 96 },
    { time: '04:00', revenue: 1800, users: 89, performance: 98 },
    { time: '08:00', revenue: 4200, users: 234, performance: 94 },
    { time: '12:00', revenue: 6800, users: 387, performance: 97 },
    { time: '16:00', revenue: 8200, users: 456, performance: 95 },
    { time: '20:00', revenue: 5600, users: 298, performance: 99 }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      kpiMetrics.forEach((_, index) => {
        setTimeout(() => {
          setAnimatedValues(prev => ({ ...prev, [index]: true }));
        }, index * 150);
      });
    }, 300);

    // Simulate real-time updates
    const metricsTimer = setInterval(() => {
      setRealTimeMetrics(prev => ({
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 20 - 10),
        systemLoad: Math.max(0, Math.min(100, prev.systemLoad + (Math.random() * 4 - 2))),
        networkLatency: Math.max(0, prev.networkLatency + Math.floor(Math.random() * 6 - 3)),
        uptime: Math.min(100, prev.uptime + (Math.random() * 0.01))
      }));
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(metricsTimer);
    };
  }, []);

  const getColorClasses = (color) => {
    const colors = {
      emerald: 'from-emerald-400 to-emerald-600',
      blue: 'from-blue-400 to-blue-600',
      purple: 'from-purple-400 to-purple-600',
      amber: 'from-amber-400 to-amber-600',
      cyan: 'from-cyan-400 to-cyan-600',
      red: 'from-red-400 to-red-600'
    };
    return colors[color] || 'from-gray-400 to-gray-600';
  };

  const EnhancedMetricCard = ({ metric, index }) => {
    const IconComponent = metric.icon;
    const isAnimated = animatedValues[index];

    return (
      <div 
        className={`group relative bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-700 hover:border-gray-300 hover:-translate-y-2 overflow-hidden ${
          isAnimated ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' : 'opacity-0'
        }`}
        style={{ animationDelay: `${index * 150}ms` }}
      >
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${getColorClasses(metric.color)} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
        
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className={`p-4 rounded-xl bg-gradient-to-br ${getColorClasses(metric.color)} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div className={`flex items-center text-sm font-bold px-3 py-1 rounded-full ${
              metric.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {metric.trend === 'up' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
              {metric.variance}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{metric.label}</p>
            <p className="text-3xl font-black text-gray-900 leading-none">{metric.value}</p>
            <p className="text-sm text-gray-600 font-medium">Target: <span className="font-semibold">{metric.target}</span></p>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="mt-6 relative">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getColorClasses(metric.color)} transition-all duration-1500 ease-out rounded-full relative`}
                style={{ 
                  width: isAnimated ? '92%' : '0%',
                  boxShadow: isAnimated ? `0 0 20px rgba(59, 130, 246, 0.3)` : 'none'
                }}
              >
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
              <span>Performance</span>
              <span>92%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm backdrop-blur-md bg-white/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-gray-900 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            
              </h2>

            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Real-time Status Indicators */}
            <div className="flex items-center space-x-6 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.activeUsers} Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <Cpu className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.systemLoad.toFixed(1)}% Load</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wifi className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-bold text-gray-700">{realTimeMetrics.networkLatency}ms</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-bold text-gray-700">{currentTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8 bg-gradient-to-br from-gray-50 to-white min-h-screen">
        {/* Enhanced KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {kpiMetrics.map((metric, index) => (
            <EnhancedMetricCard key={index} metric={metric} index={index} />
          ))}
        </div>

        {/* Advanced Analytics Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-500">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900">Performance Analytics</h3>
                <p className="text-sm text-gray-600 mt-1">Real-time system metrics and trends</p>
              </div>
              <div className="flex items-center space-x-3">
                <select className="bg-gray-100 border-0 rounded-lg px-4 py-2 text-sm font-medium text-gray-700">
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                </select>
                <button className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
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
                  <Area type="monotone" dataKey="users" stroke="#10B981" fill="url(#usersGradient)" strokeWidth={3} />
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
                  { icon: Plus, label: 'Add Item', color: 'blue' },
                  { icon: Download, label: 'Export', color: 'green' },
                  { icon: Settings, label: 'Configure', color: 'purple' },
                  { icon: Bell, label: 'Alerts', color: 'red' }
                ].map((action, index) => (
                  <button 
                    key={index}
                    className={`p-4 rounded-xl border-2 border-gray-200 hover:border-${action.color}-300 bg-gradient-to-br from-${action.color}-50 to-white hover:shadow-lg transition-all duration-300 group`}
                  >
                    <action.icon className={`w-6 h-6 text-${action.color}-600 mx-auto mb-2 group-hover:scale-110 transition-transform`} />
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
                  { label: 'CPU Usage', value: realTimeMetrics.systemLoad, max: 100, color: 'blue' },
                  { label: 'Memory', value: 67.3, max: 100, color: 'green' },
                  { label: 'Storage', value: 43.8, max: 100, color: 'purple' },
                  { label: 'Network', value: 89.2, max: 100, color: 'cyan' }
                ].map((metric, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span>{metric.label}</span>
                      <span>{metric.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r from-${metric.color}-400 to-${metric.color}-600 transition-all duration-1000 rounded-full`}
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
    </>
  );
};

// Inventory Management Component
const InventoryComponent = ({ setActivePage }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // table, grid, analytics

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [inventoryItems, setInventoryItems] = useState([
    { id: 1, itemCode: 'TECH-001', name: 'Wireless Headphones Pro', category: 'Electronics', currentStock: 45, minStock: 10, costPrice: 89.99, sellingPrice: 149.99, status: 'Active' },
    { id: 2, itemCode: 'HOME-002', name: 'Smart Coffee Maker', category: 'Home & Kitchen', currentStock: 8, minStock: 15, costPrice: 120.00, sellingPrice: 199.99, status: 'Low Stock' },
    { id: 3, itemCode: 'BOOK-003', name: 'Premium Notebook Set', category: 'Stationery', currentStock: 0, minStock: 25, costPrice: 15.00, sellingPrice: 29.99, status: 'Out of Stock' }
  ]);

  const getStatusColor = (item) => {
    if (item.currentStock === 0) return 'bg-red-100 text-red-800 border border-red-200';
    if (item.currentStock <= item.minStock) return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-green-100 text-green-800 border border-green-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActivePage('/')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Smart Inventory</h1>
              <p className="text-sm text-gray-600">AI-Powered Stock Management</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Items', value: inventoryItems.length, icon: Package, color: 'blue' },
            { label: 'Low Stock', value: inventoryItems.filter(i => i.currentStock <= i.minStock && i.currentStock > 0).length, icon: AlertTriangle, color: 'amber' },
            { label: 'Out of Stock', value: inventoryItems.filter(i => i.currentStock === 0).length, icon: TrendingDown, color: 'red' },
            { label: 'Total Value', value: `$${inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0).toLocaleString()}`, icon: DollarSign, color: 'green' }
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br from-${stat.color}-400 to-${stat.color}-600`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search inventory..."
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {['table', 'grid', 'analytics'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => setShowAddItem(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Display */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-black text-gray-900">Inventory Database</h3>
          </div>
          
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Item Code', 'Product Name', 'Category', 'Stock', 'Cost', 'Price', 'Status', 'Actions'].map((header) => (
                      <th key={header} className="text-left py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wide">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryItems.filter(item => 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="py-4 px-6 text-sm font-mono text-gray-600">{item.itemCode}</td>
                      <td className="py-4 px-6 font-semibold text-gray-900">{item.name}</td>
                      <td className="py-4 px-6 text-gray-600">{item.category}</td>
                      <td className="py-4 px-6 text-center font-bold text-gray-900">{item.currentStock}</td>
                      <td className="py-4 px-6 text-gray-900">${item.costPrice.toFixed(2)}</td>
                      <td className="py-4 px-6 font-semibold text-gray-900">${item.sellingPrice.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(item)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <button className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all duration-200">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {inventoryItems.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{item.itemCode}</span>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(item)}`}>
                      {item.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 mb-2">{item.name}</h4>
                  <p className="text-sm text-gray-600 mb-4">{item.category}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Stock:</span>
                      <span className="font-bold text-gray-900">{item.currentStock}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-bold text-gray-900">${item.sellingPrice}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// POS Component
const POSComponent = ({ setActivePage }) => {
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const products = [
    { id: 1, name: 'Wireless Headphones', price: 149.99, category: 'Electronics', stock: 45 },
    { id: 2, name: 'Smart Coffee Maker', price: 199.99, category: 'Home', stock: 8 },
    { id: 3, name: 'Premium Notebook', price: 29.99, category: 'Stationery', stock: 25 }
  ];

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotal(newTotal);
  }, [cart]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActivePage('/')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Smart POS Terminal</h1>
              <p className="text-sm text-gray-600">Advanced Point of Sale System</p>
            </div>
          </div>
          <div className="text-3xl font-black text-green-600">
            ${total.toFixed(2)}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Products Section */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Search products..."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.filter(product => 
              product.name.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((product) => (
              <div key={product.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                   onClick={() => addToCart(product)}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{product.category}</p>
                  <p className="text-2xl font-black text-green-600">${product.price}</p>
                  <p className="text-xs text-gray-500 mt-2">Stock: {product.stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white border-l border-gray-200 p-6">
          <h3 className="text-xl font-black text-gray-900 mb-6">Shopping Cart</h3>
          
          <div className="space-y-4 mb-8">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-600">${item.price} x {item.quantity}</p>
                </div>
                <p className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          
          {cart.length > 0 && (
            <div className="space-y-4">
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between text-xl font-black text-gray-900">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                Process Payment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Supply Chain Component
const SupplyChainComponent = ({ setActivePage }) => {
  const [metrics, setMetrics] = useState({
    efficiency: 94.2,
    deliveryRate: 91.8,
    cost: 28.4,
    qualityScore: 4.6
  });

  const kpiCards = [
    { label: 'Supply Chain Efficiency', value: `${metrics.efficiency}%`, icon: Gauge, color: 'blue' },
    { label: 'On-Time Delivery Rate', value: `${metrics.deliveryRate}%`, icon: Timer, color: 'green' },
    { label: 'Total Procurement Cost', value: `${metrics.cost}M`, icon: DollarSign, color: 'red' },
    { label: 'Supplier Quality Score', value: `${metrics.qualityScore}/5`, icon: Star, color: 'amber' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActivePage('/')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Supply Chain Hub</h1>
              <p className="text-sm text-gray-600">End-to-End Logistics Management</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((card, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-black text-gray-900 mt-2">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br from-${card.color}-400 to-${card.color}-600`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
          <h3 className="text-xl font-black text-gray-900 mb-6">Supply Chain Analytics</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Advanced supply chain analytics coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reports Component
const ReportsComponent = ({ setActivePage }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-teal-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActivePage('/')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Analytics & Reports</h1>
              <p className="text-sm text-gray-600">Business Intelligence Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-black text-gray-900 mb-2">Advanced Reports Coming Soon</h3>
            <p className="text-gray-600">Comprehensive analytics and reporting tools</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Floor Planning Component
const FloorPlanningComponent = ({ setActivePage }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setActivePage('/')}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Floor Planning</h1>
              <p className="text-sm text-gray-600">Space Optimization & Layout Design</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
          <div className="text-center">
            <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-black text-gray-900 mb-2">Floor Planning Tools</h3>
            <p className="text-gray-600">Interactive floor design coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
export default function Cashier_home() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState('/');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navigationItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/', gradient: 'from-blue-500 to-purple-600' },
    { icon: ShoppingCart, label: 'Point of Sale', path: '/pos', gradient: 'from-green-500 to-blue-600' },
    { icon: Package, label: 'Inventory', path: '/inventory', gradient: 'from-blue-500 to-purple-600' },
    { icon: Truck, label: 'Supply Chain', path: '/supply', gradient: 'from-purple-500 to-pink-600' },
    { icon: Users, label: 'Customers', path: '/customers', gradient: 'from-pink-500 to-red-600' },
    { icon: DollarSign, label: 'Finance', path: '/finance', gradient: 'from-yellow-500 to-orange-600' },
    { icon: FileText, label: 'Reports', path: '/reports', gradient: 'from-cyan-500 to-teal-600' },
    { icon: Layers, label: 'Floor Planning', path: '/floor', gradient: 'from-orange-500 to-red-600' },
    { icon: Settings, label: 'Settings', path: '/settings', gradient: 'from-gray-500 to-gray-700' }
  ];

  const Sidebar = () => (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-80'} shadow-xl backdrop-blur-md bg-white/95`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-2xl font-black text-gray-900">Cashier Panel</h1>
              <p className="text-sm text-gray-600 font-medium"></p>
            </div>
          )}
        </div>
      </div>
      
      <nav className="mt-4 px-4 space-y-2">
        {navigationItems.map((item, index) => {
          const isActive = activePage === item.path;
          return (
            <div 
              key={index} 
              onClick={() => setActivePage(item.path)}
              className={`group flex items-center px-4 py-4 text-sm cursor-pointer rounded-2xl transition-all duration-300 ${
                isActive 
                  ? `bg-gradient-to-r ${item.gradient} text-white shadow-xl transform scale-105` 
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              {!sidebarCollapsed && (
                <>
                  <span className="ml-4 font-bold">{item.label}</span>
                  <ChevronRight className={`ml-auto w-5 h-5 transition-all duration-300 ${
                    isActive ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-gray-400'
                  }`} />
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      {!sidebarCollapsed && (
        <div className="absolute bottom-6 left-6 right-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Cashier:1</p>
            </div>
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentPage = () => {
    switch (activePage) {
      case '/':
        return <DashboardComponent currentTime={currentTime} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />;
      case '/pos':
        return <POS setActivePage={setActivePage} />;
      case '/inventory':
        return <InventoryComponent setActivePage={setActivePage} />;
      case '/supply':
        return <SupplyChainComponent setActivePage={setActivePage} />;
      case '/reports':
        return <ReportsComponent setActivePage={setActivePage} />;
      case '/floor':
        return <FloorPlanningComponent setActivePage={setActivePage} />;
      default:
        return <DashboardComponent currentTime={currentTime} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 relative">
          {renderCurrentPage()}
        </div>
      </div>
    </div>
  );
}